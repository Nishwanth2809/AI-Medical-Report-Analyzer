// backend/src/services/liveNutritionGuidanceFree.js
const usda = require("./usdaClient");
const { tryMedlinePlus, tryNhsSearch, fetchOdsFactSheet } = require("./trustedGuidanceFetcher");
const { pickCategory, buildNutritionQueryFromCategory } = require("./umlsCategoryClassifier");

// Nutrient vocabulary (not rules; just detection)
const NUTRIENTS = [
  { key: "calcium", label: "Calcium", usdaName: "Calcium, Ca", re: /\bcalcium\b/i },
  { key: "vitamin_d", label: "Vitamin D", usdaName: "Vitamin D (D2 + D3)", re: /\bvitamin\s*d\b/i },
  { key: "protein", label: "Protein", usdaName: "Protein", re: /\bprotein\b/i },
  { key: "vitamin_c", label: "Vitamin C", usdaName: "Vitamin C, total ascorbic acid", re: /\bvitamin\s*c\b/i },
  { key: "zinc", label: "Zinc", usdaName: "Zinc, Zn", re: /\bzinc\b/i },
  { key: "iron", label: "Iron", usdaName: "Iron, Fe", re: /\biron\b/i },
  { key: "folate", label: "Folate", usdaName: "Folate, total", re: /\bfolate\b/i },
  { key: "vitamin_b12", label: "Vitamin B12", usdaName: "Vitamin B-12", re: /\bvitamin\s*b12\b|\bb\s*12\b/i },
];

// Generic food candidates for USDA ranking (NOT condition rules)
const GENERIC_FOODS = [
  "milk", "yogurt", "cheese", "ragi", "tofu", "sesame seeds",
  "egg", "salmon", "lentils", "spinach", "broccoli", "orange",
  "guava", "pumpkin seeds", "almonds", "chickpeas", "chicken", "beans",
];

function withTimeout(promise, ms, fallback = null) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function extractNutrients(text) {
  const found = [];
  for (const n of NUTRIENTS) if (n.re.test(text)) found.push(n);
  const map = new Map();
  for (const f of found) map.set(f.key, f);
  return [...map.values()];
}

async function rankFoodsByNutrient(foodNames, usdaNutrientName, maxFoods = 12) {
  const limited = Array.isArray(foodNames) ? foodNames.slice(0, maxFoods) : [];

  const rows = await Promise.all(
    limited.map(async (food) => {
      try {
        const fdcId = await withTimeout(usda.getBestMatchFdcId(food), 2500, null);
        if (!fdcId) return null;

        const details = await withTimeout(usda.getFoodDetails(fdcId), 3000, null);
        if (!details) return null;

        const amt = usda.getNutrientAmount(details, usdaNutrientName);
        if (!amt) return null;

        return { food, fdcId, amount: amt.value, unit: amt.unit };
      } catch {
        return null;
      }
    })
  );

  const results = rows.filter(Boolean);
  results.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  return results.slice(0, 5);
}

async function getLiveNutritionGuidanceFree({ detectedConditions = [], umlsMentions = [] } = {}) {
  if (!process.env.USDA_API_KEY) {
    return { sources: [], nutrients_found: [], foods_ranked_by_usda: {}, nutrients: [], note: "USDA_API_KEY missing" };
  }

  const baseTerms = Array.isArray(detectedConditions) && detectedConditions.length
    ? detectedConditions.slice(0, 2)
    : ["health"];

  const category = pickCategory(detectedConditions, umlsMentions);
  const query = buildNutritionQueryFromCategory(category, baseTerms);
  const isVercel = Boolean(process.env.VERCEL);
  const nutrientLimit = isVercel ? 2 : 4;
  const foodLimit = isVercel ? 6 : 12;

  const sources = [];
  const [mp, nhsPrimary, nhsRetry] = await Promise.all([
    withTimeout(tryMedlinePlus(query), 5000, null),
    withTimeout(tryNhsSearch(query), 5000, null),
    withTimeout(tryNhsSearch(`${baseTerms[0]} diet nutrition NHS`), 5000, null),
  ]);

  if (mp) sources.push({ title: mp.title, url: mp.url, snippet: mp.snippet });

  const nhs = nhsPrimary || nhsRetry;
  if (nhs) sources.push({ title: nhs.title, url: nhs.url, snippet: nhs.snippet });

  const combinedText = [mp?.text, nhs?.text].filter(Boolean).join("\n");
  const nutrientsFound = extractNutrients(combinedText).slice(0, nutrientLimit);

  const odsRows = await Promise.all(
    nutrientsFound.map((n) =>
      withTimeout(fetchOdsFactSheet(n.label.replace(/\s+/g, "")), 3500, null)
    )
  );
  const odsSources = odsRows
    .filter(Boolean)
    .map((ods) => ({ title: ods.title, url: ods.url, snippet: ods.snippet }));

  const foods_ranked_by_usda = {};
  const rankedRows = await Promise.all(
    nutrientsFound.map(async (n) => {
      const foods = await withTimeout(
        rankFoodsByNutrient(GENERIC_FOODS, n.usdaName, foodLimit),
        isVercel ? 6000 : 12000,
        []
      );
      return [n.key, foods];
    })
  );
  for (const [key, foods] of rankedRows) foods_ranked_by_usda[key] = foods;

  const nutrient_packets = nutrientsFound.map((n) => ({
    key: n.key,
    label: n.label,
    unit_hint: n.usdaName,
    top_foods: foods_ranked_by_usda[n.key] || [],
  }));

  return {
    message: "Live nutrition (UMLS category)",
    category,
    query,
    sources: [...sources, ...odsSources].slice(0, 10),
    nutrients_found: nutrientsFound.map((x) => x.key),
    foods_ranked_by_usda,
    nutrients: nutrient_packets,
  };
}

module.exports = { getLiveNutritionGuidanceFree };
