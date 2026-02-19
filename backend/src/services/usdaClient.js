// src/services/usdaClient.js
const BASE = "https://api.nal.usda.gov/fdc/v1";

const foodCache = new Map();   // fdcId -> details
const searchCache = new Map(); // query -> best match

function requireKey() {
  const key = process.env.USDA_API_KEY;
  if (!key) throw new Error("USDA_API_KEY missing in environment");
  return key;
}

async function fdcFetch(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`USDA FDC error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// POST /foods/search
async function searchFoods(query, { dataType = ["Foundation", "SR Legacy", "Survey (FNDDS)"], pageSize = 10 } = {}) {
  const apiKey = requireKey();
  const qKey = `${query}::${dataType.join(",")}::${pageSize}`;
  if (searchCache.has(qKey)) return searchCache.get(qKey);

  const url = `${BASE}/foods/search?api_key=${encodeURIComponent(apiKey)}`;
  const body = { query, dataType, pageSize };

  const json = await fdcFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  searchCache.set(qKey, json);
  return json;
}

// GET /food/{fdcId}
async function getFoodDetails(fdcId) {
  const apiKey = requireKey();
  if (foodCache.has(fdcId)) return foodCache.get(fdcId);

  const url = `${BASE}/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`;
  const json = await fdcFetch(url, { method: "GET" });

  foodCache.set(fdcId, json);
  return json;
}

function pickBestFood(searchJson) {
  const foods = Array.isArray(searchJson?.foods) ? searchJson.foods : [];
  if (!foods.length) return null;

  // Prefer non-branded, higher data quality types; your dataType filter already helps.
  return foods[0]; // simplest: top match
}

function getNutrientAmount(foodDetails, nutrientName) {
  const target = String(nutrientName).toLowerCase().trim();
  const nutrients = Array.isArray(foodDetails?.foodNutrients) ? foodDetails.foodNutrients : [];

  // foodNutrients items can have nutrientName/unitName/value (varies by data type)
  for (const n of nutrients) {
    const name =
      (n?.nutrient?.name || n?.nutrientName || "").toString().toLowerCase().trim();
    if (name === target) {
      const value = n?.amount ?? n?.value ?? null;
      const unit = n?.nutrient?.unitName || n?.unitName || "";
      if (typeof value === "number") return { value, unit };
    }
  }
  return null;
}

async function getBestMatchFdcId(foodName) {
  const searchJson = await searchFoods(foodName, { pageSize: 5 });
  const best = pickBestFood(searchJson);
  return best?.fdcId || null;
}

module.exports = {
  searchFoods,
  getFoodDetails,
  getNutrientAmount,
  getBestMatchFdcId,
};
