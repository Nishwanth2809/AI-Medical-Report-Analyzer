// backend/src/services/umlsCategoryClassifier.js

function normalize(s = "") {
  return String(s).toLowerCase().trim();
}

/**
 * We classify broadly using whatever UMLS fields you already have:
 * - semanticTypes / semtypes / tui / sty
 * - source vocabulary hints
 * Fallback: keyword in name if semantic types missing.
 *
 * This is NOT "nutrient rules", it only selects a query theme (diet query).
 */
function classifyUmlsConcept(mention) {
  const name = normalize(mention?.name || mention?.label || "");
  const sem = (mention?.semanticTypes || mention?.semtypes || mention?.tui || mention?.sty || []);
  const semStr = Array.isArray(sem) ? sem.map(normalize).join(" ") : normalize(sem);

  const blob = `${name} ${semStr}`;

  // Injury / fracture / wound
  if (
    blob.includes("injury") ||
    blob.includes("fracture") ||
    blob.includes("wound") ||
    blob.includes("trauma") ||
    blob.includes("bone") ||
    blob.includes("musculoskeletal")
  ) return "injury_bone";

  // Diabetes / metabolic
  if (
    blob.includes("diabetes") ||
    blob.includes("hyperglyc") ||
    blob.includes("metabolic") ||
    blob.includes("endocrine")
  ) return "metabolic_diabetes";

  // Blood / anemia
  if (
    blob.includes("anemia") ||
    blob.includes("hemoglobin") ||
    blob.includes("blood") ||
    blob.includes("hematologic") ||
    blob.includes("haematologic")
  ) return "blood_anemia";

  // Cardiovascular / BP
  if (
    blob.includes("hypertension") ||
    blob.includes("blood pressure") ||
    blob.includes("cardio") ||
    blob.includes("vascular")
  ) return "cardio_bp";

  // Kidney
  if (
    blob.includes("kidney") ||
    blob.includes("renal") ||
    blob.includes("ckd") ||
    blob.includes("neph")
  ) return "kidney";

  // GI
  if (
    blob.includes("gastr") ||
    blob.includes("ulcer") ||
    blob.includes("reflux") ||
    blob.includes("stomach") ||
    blob.includes("gastro")
  ) return "gi";

  // Infection / immune
  if (
    blob.includes("infection") ||
    blob.includes("viral") ||
    blob.includes("bacterial") ||
    blob.includes("sinusitis") ||
    blob.includes("immune")
  ) return "infection_immune";

  return "general";
}

/**
 * Input can be:
 * - detected conditions array of strings
 * - OR UMLS mentions array (objects)
 *
 * We pick the "strongest" category by priority:
 */
const PRIORITY = [
  "injury_bone",
  "kidney",
  "metabolic_diabetes",
  "blood_anemia",
  "cardio_bp",
  "infection_immune",
  "gi",
  "general",
];

function pickCategory(detectedConditions = [], umlsMentions = []) {
  const cats = new Set();

  for (const m of umlsMentions || []) {
    cats.add(classifyUmlsConcept(m));
  }

  // fallback: if no UMLS mentions, use condition strings
  if (cats.size === 0) {
    for (const c of detectedConditions || []) {
      cats.add(classifyUmlsConcept({ name: c }));
    }
  }

  for (const p of PRIORITY) {
    if (cats.has(p)) return p;
  }
  return "general";
}

function buildNutritionQueryFromCategory(category, baseTerms) {
  const base = baseTerms && baseTerms.length ? baseTerms.join(" ") : "health";
  switch (category) {
    case "injury_bone":
      return `${base} fracture bone healing diet nutrition`;
    case "metabolic_diabetes":
      return `${base} diabetes diet nutrition carbs fiber glycemic`;
    case "blood_anemia":
      return `${base} anemia diet nutrition iron folate b12`;
    case "cardio_bp":
      return `${base} hypertension diet nutrition low sodium potassium dash`;
    case "kidney":
      return `${base} kidney disease diet nutrition sodium potassium phosphorus`;
    case "gi":
      return `${base} gastritis diet nutrition foods to eat avoid`;
    case "infection_immune":
      return `${base} infection immune support diet nutrition protein vitamin`;
    default:
      return `${base} diet nutrition vitamins minerals food`;
  }
}

module.exports = { pickCategory, buildNutritionQueryFromCategory };
