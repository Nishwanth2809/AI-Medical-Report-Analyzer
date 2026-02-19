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

function extractNhsLinksFromSearchHtml(html) {
  const links = new Set();
  const re = /href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;

  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = (m[1] || m[2] || m[3] || "").trim();
    if (!raw.startsWith("/")) continue;

    const path = raw.split("#")[0].split("?")[0];
    const segments = path.split("/").filter(Boolean);
    if (segments.length < 2) continue;

    const section = segments[0];
    if (!["conditions", "live-well", "common-health-questions", "medicines"].includes(section)) continue;

    const last = segments[segments.length - 1];
    const blockedSlugs = new Set(["live-well", "mental-health", "conditions", "services", "covid-19"]);
    if (blockedSlugs.has(last)) continue;

    links.add("https://www.nhs.uk/" + segments.join("/"));
  }

  return Array.from(links).slice(0, 20);
}

function extractNutrients(text) {
  const found = [];
  for (const n of NUTRIENTS) if (n.re.test(text)) found.push(n);
  const map = new Map();
  for (const f of found) map.set(f.key, f);
  return [...map.values()];
}

async function rankFoodsByNutrient(foodNames, usdaNutrientName) {
  const results = [];
  const limited = Array.isArray(foodNames) ? foodNames.slice(0, 12) : [];

  for (const food of limited) {
    try {
      const fdcId = await usda.getBestMatchFdcId(food);
      if (!fdcId) continue;

      const details = await usda.getFoodDetails(fdcId);
      const amt = usda.getNutrientAmount(details, usdaNutrientName);
      if (!amt) continue;

      results.push({ food, fdcId, amount: amt.value, unit: amt.unit });
    } catch {
      // ignore per-food failures
    }
  }

  results.sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  return results.slice(0, 5);
}

function mergeUnique(a = [], b = []) {
  return Array.from(new Set([...(a || []), ...(b || [])]));
}

function scoreLink(url, baseWord) {
  const u = url.toLowerCase();
  let score = 0;
  if (u.includes("strong-bones")) score += 6;
  if (u.includes(baseWord.toLowerCase())) score += 3;
  if (u.includes("bone")) score += 2;
  if (u.includes("fracture")) score += 2;
  if (u.includes("diet") || u.includes("food") || u.includes("nutrition")) score += 2;
  return score;
}

// quick HTML stripper for fetched pages
function stripQuick(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|li|h1|h2|h3|br|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
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

  // ✅ Use category-aware query
  const sources = [];
  const mp = await tryMedlinePlus(query);
  if (mp) sources.push({ title: mp.title, url: mp.url, snippet: mp.snippet });

  const nhsPrimary = await tryNhsSearch(query);
  const nhsRetry = await tryNhsSearch(`${baseTerms[0]} diet nutrition NHS`);
  const nhs = nhsPrimary || nhsRetry;
  if (nhs) sources.push({ title: nhs.title, url: nhs.url, snippet: nhs.snippet });

  // Combine texts for nutrient detection
  let combinedText = [mp?.text, nhs?.text].filter(Boolean).join("\n");

  // ... keep your NHS deep-link fetch logic here (links extraction, fetch pages, strip HTML)
  // Make sure you append to combinedText as you already do.

  const nutrientsFound = extractNutrients(combinedText);

  const odsSources = [];
  for (const n of nutrientsFound.slice(0, 4)) {
    const ods = await fetchOdsFactSheet(n.label.replace(/\s+/g, ""));
    if (ods) odsSources.push({ title: ods.title, url: ods.url, snippet: ods.snippet });
  }

  const foods_ranked_by_usda = {};
  for (const n of nutrientsFound) {
    foods_ranked_by_usda[n.key] = await rankFoodsByNutrient(GENERIC_FOODS, n.usdaName);
  }

  const nutrient_packets = nutrientsFound.map((n) => ({
    key: n.key,
    label: n.label,
    unit_hint: n.usdaName,
    top_foods: foods_ranked_by_usda[n.key] || [],
  }));

  return {
    message: "Live nutrition (UMLS category) ✅",
    category,
    query,
    sources: [...sources, ...odsSources].slice(0, 10),
    nutrients_found: nutrientsFound.map((x) => x.key),
    foods_ranked_by_usda,
    nutrients: nutrient_packets,
  };
}


module.exports = { getLiveNutritionGuidanceFree };
