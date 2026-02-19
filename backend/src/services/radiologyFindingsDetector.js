const RADIOLOGY_FINDINGS = {
  fracture: ["fracture", "break", "cortical disruption"],
  stone: ["stone", "calculus"],
  cyst: ["cyst"],

  // ✅ avoid false positive from "mass effect"
  "mass/lesion": ["lesion", "nodule", "mass lesion", "space occupying", "space-occupying", "s.o.l", "sol"],

  inflammation: ["inflammation", "edema", "swelling", "mucosal thickening", "sinusitis"],
  infection: ["infection", "abscess"],
  "tumor suspicion": ["neoplasm", "malignancy", "metastasis"]
};

function detectRadiologyFindings(text = "") {
  const t = text.toLowerCase();
  const found = [];

  // ✅ special rule: ignore "mass effect"
  const safeText = t.replace(/\bmass effect\b/g, "");

  for (const [label, keys] of Object.entries(RADIOLOGY_FINDINGS)) {
    if (keys.some(k => safeText.includes(k))) found.push(label);
  }
  return found;
}

module.exports = { detectRadiologyFindings };
