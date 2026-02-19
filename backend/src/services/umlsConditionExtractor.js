function norm(s = "") {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ✅ ONLY map to keys that exist in your conditions.json
const MAP = [
  { key: "anemia", match: ["anemia", "iron deficiency anemia", "anaemia"] },
  { key: "diabetes", match: ["diabetes", "diabetes mellitus", "type 2 diabetes mellitus", "type ii diabetes"] },
  { key: "hypertension", match: ["hypertension", "high blood pressure", "essential hypertension"] },
  { key: "gastritis", match: ["gastritis", "acute gastritis", "chronic gastritis"] },
  { key: "dehydration", match: ["dehydration", "dehydrated"] },
  { key: "sinusitis", match: ["sinusitis", "maxillary sinusitis", "rhinosinusitis"] }
];

function textMatchesAny(text, phrases) {
  const t = norm(text);
  return phrases.some(p => t.includes(norm(p)));
}

function conditionsFromUmls(umls_mentions = [], minConfidence = 0.55) {
  const found = new Set();

  for (const m of umls_mentions) {
    const conf = m?.confidence ?? 0;
    if (conf < minConfidence) continue;

    const name = m?.name || "";
    const matched = m?.matched_text || "";
    const syns = Array.isArray(m?.synonyms) ? m.synonyms : [];

    for (const row of MAP) {
      if (
        textMatchesAny(name, row.match) ||
        textMatchesAny(matched, row.match) ||
        syns.some(s => textMatchesAny(s, row.match))
      ) {
        found.add(row.key);
      }
    }
  }

  return Array.from(found);
}

// Get best UMLS definition for a specific internal condition key
function bestDefinitionForCondition(umls_mentions = [], conditionKey = "") {
  const row = MAP.find(r => r.key === conditionKey);
  if (!row) return "";

  const candidates = (umls_mentions || [])
    .filter(m => {
      const name = m?.name || "";
      const matched = m?.matched_text || "";
      const syns = Array.isArray(m?.synonyms) ? m.synonyms : [];
      return (
        textMatchesAny(name, row.match) ||
        textMatchesAny(matched, row.match) ||
        syns.some(s => textMatchesAny(s, row.match))
      );
    })
    .sort((a, b) => (b?.confidence ?? 0) - (a?.confidence ?? 0));

  return candidates[0]?.definition || "";
}

module.exports = { conditionsFromUmls, bestDefinitionForCondition };
