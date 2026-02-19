function extractSections(text = "") {
  const raw = text.replace(/\r/g, "");
  const lines = raw.split("\n").map(l => l.trim());

  // headings we want to capture (common in MRI/CT/Discharge)
  const HEADINGS = [
    "summary",
    "admission date",
    "discharge date",
    "final diagnosis",
    "diagnosis",
    "clinical history",
    "history",
    "indication",
    "technique",
    "findings",
    "impression",
    "conclusion",
    "opinion",
    "hospital course",
    "medications on discharge",
    "medications",
    "advice on discharge",
    "advice",
    "follow up",
    "follow-up"
  ];

  const normalizeHeading = (h) =>
    h.toLowerCase()
     .replace(/[:\-]+$/, "")
     .replace(/\s+/g, " ")
     .trim();

  const isHeadingLine = (line) => {
    const n = normalizeHeading(line);
    if (!n) return false;

    // matches "FINDINGS:" / "IMPRESSION" / "Clinical History -"
    const n2 = n.replace(/[:\-]+$/g, "");
    return HEADINGS.includes(n2);
  };

  const sections = {};
  let current = "full_text";
  sections[current] = [];

  for (const line of lines) {
    if (isHeadingLine(line)) {
      current = normalizeHeading(line).replace(/[:\-]+$/g, "");
      if (!sections[current]) sections[current] = [];
      continue;
    }
    if (line) sections[current].push(line);
  }

  // join
  const out = {};
  for (const [k, arr] of Object.entries(sections)) {
    out[k] = arr.join("\n").trim();
  }

  return out;
}

module.exports = { extractSections };
