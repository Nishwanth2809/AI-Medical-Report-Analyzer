import { useMemo } from "react";
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

// Simple heuristic tags just for UI pills (since backend doesn't provide severity)
function getPillsForCondition(): string[] {
  return ["Mild", "Normal"];
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function splitToItems(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (/\d+\.\s/.test(trimmed)) {
    return trimmed
      .split(/\d+\.\s/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (/[\u2022?]/.test(trimmed)) {
    return trimmed
      .split(/[\u2022?]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return trimmed
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}



export default function ResultsPage({ data, onBack }: Props) {


  // ---- Live Nutrition block ----
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

  const impressionItems = useMemo(() => {
    const simplified = data.simplified_sections ?? {};
    const sections = data.sections ?? {};

    const fromSimplified = Object.entries(simplified)
      .filter(([k, v]) => typeof v === "string" && k.toLowerCase().includes("impression"))
      .map(([, v]) => v);

    const fromSections = Object.entries(sections)
      .filter(([k, v]) => typeof v === "string" && k.toLowerCase().includes("impression"))
      .map(([, v]) => v);

    const source = (fromSimplified.length ? fromSimplified : fromSections).join("\n");
    return splitToItems(source).slice(0, 8);
  }, [data.sections, data.simplified_sections]);

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
                {typeof item === "string" ? toTitleCase(item) : JSON.stringify(item)}
              </div>
            ))}
          </div>
        ) : (
          <div className="rEmpty">No radiology findings detected.</div>
        )}
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
      {/* Impression (Conditions) */}
      <section className="rCard">
        <h2 className="rCardTitle">Impression (Conditions)</h2>

        <div className="rConditionsScroll">
          {impressionItems.length === 0 ? (
            <div className="rEmpty">No impression items found.</div>
          ) : (
            impressionItems.map((item, idx) => {
              const pills = getPillsForCondition();

              return (
                <div key={`impression-${idx}`} className="rConditionCard">
                  <div className="rConditionHeader">
                    <div className="rConditionName">{item}</div>

                    <div className="rPills">
                      {pills.map((p) => (
                        <span key={p} className="rPill">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rConditionText">{item}</div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rCard">
        <h2 className="rCardTitle">Nutrition for Recovery</h2>
        {liveNutritionInline}
      </section>


      <p className="rDisclaimer">{data.disclaimer}</p>
    </div>
  );
}


