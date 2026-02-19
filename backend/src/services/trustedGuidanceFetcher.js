// backend/src/services/trustedGuidanceFetcher.js
const ALLOWED_HOSTS = new Set(["www.nhs.uk", "nhs.uk", "medlineplus.gov", "www.medlineplus.gov", "ods.od.nih.gov"]);

const pageCache = new Map(); // url -> { at, text }
const CACHE_MS = 1000 * 60 * 60 * 12; // 12 hours

function isAllowedUrl(url) {
  try {
    const u = new URL(url);
    return ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|li|h1|h2|h3|br|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

async function fetchText(url, { raw = false } = {}) {
  if (!isAllowedUrl(url)) throw new Error(`Blocked domain: ${url}`);

  const cached = pageCache.get(url);
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return raw ? cached.html : cached.text;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "MedicalReportAI/1.0 (educational)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  const html = await res.text();
  const text = stripHtml(html);

  pageCache.set(url, { at: now, html, text });
  return raw ? html : text;
}


function normalizeSlug(condition) {
  return String(condition)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * Try MedlinePlus direct page:
 * https://medlineplus.gov/<slug>.html
 */
async function tryMedlinePlus(condition) {
  const slug = normalizeSlug(condition);
  const url = `https://medlineplus.gov/${slug}.html`;
  try {
    const text = await fetchText(url);
    return { title: `MedlinePlus: ${condition}`, url, snippet: text.slice(0, 400), text };
  } catch {
    return null;
  }
}

/**
 * NHS search page:
 * https://www.nhs.uk/search/results?q=<query>
 * We'll fetch the HTML and use its text (good enough for nutrient mention detection).
 */
async function tryNhsSearch(condition) {
  const url = `https://www.nhs.uk/search/results?q=${encodeURIComponent(condition)}`;
  try {
    const html = await fetchText(url, { raw: true });
    const text = stripHtml(html);
    return { title: `NHS search: ${condition}`, url, snippet: text.slice(0, 400), text, html };
  } catch {
    return null;
  }
}



/**
 * NIH ODS nutrient fact sheets are by nutrient, not condition.
 * We'll fetch these for any nutrient we detect later, e.g.:
 * https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/
 */
async function fetchOdsFactSheet(nutrientTitleCase) {
  const url = `https://ods.od.nih.gov/factsheets/${encodeURIComponent(nutrientTitleCase)}-HealthProfessional/`;
  try {
    const text = await fetchText(url);
    return { title: `NIH ODS: ${nutrientTitleCase}`, url, snippet: text.slice(0, 400), text };
  } catch {
    return null;
  }
}

module.exports = {
  tryMedlinePlus,
  tryNhsSearch,
  fetchOdsFactSheet,
  fetchText,
};



function extractNhsResultLinks(htmlOrText) {
  // Works on raw HTML better than stripped text, but we only have stripped text now.
  // So we'll re-fetch raw HTML specifically for NHS search in next step.
  return [];
}
