function detectReportType(text = "") {
  const t = text.toLowerCase();

  const has = (...words) => words.some(w => t.includes(w));

  // Radiology cues
  const isMRI = has("mri", "magnetic resonance");
  const isCT = has("ct", "computed tomography");
  const isUSG = has("ultrasound", "sonography", "usg");
  const isXRAY = has("x-ray", "xray", "radiograph");

  const hasFindings = has("findings", "impression", "conclusion");
  const hasDischarge = has("discharge summary", "hospital course", "medications on discharge", "advice on discharge");

  if (hasDischarge) return "discharge_summary";

  if (isMRI && hasFindings) return "mri_report";
  if (isCT && hasFindings) return "ct_report";
  if (isUSG && hasFindings) return "ultrasound_report";
  if (isXRAY && hasFindings) return "xray_report";

  // Fallbacks
  if (hasFindings) return "radiology_report";
  return "unknown";
}

module.exports = { detectReportType };
