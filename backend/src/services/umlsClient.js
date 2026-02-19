// src/services/umlsClient.js
const axios = require("axios");
const NodeCache = require("node-cache");

const UMLS_BASE = "https://uts-ws.nlm.nih.gov/rest";
const VERSION = "current";

const cache = new NodeCache({ stdTTL: 60 * 20 }); // 20 min

function mustGetApiKey() {
  const key = process.env.UMLS_API_KEY;
  if (!key) throw new Error("UMLS_API_KEY is missing. Set it in your environment.");
  return key;
}

async function utsGet(path, params = {}) {
  const apiKey = mustGetApiKey();
  const url = `${UMLS_BASE}${path}`;

  try {
    const resp = await axios.get(url, {
      params: { ...params, apiKey },
      timeout: 15000, // ✅ prevent hanging forever
    });
    return resp.data;
  } catch (err) {
    const status = err?.response?.status;

    // ✅ Treat these as "no data" instead of crashing your API
    if (status === 404) return { result: [] };

    // Optional: if UMLS is rate-limiting or temporarily failing,
    // return empty so your app still works.
    if (status === 401 || status === 403 || status === 429 || (status >= 500 && status <= 599)) {
      return { result: [] };
    }

    throw err;
  }
}

async function searchTerm(term, { searchType = "exact", sabs = "SNOMEDCT_US,ICD10CM" } = {}) {
  const t = (term || "").trim();
  if (!t) return { result: { results: [] } };

  const cacheKey = `search:${searchType}:${sabs}:${t.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await utsGet(`/search/${VERSION}`, {
    string: t,
    searchType,
    sabs,
    pageSize: 10
  });

  cache.set(cacheKey, data);
  return data;
}

async function getAtoms(cui, { sabs = "SNOMEDCT_US,ICD10CM", pageSize = 25 } = {}) {
  const cacheKey = `atoms:${cui}:${sabs}:${pageSize}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await utsGet(`/content/${VERSION}/CUI/${cui}/atoms`, { sabs, pageSize });
  cache.set(cacheKey, data);
  return data;
}

async function getDefinitions(cui, { sabs = "MSH,SNOMEDCT_US,ICD10CM" } = {}) {
  const cacheKey = `defs:${cui}:${sabs}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await utsGet(`/content/${VERSION}/CUI/${cui}/definitions`, { sabs, pageSize: 10 });
  cache.set(cacheKey, data);
  return data;
}

module.exports = { searchTerm, getAtoms, getDefinitions };
