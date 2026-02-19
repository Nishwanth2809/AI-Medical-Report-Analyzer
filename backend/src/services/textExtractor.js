const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");

async function loadTesseract() {
  const mod = await import("tesseract.js");
  return mod.default || mod;
}

async function loadPdfPoppler() {
  const mod = await import("pdf-poppler");
  return mod.default || mod;
}

async function ocrImage(imagePath) {
  const Tesseract = await loadTesseract();
  const result = await Tesseract.recognize(imagePath, "eng");
  return (result.data.text || "").trim();
}

async function extractTextFromPdf(filePath) {
  // 1) normal pdf text
  const buffer = fs.readFileSync(filePath);
  const parsed = await pdfParse(buffer);
  const text = (parsed.text || "").trim();
  if (text.length > 50) return text;

  // 2) OCR fallback (scanned pdf)
  const pdfPoppler = await loadPdfPoppler();

  const outputDir = path.join(path.dirname(filePath), `${path.basename(filePath)}_images`);
  fs.mkdirSync(outputDir, { recursive: true });

  await pdfPoppler.convert(filePath, {
    format: "png",
    out_dir: outputDir,
    out_prefix: "page",
    page: null
  });

  const images = fs
    .readdirSync(outputDir)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  let ocrText = "";
  for (const img of images) {
    const imgPath = path.join(outputDir, img);
    ocrText += (await ocrImage(imgPath)) + "\n";
  }

  return ocrText.trim();
}

async function extractText(filePath, ext) {
  ext = (ext || "").toLowerCase();

  if (ext === "pdf") return await extractTextFromPdf(filePath);
  if (["jpg", "jpeg", "png"].includes(ext)) return await ocrImage(filePath);
  if (ext === "txt") return fs.readFileSync(filePath, "utf8");

  return "";
}

module.exports = { extractText };
