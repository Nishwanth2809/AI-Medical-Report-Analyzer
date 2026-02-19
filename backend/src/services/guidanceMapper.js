const fs = require("fs");
const path = require("path");
const usda = require("./usdaClient");

const CONDITIONS_PATH = path.join(__dirname, "..", "data", "conditions.json");
const NUTRIENTS_PATH = path.join(__dirname, "..", "data", "nutrients.json");
const CONDITION_NUTRIENTS_PATH = path.join(__dirname, "..", "data", "condition_nutrients.json");

let CONDITIONS_CACHE = null;
let NUTRIENTS_CACHE = null;
let COND_NUTRIENTS_CACHE = null;

function safeLoadJson(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error loading ${path.basename(filePath)}:`, err.message);
    return fallback;
  }
}

function loadConditions() {
  if (CONDITIONS_CACHE) return CONDITIONS_CACHE;
  CONDITIONS_CACHE = safeLoadJson(CONDITIONS_PATH, {});
  return CONDITIONS_CACHE;
}

function loadNutrients() {
  if (NUTRIENTS_CACHE) return NUTRIENTS_CACHE;
  NUTRIENTS_CACHE = safeLoadJson(NUTRIENTS_PATH, {});
  return NUTRIENTS_CACHE;
}

function loadConditionNutrients() {
  if (COND_NUTRIENTS_CACHE) return COND_NUTRIENTS_CACHE;
  COND_NUTRIENTS_CACHE = safeLoadJson(CONDITION_NUTRIENTS_PATH, {});
  return COND_NUTRIENTS_CACHE;
}

function normalizeKey(s = "") {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ");
}

const ALIASES = {
  "high blood pressure": "hypertension",
  "elevated blood pressure": "hypertension",
  "htn": "hypertension",
  "high blood sugar": "diabetes",
  "hyperglycemia": "diabetes",
  "dm": "diabetes",
  "low hemoglobin": "anemia",
  "iron deficiency anemia": "anemia",
  "sinus infection": "sinusitis",
  "dehydrated": "dehydration",
};

function bestEffortMatchKey(inputKey, dbKeys) {
  const k = normalizeKey(inputKey);
  if (dbKeys.includes(k)) return k;
  if (ALIASES[k]) return ALIASES[k];

  // substring match (e.g., "mild sinusitis" -> "sinusitis")
  for (const base of dbKeys) {
    if (k.includes(base)) return base;
  }
  return null;
}

const DEFAULT_GUIDANCE = {
  overview:
    "General diet and lifestyle guidance. For personalized nutrition advice, consult a clinician/dietitian.",
  recommended_foods: [
    "Vegetables (leafy greens)",
    "Fruits (whole fruits)",
    "Whole grains",
    "Legumes (dal/beans)",
    "Nuts and seeds (moderation)",
    "Adequate water (unless fluid restriction advised)",
  ],
  foods_to_limit: [
    "Sugary drinks",
    "Ultra-processed snacks",
    "Excess fried foods",
    "Very high salt foods",
  ],
  lifestyle: ["Daily activity (as tolerated)", "7–9 hours sleep", "Stress management", "Follow-up if symptoms worsen"],
};

// optional safety notes (expand later)
function buildSafetyNotes(detectedConditions = []) {
  const joined = detectedConditions
    .map((x) => normalizeKey(typeof x === "string" ? x : (x.normalized || x.label || "")))
    .join(" ");

  const notes = [];

  if (joined.includes("ckd") || joined.includes("kidney") || joined.includes("renal")) {
    notes.push("Kidney-related issue detected: avoid major potassium/protein changes without medical advice.");
  }
  if (joined.includes("warfarin")) {
    notes.push("If you are on warfarin/blood thinners, keep vitamin K intake consistent and follow clinician advice.");
  }
  if (joined.includes("diabetes") || joined.includes("hyperglycemia")) {
    notes.push("Blood sugar-related issue detected: avoid sugary drinks and refined carbohydrates.");
  }

  return notes;
}

function buildNutrientsForMatchedConditions(matchedKeys) {
  const nutrientsDb = loadNutrients();
  const condNutrients = loadConditionNutrients();

  // If nutrients file missing, gracefully return empty
  if (!nutrientsDb || Object.keys(nutrientsDb).length === 0) {
    return [];
  }

  const recs = [];

  for (const key of matchedKeys) {
    const mapping = condNutrients[key];
    if (!mapping || !Array.isArray(mapping.nutrients)) continue;

    for (const item of mapping.nutrients) {
      const info = nutrientsDb[item.key];
      if (!info) continue;

      recs.push({
        key: item.key,
        priority: typeof item.priority === "number" ? item.priority : 0.6,
        why_needed: info.why_needed || "",
        foods: info.foods || [],
        absorption_tip: info.absorption_tip || "",
        avoid_with: info.avoid_with || "",
        top_foods: [], // ✅ USDA enrichment will fill this
      });
    }
  }

  // dedupe nutrient keys, keep highest priority
  const map = new Map();
  for (const r of recs) {
    const prev = map.get(r.key);
    if (!prev || (r.priority ?? 0) > (prev.priority ?? 0)) map.set(r.key, r);
  }

  return [...map.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/**
 * USDA enrichment helper
 */
async function enrichNutrientFoodsFromUSDA(nutrientKey, foods) {
  // nutrientKey -> USDA nutrient name
  const nutrientNameMap = {
    iron: "Iron, Fe",
    calcium: "Calcium, Ca",
    vitamin_d: "Vitamin D (D2 + D3)",
    vitamin_b12: "Vitamin B-12",
    folate: "Folate, total",
    vitamin_c: "Vitamin C, total ascorbic acid",
  };

  const nutrientName = nutrientNameMap[nutrientKey] || nutrientKey;
  const results = [];

  // ✅ Safety/perf: don’t query too many foods per request
  const limitedFoods = Array.isArray(foods) ? foods.slice(0, 8) : [];

  for (const foodName of limitedFoods) {
    try {
      const fdcId = await usda.getBestMatchFdcId(foodName);
      if (!fdcId) continue;

      const details = await usda.getFoodDetails(fdcId);
      const amt = usda.getNutrientAmount(details, nutrientName);
      if (!amt) continue;

      results.push({
        food: foodName,
        fdcId,
        amount: amt.value,
        unit: amt.unit,
      });
    } catch {
      // ignore individual food failures
    }
  }

  results.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  return results.slice(0, 5);
}

/**
 * detectedConditions can be:
 * - ["anemia","hypertension"]
 * - OR array of objects from UMLS merge [{label, normalized, ...}]
 */
async function getGuidance(detectedConditions = []) {
  const db = loadConditions();
  const dbKeys = Object.keys(db);

  const matchedGuidance = {};
  const matchedKeysSet = new Set();
  const unknownConditions = [];

  for (const c of detectedConditions) {
    const raw = typeof c === "string" ? c : (c.normalized || c.label || "");
    const key = bestEffortMatchKey(raw, dbKeys);

    if (key && db[key]) {
      matchedGuidance[key] = db[key];
      matchedKeysSet.add(key);
    } else if (raw) {
      unknownConditions.push(String(raw));
    }
  }

  const matchedKeys = [...matchedKeysSet];
  const nutrients = buildNutrientsForMatchedConditions(matchedKeys);
  const safetyNotes = buildSafetyNotes(detectedConditions);

  // ✅ USDA enrichment (only if API key exists)
  if (process.env.USDA_API_KEY) {
    for (const n of nutrients) {
      if (Array.isArray(n.foods) && n.foods.length > 0) {
        n.top_foods = await enrichNutrientFoodsFromUSDA(n.key, n.foods);
      } else {
        n.top_foods = [];
      }
    }
  }

  return {
    matchedGuidance,
    generalGuidance: DEFAULT_GUIDANCE,
    nutrients,
    safetyNotes,
    unknownConditions,
  };
}

module.exports = { getGuidance };
