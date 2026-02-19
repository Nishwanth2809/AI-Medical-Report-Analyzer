const CONDITIONS = {
  anemia: ["anemia", "hemoglobin", "hb"],
  diabetes: ["diabetes", "glucose", "blood sugar", "hba1c"],
  hypertension: ["hypertension", "high blood pressure", "bp"],
  thyroid: ["thyroid", "tsh", "t3", "t4"],
  cholesterol: ["cholesterol", "ldl", "hdl", "triglycerides"],
  gastritis: ["gastritis", "acid reflux", "epigastric"],
  dehydration: ["dehydration", "dehydrated"],

  // radiology-friendly
  sinusitis: ["sinusitis", "mucosal thickening", "maxillary sinus"],
  stroke: ["infarct", "cva", "stroke"],
  hemorrhage: ["hemorrhage", "intracranial bleed", "intracranial hemorrhage", "bleed"],
  tumor: ["mass lesion", "space occupying", "space-occupying", "sol", "neoplasm", "malignancy", "metastasis"]
};

// Simple negation check: if keyword is near "no/without/negative for"
function isNegated(t, keyword) {
  const idx = t.indexOf(keyword);
  if (idx === -1) return false;

  // Look at a window before the keyword (common in radiology)
  const start = Math.max(0, idx - 40);
  const window = t.slice(start, idx);

  // Common negation cues
  const negators = [
    "no ",
    "without ",
    "negative for ",
    "not ",
    "absence of ",
    "free of ",
    "rule out ",
    "ruled out "
  ];

  return negators.some(n => window.includes(n));
}

function detectConditions(text) {
  const t = (text || "").toLowerCase();
  const detected = [];

  for (const [condition, keywords] of Object.entries(CONDITIONS)) {
    let found = false;

    for (const k of keywords) {
      if (!t.includes(k)) continue;

      // ✅ if the mention is negated, skip it
      if (isNegated(t, k)) continue;

      found = true;
      break;
    }

    if (found) detected.push(condition);
  }

  return detected;
}

module.exports = { detectConditions };
