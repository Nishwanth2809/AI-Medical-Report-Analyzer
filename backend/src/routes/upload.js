const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");

const { getLiveNutritionGuidanceFree } = require("../services/liveNutritionGuidanceFree");
const { simplifySections } = require("../services/simplifier");
const { tagUmlsConcepts } = require("../services/umlsDiseaseTagger");

const {
  conditionsFromUmls,
  bestDefinitionForCondition,
} = require("../services/umlsConditionExtractor");

const { detectConditions } = require("../services/conditionDetector");
const { detectRadiologyFindings } = require("../services/radiologyFindingsDetector");

const { extractText } = require("../services/textExtractor");
const { detectReportType } = require("../services/reportTypeDetector");
const { extractSections } = require("../services/sectionExtractor");

const router = express.Router();

// ✅ Always save uploads to backend/src/uploads (absolute path)
const UPLOAD_DIR = path.join(os.tmpdir(), "medical-uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({ storage });

function withTimeout(promise, ms, fallbackValue) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallbackValue), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function normalizeKey(s = "") {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ");
}

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase().replace(".", "");

    // 1) Extract text
    const extractedText = await extractText(filePath, ext);

    // 2) Report type + sections
    const reportType = detectReportType(extractedText);
    const sections = extractSections(extractedText);

    // 3) Simplify sections
    const simplified_sections = simplifySections(sections);

    // 4) UMLS mentions (optional)
    let umls_mentions = [];
    if (process.env.UMLS_API_KEY) {
      umls_mentions = await withTimeout(
        tagUmlsConcepts({ extractedText, sections }),
        10000,
        []
      );
    }

    // 5) Radiology findings
    const radiology_findings = detectRadiologyFindings(extractedText);

    // 6) Detect conditions (keywords + UMLS)
    const detected_from_keywords = detectConditions(extractedText);
    const detected_from_umls = conditionsFromUmls(umls_mentions);

    const detected_conditions = Array.from(
      new Set([...detected_from_keywords, ...detected_from_umls].map(normalizeKey))
    ).filter(Boolean);

    // 7) Disease explanations (NO rule-based)
    const disease_explanations = {};

    for (const c of detected_conditions) {
      const umlsDef = process.env.UMLS_API_KEY
        ? bestDefinitionForCondition(umls_mentions, c)
        : "";

      disease_explanations[c] = {
        meaning: umlsDef || "",
        why_it_matters: "",
        common_symptoms: [],
        when_to_seek_help: [],
      };
    }

    // Attach synonyms/confidence per mention (optional)
    for (const mention of umls_mentions) {
      const key = normalizeKey(mention.name || "");
      if (!key) continue;

      const prev = disease_explanations[key] || {
        meaning: "",
        why_it_matters: "",
        common_symptoms: [],
        when_to_seek_help: [],
      };

      disease_explanations[key] = {
        ...prev,
        synonyms: Array.isArray(mention.synonyms) ? mention.synonyms : [],
        confidence: mention.confidence,
        meaning: prev.meaning || mention.definition || "",
      };
    }

    // 8) Live Nutrition (UMLS category aware)
    const live_nutrition = await withTimeout(
      getLiveNutritionGuidanceFree({
        detectedConditions: detected_conditions,
        umlsMentions: umls_mentions,
      }),
      12000,
      {
        message: "Live nutrition timed out for this request",
        sources: [],
        nutrients_found: [],
        foods_ranked_by_usda: {},
        nutrients: [],
      }
    );

    // 9) Return response
    return res.json({
      filename: req.file.originalname,
      stored_path: filePath,
      text_length: extractedText.length,
      report_type: reportType,
      sections,
      simplified_sections,
      umls_mentions,
      detected_conditions,
      radiology_findings,
      disease_explanations,
      live_nutrition,
      extracted_text_preview: extractedText.slice(0, 800),
      disclaimer: "Educational only. Not medical advice. Consult a qualified doctor.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

module.exports = router;
