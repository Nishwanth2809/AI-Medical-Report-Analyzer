const SIMPLE_REPLACEMENTS = [
  {
    pattern: /mild mucosal thickening/gi,
    replace: "mild swelling of the sinus lining"
  },
  {
    pattern: /bilateral/gi,
    replace: "on both sides"
  },
  {
    pattern: /maxillary sinuses/gi,
    replace: "sinuses near the nose"
  },
  {
    pattern: /no acute intracranial abnormality/gi,
    replace: "no serious problem inside the brain was found"
  },
  {
    pattern: /no mass effect or midline shift/gi,
    replace: "no pressure or displacement of brain structures"
  },
  {
    pattern: /ventricles are normal in size and configuration/gi,
    replace: "fluid spaces in the brain appear normal"
  },
  {
    pattern: /no evidence of/gi,
    replace: "there is no sign of"
  },
  {
    pattern: /hemorrhage/gi,
    replace: "bleeding"
  },
  {
    pattern: /infarct/gi,
    replace: "stroke-related damage"
  }
];

function simplifyText(text = "") {
  let simplified = text;

  for (const rule of SIMPLE_REPLACEMENTS) {
    simplified = simplified.replace(rule.pattern, rule.replace);
  }

  // Clean formatting
  simplified = simplified
    .replace(/\s+/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();

  return simplified;
}

function simplifySections(sections = {}) {
  const out = {};

  for (const [key, value] of Object.entries(sections)) {
    if (!value) {
      out[key] = value;
      continue;
    }

    out[key] = simplifyText(value);
  }

  return out;
}

module.exports = { simplifySections };
