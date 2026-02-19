// src/services/umlsDiseaseTagger.js
const { searchTerm, getAtoms, getDefinitions } = require("./umlsClient");

// --------------------
// Helpers
// --------------------
function computeConfidence({ matchedText, whereFound, occurrences, searchType }) {
  let score = 0.35;

  if (searchType === "exact") score += 0.25;
  if (whereFound === "diagnosis_or_impression") score += 0.25;
  if (occurrences >= 2) score += 0.10;
  if (matchedText && matchedText.length > 3) score += 0.05;

  return Math.max(0, Math.min(1, score));
}

function countOccurrences(haystackLower, needleLower) {
  if (!needleLower) return 0;
  let count = 0;
  let idx = 0;
  while (true) {
    idx = haystackLower.indexOf(needleLower, idx);
    if (idx === -1) break;
    count++;
    idx += needleLower.length;
  }
  return count;
}

// Clean and filter candidates so we don't send long sentences to UMLS
function normalizeCandidate(s) {
  const x = (s || "").replace(/\s+/g, " ").trim();
  if (!x) return null;

  // Too short or too long
  if (x.length < 3 || x.length > 60) return null;

  // Too many words (UMLS search is best with short terms)
  const wordCount = x.split(" ").length;
  if (wordCount > 6) return null;

  const low = x.toLowerCase();

  // Skip common "normal/negative" sentences & boilerplate
  const badStarts = [
    "no acute",
    "no evidence",
    "negative for",
    "normal",
    "unremarkable",
    "within normal",
    "not seen",
    "absent",
    "nil"
  ];
  if (badStarts.some((b) => low.startsWith(b))) return null;

  // Skip things that look like dates/only numbers
  if (/^[\d\W]+$/.test(x)) return null;

  // Remove trailing words that are not helpful
  // Example: "sinusitis changes" -> keep as is (OK)
  // Example: "diagnosis:" -> removed earlier by splitting
  return x;
}

// Extract candidate phrases from your sections (best recall)
function candidateTermsFromSections(sections = {}) {
  const keys = ["final diagnosis", "diagnosis", "impression", "summary", "findings"];
  const candidates = new Set();

  for (const k of keys) {
    const txt = sections[k];
    if (!txt) continue;

    txt
      .replace(/\n+/g, " ")
      .split(/[;,\.\n]/) // split more aggressively
      .map((s) => s.trim())
      .map(normalizeCandidate)
      .filter(Boolean)
      .forEach((s) => candidates.add(s));
  }

  return Array.from(candidates);
}

// Safe wrapper so UMLS failures never crash your API
async function safeUmls(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    // Optional: log only status + message (avoid huge logs)
    const status = err?.response?.status;
    const msg = err?.response?.data?.message || err?.message;
    console.warn(`[UMLS] skipped due to error: ${status || ""} ${msg || ""}`.trim());
    return fallback;
  }
}

// --------------------
// Main tagger
// --------------------
async function tagUmlsConcepts({ extractedText, sections }) {
  // ✅ If key not available, skip silently
  if (!process.env.UMLS_API_KEY) return [];

  const candidates = candidateTermsFromSections(sections);
  const textLower = (extractedText || "").toLowerCase();

  const results = [];

  // Limit to avoid slow API calls
  for (const term of candidates.slice(0, 25)) {
    const termLower = term.toLowerCase();

    // 1) Search exact first
    let searchType = "exact";
    let search = await safeUmls(
      () => searchTerm(term, { searchType: "exact" }),
      { result: { results: [] } }
    );

    let items = search?.result?.results || [];

    // 2) Fallback to words search
    if (!items.length) {
      searchType = "words";
      search = await safeUmls(
        () => searchTerm(term, { searchType: "words" }),
        { result: { results: [] } }
      );
      items = search?.result?.results || [];
    }

    // best CUI result
    const best = items.find((r) => r?.ui && r.ui.startsWith("C"));
    if (!best) continue;

    const cui = best.ui;
    const name = best.name || term;

    // 3) Synonyms
    const atoms = await safeUmls(
      () => getAtoms(cui, { pageSize: 25 }),
      { result: [] }
    );
    const atomList = (atoms?.result || []).map((a) => a?.name).filter(Boolean);
    const synonyms = Array.from(new Set(atomList)).slice(0, 12);

    // 4) Definitions
    const defs = await safeUmls(
      () => getDefinitions(cui, { sabs: "MSH,SNOMEDCT_US,ICD10CM" }),
      { result: [] }
    );
    const defList = defs?.result || [];
    const definition = defList.length ? (defList[0].value || "") : "";

    // 5) Confidence
    const occurrences = countOccurrences(textLower, termLower);
    const whereFound = "diagnosis_or_impression"; // because candidates came from those sections
    const confidence = computeConfidence({
      matchedText: term,
      whereFound,
      occurrences,
      searchType
    });

    results.push({
      cui,
      name,
      matched_text: term,
      confidence,
      synonyms,
      definition
    });
  }

  // Merge duplicates by CUI (keep max confidence)
  const byCui = new Map();
  for (const r of results) {
    const prev = byCui.get(r.cui);
    if (!prev || r.confidence > prev.confidence) byCui.set(r.cui, r);
  }

  return Array.from(byCui.values()).sort((a, b) => b.confidence - a.confidence);
}

module.exports = { tagUmlsConcepts };
