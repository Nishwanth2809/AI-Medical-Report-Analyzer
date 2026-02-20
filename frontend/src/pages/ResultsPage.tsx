import { useMemo, useState } from "react";
import type { ApiResponse } from "../api/types";
import "./results.css";

type Props = {
  data: ApiResponse;
  onBack: () => void;
};

type NutritionFood = {
  fdcId: number | string;
  food: string;
  amount: number;
  unit: string;
};

type NutritionPacket = {
  key: string;
  label?: string;
  unit_hint?: string;
  top_foods?: NutritionFood[];
  foods?: string[];
};

const FALLBACK_FOODS_BY_NUTRIENT: Record<string, string[]> = {
  calcium: ["Milk", "Yogurt", "Sesame seeds"],
  vitamin_d: ["Salmon", "Egg yolk", "Fortified milk"],
  protein: ["Lentils", "Egg", "Chicken"],
  vitamin_c: ["Orange", "Guava", "Broccoli"],
  zinc: ["Pumpkin seeds", "Chickpeas", "Almonds"],
  iron: ["Spinach", "Lentils", "Sesame seeds"],
  folate: ["Lentils", "Broccoli", "Orange"],
  vitamin_b12: ["Egg", "Milk", "Cheese"],
};

// Simple heuristic tags just for UI pills (since backend doesn’t provide severity)
function getPillsForCondition(): string[] {
  return ["Mild", "Normal"];
}

function renderSmartText(text: string) {
  const trimmed = text.trim();

  // Detect numbered list (1. 2. 3.)
  const numberedMatch = trimmed.match(/\d+\.\s/g);
  if (numberedMatch && numberedMatch.length >= 1) {
    const items = trimmed
      .split(/\d+\.\s/)
      .map((s) => s.trim())
      .filter(Boolean);

    return (
      <ol className="rListOrdered">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>
    );
  }

  // Detect bullet list (•)
  if (trimmed.includes("•")) {
    const items = trimmed
      .split("•")
      .map((s) => s.trim())
      .filter(Boolean);

    return (
      <ul className="rListBullet">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }

  // Default → paragraph (supports line breaks)
  return <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{trimmed}</p>;
}

export default function ResultsPage({ data, onBack }: Props) {
  const [showPreview, setShowPreview] = useState(false);

  // ---- Description blocks in radiology-style headings ----
  const descriptionBlocks = useMemo(() => {
    const simplified = data.simplified_sections ?? {};
    const sectionKeys = Object.keys(data.sections ?? {});

    const clean = (s: string) =>
      s
        .replace(/\s*•\s*/g, "\n• ")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]+\n/g, "\n")
        .trim();

    const normalize = (k: string) => k.toLowerCase();

    const buckets: Array<{ label: string; keys: string[] }> = [
      {
        label: "Clinical History",
        keys: ["history", "clinical", "complaint", "indication", "present"],
      },
      { label: "Technique", keys: ["technique", "method", "procedure", "protocol", "contrast"] },
      { label: "Findings", keys: ["finding", "observation", "result", "brain", "sinus", "scan"] },
      {
        label: "Impression",
        keys: ["impression", "conclusion", "summary", "opinion", "recommendation"],
      },
    ];

    const orderedKeys = sectionKeys.length ? sectionKeys : Object.keys(simplified);

    const used = new Set<string>();
    const blocks: Array<{ heading: string; text: string }> = [];

    for (const b of buckets) {
      const matched = orderedKeys.filter((k) => {
        const nk = normalize(k);
        return b.keys.some((w) => nk.includes(w)) && typeof simplified[k] === "string";
      });

      const texts = matched
        .map((k) => {
          used.add(k);
          return simplified[k];
        })
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map(clean);

      if (texts.length) blocks.push({ heading: b.label, text: texts.join("\n\n") });
    }

    const remainingTexts = orderedKeys
      .filter((k) => !used.has(k))
      .map((k) => simplified[k])
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map(clean);

    if (remainingTexts.length) blocks.push({ heading: "Other Notes", text: remainingTexts.join("\n\n") });

    if (blocks.length === 0) {
      const combined = Object.values(simplified)
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map(clean)
        .join("\n\n");
      return combined ? [{ heading: "Report", text: combined }] : [];
    }

    return blocks;
  }, [data.sections, data.simplified_sections]);

  // ---- Symptoms & Cures from disease_explanations ----
  const symptomsAndCuresText = useMemo(() => {
    const explanations = data.disease_explanations ?? {};
    const keys = Object.keys(explanations);
    if (keys.length === 0) return "";

    return keys
      .map((cond) => {
        const e = explanations[cond];
        const symptoms = (e?.common_symptoms ?? []).filter(Boolean);
        const seekHelp = (e?.when_to_seek_help ?? []).filter(Boolean);

        return [
          `Condition: ${cond}`,
          e?.meaning ? `Meaning: ${e.meaning}` : "",
          e?.why_it_matters ? `Why it matters: ${e.why_it_matters}` : "",
          symptoms.length ? `Common symptoms: ${symptoms.join(", ")}` : "",
          seekHelp.length ? `When to seek help: ${seekHelp.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");
  }, [data.disease_explanations]);

  // ---- Live Nutrition block (to show INSIDE Symptoms & Cures) ----
  const liveNutritionInline = useMemo(() => {
    const ln = data.live_nutrition;
    const guidanceNutrients =
      data.guidance && "nutrients" in data.guidance && Array.isArray(data.guidance.nutrients)
        ? data.guidance.nutrients
        : [];

    const nutrientPackets: NutritionPacket[] =
      ln && Array.isArray(ln.nutrients) && ln.nutrients.length > 0
        ? (ln.nutrients as NutritionPacket[])
        : (guidanceNutrients as NutritionPacket[]);
    const sources = ln && Array.isArray(ln.sources) ? ln.sources : [];
    const nutritionMessage =
      (ln as { message?: string } | undefined)?.message ||
      "Nutrition data unavailable for this report.";

    return (
      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>
          Nutrition for Recovery (Live)
        </div>

        <div className="rConditionsScroll">
          {nutrientPackets.length > 0 ? (
            nutrientPackets.map((n) => (
              <div key={n.key} className="rConditionCard">
                <div className="rConditionHeader">
                  <div className="rConditionName">{"label" in n && n.label ? n.label : n.key}</div>
                  {"unit_hint" in n && n.unit_hint ? (
                    <div className="rPills">
                      <span className="rPill">{n.unit_hint}</span>
                    </div>
                  ) : null}
                </div>

                {Array.isArray(n.top_foods) && n.top_foods.length > 0 ? (
                  <div style={{ marginTop: 8 }}>
                    <strong>Top foods (USDA):</strong>
                    <ul className="rListBullet" style={{ marginTop: 6 }}>
                      {n.top_foods
                        .slice(0, 3)
                        .map((f: { fdcId: number | string; food: string; amount: number; unit: string }) => (
                        <li key={`${n.key}-${f.fdcId}`}>
                          {f.food} - {f.amount} {f.unit} (per 100g)
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : Array.isArray(n.foods) && n.foods.length > 0 ? (
                  <div style={{ marginTop: 8 }}>
                    <strong>Recommended foods:</strong>
                    <ul className="rListBullet" style={{ marginTop: 6 }}>
                      {n.foods.slice(0, 3).map((food) => (
                        <li key={`${n.key}-${food}`}>{food}</li>
                      ))}
                    </ul>
                  </div>
                ) : Array.isArray(FALLBACK_FOODS_BY_NUTRIENT[n.key]) ? (
                  <div style={{ marginTop: 8 }}>
                    <strong>Suggested foods:</strong>
                    <ul className="rListBullet" style={{ marginTop: 6 }}>
                      {FALLBACK_FOODS_BY_NUTRIENT[n.key].slice(0, 3).map((food) => (
                        <li key={`${n.key}-fallback-${food}`}>{food}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rEmpty">No USDA foods found for this nutrient.</div>
                )}
              </div>
            ))
          ) : (
            <div className="rEmpty">{nutritionMessage}</div>
          )}
        </div>

        {sources.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Sources</div>
            <ul className="rListBullet" style={{ margin: 0 }}>
              {sources.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }, [data.guidance, data.live_nutrition]);

  const conditions = useMemo(() => data.detected_conditions ?? [], [data.detected_conditions]);

  return (
    <div className="rPage">
      <div className="rTopBar">
        <button type="button" className="rBackBtn" onClick={onBack}>
          ← Upload Another
        </button>
      </div>

      <div className="rHeader">
        <h1 className="rTitle">Analysis Results</h1>
        <p className="rSubtitle">Your medical report has been simplified for easy understanding</p>
      </div>

      {/* Radiology Findings */}
      <section className="rCard">
        <h2 className="rCardTitle">Radiology</h2>

        {Array.isArray(data.radiology_findings) && data.radiology_findings.length > 0 ? (
          <div className="rRadiologyBox">
            {data.radiology_findings.map((item, index) => (
              <div key={index} className="rRadiologyItem">
                {typeof item === "string" ? item : JSON.stringify(item)}
              </div>
            ))}
          </div>
        ) : (
          <div className="rEmpty">No radiology findings detected.</div>
        )}
      </section>

      {/* Description (Simplified) */}
      <section className="rCard">
        <h2 className="rCardTitle">Description (Simplified)</h2>

        <div className="rReport">
          {descriptionBlocks.length === 0 ? (
            <div className="rEmpty">No simplified description available.</div>
          ) : (
            descriptionBlocks.map((b) => (
              <div key={b.heading} className="rReportSection">
                <div className="rReportHeading">{b.heading}</div>
                <div className="rReportText">{renderSmartText(b.text)}</div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Detected Conditions */}
      <section className="rCard">
        <h2 className="rCardTitle">Detected Conditions</h2>

        <div className="rConditionsScroll">
          {conditions.length === 0 ? (
            <div className="rEmpty">No conditions detected.</div>
          ) : (
            conditions.map((c) => {
              const pills = getPillsForCondition();
              const exp = data.disease_explanations?.[c.toLowerCase().trim()];

              const body =
                exp?.meaning ||
                exp?.why_it_matters ||
                "Condition detected in the report. Consult your doctor for clinical interpretation.";

              return (
                <div key={c} className="rConditionCard">
                  <div className="rConditionHeader">
                    <div className="rConditionName">
                      {c
                        .toLowerCase()
                        .split(" ")
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(" ")}
                    </div>

                    <div className="rPills">
                      {pills.map((p) => (
                        <span key={p} className="rPill">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rConditionText">{body}</div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Symptoms and Cures Preview */}
      <section className="rCard">
        <div className="rPreviewRow">
          <h2 className="rCardTitle" style={{ margin: 0 }}>
            Symptoms and Cures
          </h2>

          <button
            type="button"
            className="rPreviewBtn"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? "Hide Preview" : "Preview"}
          </button>
        </div>

        {showPreview && (
          <div className="rPreviewBox">
            <div style={{ whiteSpace: "pre-wrap", marginBottom: 16 }}>
              {symptomsAndCuresText.trim() ||
                (data.extracted_text_preview?.trim() ?? "") ||
                "No details available."}
            </div>

            {/* ✅ LIVE Nutrition goes here */}
            {liveNutritionInline}
          </div>
        )}
      </section>

      <p className="rDisclaimer">{data.disclaimer}</p>
    </div>
  );
}

