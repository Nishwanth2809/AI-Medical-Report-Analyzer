// import { useMemo, useState} from "react";
// import type {
//   ApiResponse,
//   GuidancePacket,
//   ConditionGuidance,
//   NutrientRecommendation
// } from "../api/types";
// import "./results.css";



// type Props = {
//   data: ApiResponse;
//   onBack: () => void;
// };


// function isGuidancePacket(
//   g: ApiResponse["guidance"]
// ): g is GuidancePacket {
//   return !!g && typeof g === "object" && "matchedGuidance" in g;
// }

// // Simple heuristic tags just for UI pills (since backend doesn’t provide severity)
// function getPillsForCondition(): string[] {
//   return ["Mild", "Normal"];
// }

// // function formatLabel(key: string) {
// //   return key
// //     .replace(/_/g, " ")
// //     .replace(/\b\w/g, (c) => c.toUpperCase());
// // }

// function renderSmartText(text: string) {
//   const trimmed = text.trim();

//   // Detect numbered list (1. 2. 3.)
//   const numberedMatch = trimmed.match(/\d+\.\s/g);
//   if (numberedMatch && numberedMatch.length >= 1) {
//     const items = trimmed
//       .split(/\d+\.\s/)
//       .map((s) => s.trim())
//       .filter(Boolean);

//     return (
//       <ol className="rListOrdered">
//         {items.map((item, i) => (
//           <li key={i}>{item}</li>
//         ))}
//       </ol>
//     );
//   }

//   // Detect bullet list (•)
//   if (trimmed.includes("•")) {
//     const items = trimmed
//       .split("•")
//       .map((s) => s.trim())
//       .filter(Boolean);

//     return (
//       <ul className="rListBullet">
//         {items.map((item, i) => (
//           <li key={i}>{item}</li>
//         ))}
//       </ul>
//     );
//   }

//   // Default → paragraph (supports line breaks)
//   return <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{trimmed}</p>;
// }

// export default function ResultsPage({ data, onBack }: Props) {
//   const [showPreview, setShowPreview] = useState(false);

//   // ---- Description blocks in radiology-style headings ----
//   const descriptionBlocks = useMemo(() => {
//     const simplified = data.simplified_sections ?? {};
//     const sectionKeys = Object.keys(data.sections ?? {});

//     const clean = (s: string) =>
//       s
//         .replace(/\s*•\s*/g, "\n• ")
//         .replace(/\n{3,}/g, "\n\n")
//         .replace(/[ \t]+\n/g, "\n")
//         .trim();

//     const normalize = (k: string) => k.toLowerCase();

//     const buckets: Array<{ label: string; keys: string[] }> = [
//       { label: "Clinical History", keys: ["history", "clinical", "complaint", "indication", "present"] },
//       { label: "Technique", keys: ["technique", "method", "procedure", "protocol", "contrast"] },
//       { label: "Findings", keys: ["finding", "observation", "result", "brain", "sinus", "scan"] },
//       { label: "Impression", keys: ["impression", "conclusion", "summary", "opinion", "recommendation"] },
//     ];

//     const orderedKeys = sectionKeys.length ? sectionKeys : Object.keys(simplified);

//     const used = new Set<string>();
//     const blocks: Array<{ heading: string; text: string }> = [];

//     for (const b of buckets) {
//       const matched = orderedKeys.filter((k) => {
//         const nk = normalize(k);
//         return b.keys.some((w) => nk.includes(w)) && typeof simplified[k] === "string";
//       });

//       const texts = matched
//         .map((k) => {
//           used.add(k);
//           return simplified[k];
//         })
//         .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
//         .map(clean);

//       if (texts.length) blocks.push({ heading: b.label, text: texts.join("\n\n") });
//     }

//     const remainingTexts = orderedKeys
//       .filter((k) => !used.has(k))
//       .map((k) => simplified[k])
//       .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
//       .map(clean);

//     if (remainingTexts.length) blocks.push({ heading: "Other Notes", text: remainingTexts.join("\n\n") });

//     if (blocks.length === 0) {
//       const combined = Object.values(simplified)
//         .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
//         .map(clean)
//         .join("\n\n");
//       return combined ? [{ heading: "Report", text: combined }] : [];
//     }

//     return blocks;
//   }, [data.sections, data.simplified_sections]);

//   // ---- Symptoms & Cures from disease_explanations ----
//   const symptomsAndCuresText = useMemo(() => {
//     const explanations = data.disease_explanations ?? {};
//     const keys = Object.keys(explanations);
//     if (keys.length === 0) return "";

//     return keys
//       .map((cond) => {
//         const e = explanations[cond];
//         const symptoms = (e?.common_symptoms ?? []).filter(Boolean);
//         const seekHelp = (e?.when_to_seek_help ?? []).filter(Boolean);

//         return [
//           `Condition: ${cond}`,
//           e?.meaning ? `Meaning: ${e.meaning}` : "",
//           e?.why_it_matters ? `Why it matters: ${e.why_it_matters}` : "",
//           symptoms.length ? `Common symptoms: ${symptoms.join(", ")}` : "",
//           seekHelp.length ? `When to seek help: ${seekHelp.join(", ")}` : "",
//         ]
//           .filter(Boolean)
//           .join("\n");
//       })
//       .join("\n\n");
//   }, [data.disease_explanations]);
// // ---- Guidance + Nutrition block (Foods, Lifestyle, Nutrients) ----
// const guidanceBlocks = useMemo(() => {
//   const packet: GuidancePacket = isGuidancePacket(data.guidance)
//   ? data.guidance
//   : { matchedGuidance: data.guidance };

// const matched: Record<string, ConditionGuidance> = packet.matchedGuidance ?? {};
// const general = packet.generalGuidance ?? null;
// const nutrients: NutrientRecommendation[] = packet.nutrients ?? [];
// const safetyNotes: string[] = packet.safetyNotes ?? [];


//   const matchedKeys = Object.keys(matched).filter(Boolean);
//   const hasRuleBased = matchedKeys.length > 0;


//   const hasAny =
//     matchedKeys.length > 0 ||
//     !!general ||
//     nutrients.length > 0 ||
//     safetyNotes.length > 0;

//   if (!hasAny) return null;

//   const titleStyle: React.CSSProperties = { fontWeight: 900, fontSize: 18, marginBottom: 8 };
//   const sectionTitleStyle: React.CSSProperties = { fontWeight: 800, marginTop: 14, marginBottom: 8 };

//   function renderList(label: string, items: string[]) {
//     if (!items.length) return null;
//     return (
//       <div style={{ marginTop: 6 }}>
//         <strong>{label}:</strong>
//         <ul className="rListBullet" style={{ marginTop: 6 }}>
//           {items.map((x, i) => (
//             <li key={i}>{x}</li>
//           ))}
//         </ul>
//       </div>
//     );
//   }

//   function renderLifestyle(value: unknown) {
//     // your JSON uses lifestyle as array; keep string support too
//     const items = Array.isArray(value)
//       ? value.filter(Boolean)
//       : typeof value === "string"
//         ? value.split(/\n|,/) // simple split
//         : [];

//     return renderList("Lifestyle", items);
//   }

//   return (
//     <div style={{ marginTop: 16 }}>
//       <div style={titleStyle}>Guidance (Foods, Lifestyle & Nutrition)</div>

//       {/* Safety Notes */}
//       {safetyNotes.length > 0 && (
//         <div className="rRadiologyBox" style={{ marginBottom: 12 }}>
//           <div style={{ fontWeight: 800, marginBottom: 6 }}>Safety Notes</div>
//           <ul className="rListBullet" style={{ margin: 0 }}>
//             {safetyNotes.map((n, i) => (
//               <li key={i}>{n}</li>
//             ))}
//           </ul>
//         </div>
//       )}

//       {/* Nutrients (optional) */}
//       {/* Nutrients (only if NO rule-based guidance) */}
// {/* Nutrients (only when NO rule-based guidance AND nutrients exist) */}
// {!hasRuleBased && nutrients.length > 0 && (
//   <>
//     <div style={sectionTitleStyle}>Nutrients to Focus On</div>

//     <div className="rConditionsScroll">
//       {nutrients.map((n) => (
//         <div key={n.key} className="rConditionCard">
//           <div className="rConditionHeader">
//             <div className="rConditionName">
//               {n.key
//                 .replace(/_/g, " ")
//                 .split(" ")
//                 .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
//                 .join(" ")}
//             </div>
//           </div>

//           {n.why_needed && <div className="rConditionText">{n.why_needed}</div>}

//           {Array.isArray(n.top_foods) && n.top_foods.length > 0 && (
//             <div style={{ marginTop: 8 }}>
//               <strong>Top foods (USDA):</strong>
//               <ul className="rListBullet" style={{ marginTop: 6 }}>
//                 {n.top_foods.map((f, i) => (
//                   <li key={i}>
//                     {f.food} — {f.amount} {f.unit} (per 100g)
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           )}
//         </div>
//       ))}
//     </div>
//   </>
// )}


//       {nutrients.length === 0 ? (
//         <div className="rEmpty">
//           No condition-specific nutrients found yet. Showing general diet guidance below.
//         </div>
//       ) : (
//         <div className="rConditionsScroll">
//           {nutrients.map((n) => (
//             <div key={n.key} className="rConditionCard">
//               <div className="rConditionHeader">
//                 <div className="rConditionName">
//                   {(n.key || "")
//                     .toString()
//                     .replace(/_/g, " ")
//                     .split(" ")
//                     .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
//                     .join(" ")}
//                 </div>
//                 {/* optional priority pill */}
//                 {typeof n.priority === "number" && (
//                   <div className="rPills">
//                     <span className="rPill">{Math.round(n.priority * 100)}%</span>
//                   </div>
//                 )}
//               </div>

//               {n.why_needed && <div className="rConditionText">{n.why_needed}</div>}

//               {Array.isArray(n.foods) && n.foods.length > 0 && (
//                 <div style={{ marginTop: 8 }}>
//                   <strong>Foods:</strong> {n.foods.join(", ")}
//                 </div>
//               )}

//               {n.absorption_tip && (
//                 <div style={{ marginTop: 6 }}>
//                   <strong>Tip:</strong> {n.absorption_tip}
//                 </div>
//               )}

//               {n.avoid_with && (
//                 <div style={{ marginTop: 6 }}>
//                   <strong>Avoid with:</strong> {n.avoid_with}
//                 </div>
//               )}
//               {Array.isArray(n.top_foods) && n.top_foods.length > 0 && (
//   <div style={{ marginTop: 8 }}>
//     <strong>Top foods (USDA):</strong>
//     <ul className="rListBullet" style={{ marginTop: 6 }}>
//       {n.top_foods.map((f: { food: string; amount: number; unit: string }, i: number) => (
//         <li key={i}>
//           {f.food} — {f.amount} {f.unit} (per 100g)
//         </li>
//       ))}
//     </ul>
//   </div>
// )}

//             </div>
//           ))}
//         </div>
//       )}

//       {/* Condition-specific foods/lifestyle */}
//       {matchedKeys.length > 0 && (
//         <>
//           {matchedKeys.map((cond) => {
//             const item = matched[cond];
//             if (!item) return null;

//             const recommended = Array.isArray(item.recommended_foods)
//               ? item.recommended_foods
//               : [];
//             const limit = Array.isArray(item.foods_to_limit) ? item.foods_to_limit : [];

//             if (!recommended.length && !limit.length && !item.lifestyle) return null;

//             return (
//               <div key={cond} style={{ marginBottom: 16 }}>
//                 <div style={{ fontWeight: 800, marginBottom: 6 }}>
//                   {cond
//                     .split(" ")
//                     .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
//                     .join(" ")}
//                 </div>

//                 {renderList("Recommended foods", recommended)}
//                 {renderList("Foods to limit", limit)}
//                 {renderLifestyle(item.lifestyle)}
//               </div>
//             );
//           })}
//         </>
//       )}

// {/* General fallback guidance (always safe) */}
// {!hasRuleBased && general && (
//   <>
//     <div style={sectionTitleStyle}>General Guidance</div>
//     {general.overview && <div className="rConditionText">{general.overview}</div>}
//     {renderList("Recommended foods", general.recommended_foods || [])}
//     {renderList("Foods to limit", general.foods_to_limit || [])}
//     {renderLifestyle(general.lifestyle)}

//   </>
// )}
//     </div>
//   );
// }, [data.guidance]);

// const liveNutritionBlock = useMemo(() => {
//   const ln = data.live_nutrition;
//   if (!ln || !Array.isArray(ln.nutrients) || ln.nutrients.length === 0) return null;

//   return (
//     <section className="rCard">
//       <h2 className="rCardTitle">Live Nutrition (NHS + NIH ODS + USDA)</h2>

//       <div className="rConditionsScroll">
//         {ln.nutrients.map((n) => (
//           <div key={n.key} className="rConditionCard">
//             <div className="rConditionHeader">
//               <div className="rConditionName">
//                 {n.label || n.key}
//               </div>
//               {n.unit_hint && (
//                 <div className="rPills">
//                   <span className="rPill">{n.unit_hint}</span>
//                 </div>
//               )}
//             </div>

//             {Array.isArray(n.top_foods) && n.top_foods.length > 0 ? (
//               <div style={{ marginTop: 8 }}>
//                 <strong>Top foods (USDA):</strong>
//                 <ul className="rListBullet" style={{ marginTop: 6 }}>
//                   {n.top_foods.map((f) => (
//                     <li key={`${n.key}-${f.fdcId}`}>
//                       {f.food} — {f.amount} {f.unit} (per 100g)
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//             ) : (
//               <div className="rEmpty">No USDA foods found for this nutrient.</div>
//             )}
//           </div>
//         ))}
//       </div>

//       {Array.isArray(ln.sources) && ln.sources.length > 0 && (
//         <div style={{ marginTop: 14 }}>
//           <div style={{ fontWeight: 800, marginBottom: 6 }}>Sources</div>
//           <ul className="rListBullet" style={{ margin: 0 }}>
//             {ln.sources.map((s, i) => (
//               <li key={i}>
//                 <a href={s.url} target="_blank" rel="noreferrer">
//                   {s.title}
//                 </a>
//               </li>
//             ))}
//           </ul>
//         </div>
//       )}
//     </section>
//   );
// }, [data.live_nutrition]);
// // 👆👆 END HERE


// const conditions = useMemo(() => data.detected_conditions ?? [], [data.detected_conditions]);

//   return (
//     <div className="rPage">
//       <div className="rTopBar">
//         <button type="button" className="rBackBtn" onClick={onBack}>
//           ← Upload Another
//         </button>
//       </div>

//       <div className="rHeader">
//         <h1 className="rTitle">Analysis Results</h1>
//         <p className="rSubtitle">Your medical report has been simplified for easy understanding</p>
//       </div>


//       {/* Radiology Findings */}
//       <section className="rCard">
//         <h2 className="rCardTitle">Radiology</h2>

//         {Array.isArray(data.radiology_findings) &&
//         data.radiology_findings.length > 0 ? (
//           <div className="rRadiologyBox">
//             {data.radiology_findings.map((item, index) => (
//               <div key={index} className="rRadiologyItem">
//                 {typeof item === "string"
//                   ? item
//                   : JSON.stringify(item)}
//               </div>
//             ))}
//           </div>
//         ) : (
//           <div className="rEmpty">No radiology findings detected.</div>
//         )}
//       </section>
//         {liveNutritionBlock}

//       {/* Description (Simplified) */}
//       <section className="rCard">
//         <h2 className="rCardTitle">Description (Simplified)</h2>

//         <div className="rReport">
//           {descriptionBlocks.length === 0 ? (
//             <div className="rEmpty">No simplified description available.</div>
//           ) : (
//             descriptionBlocks.map((b) => (
//               <div key={b.heading} className="rReportSection">
//                 <div className="rReportHeading">{b.heading}</div>
//                 <div className="rReportText">{renderSmartText(b.text)}</div>
//               </div>
//             ))
//           )}
//         </div>
//       </section>

//       {/* Detected Conditions */}
//       <section className="rCard">
//         <h2 className="rCardTitle">Detected Conditions</h2>

//         <div className="rConditionsScroll">
//           {conditions.length === 0 ? (
//             <div className="rEmpty">No conditions detected.</div>
//           ) : (
//             conditions.map((c) => {
//               const pills = getPillsForCondition();
//               const exp = data.disease_explanations?.[c.toLowerCase().trim()];

//               const body =
//                 exp?.meaning ||
//                 exp?.why_it_matters ||
//                 "Condition detected in the report. Consult your doctor for clinical interpretation.";

//               return (
//                 <div key={c} className="rConditionCard">
//                   <div className="rConditionHeader">
//                     <div className="rConditionName">
//                       {c
//                         .toLowerCase()
//                         .split(" ")
//                         .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
//                         .join(" ")}
//                     </div>

//                     <div className="rPills">
//                       {pills.map((p) => (
//                         <span key={p} className="rPill">
//                           {p}
//                         </span>
//                       ))}
//                     </div>
//                   </div>

//                   <div className="rConditionText">{body}</div>
//                 </div>
//               );
//             })
//           )}
//         </div>
//       </section>


//       {/* Symptoms and Cures Preview */}
//       <section className="rCard">
//         <div className="rPreviewRow">
//           <h2 className="rCardTitle" style={{ margin: 0 }}>
//             Symptoms and Cures
//           </h2>

//           <button
//             type="button"
//             className="rPreviewBtn"
//             onClick={() => setShowPreview((v) => !v)}
//           >
//             {showPreview ? "Hide Preview" : "Preview"}
//           </button>
//         </div>

//         {/* ✅ Use div (not pre) + CSS will show full content */}
//         {showPreview && (
//   <div className="rPreviewBox">
//     <div style={{ whiteSpace: "pre-wrap", marginBottom: 16 }}>
//       {symptomsAndCuresText.trim() ||
//         (data.extracted_text_preview?.trim() ?? "") ||
//         "No details available."}
//     </div>

//     {guidanceBlocks}
//   </div>
// )}


//       </section>

//       <p className="rDisclaimer">{data.disclaimer}</p>
//     </div>
//   );
// }

import { useMemo, useState } from "react";
import type { ApiResponse } from "../api/types";
import "./results.css";

type Props = {
  data: ApiResponse;
  onBack: () => void;
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
    if (!ln || !Array.isArray(ln.nutrients) || ln.nutrients.length === 0) return null;

    return (
      <div style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>
          Nutrition for Recovery (Live)
        </div>

        <div className="rConditionsScroll">
          {ln.nutrients.map((n) => (
            <div key={n.key} className="rConditionCard">
              <div className="rConditionHeader">
                <div className="rConditionName">{n.label || n.key}</div>
                {n.unit_hint ? (
                  <div className="rPills">
                    <span className="rPill">{n.unit_hint}</span>
                  </div>
                ) : null}
              </div>

              {Array.isArray(n.top_foods) && n.top_foods.length > 0 ? (
                <div style={{ marginTop: 8 }}>
                  <strong>Top foods (USDA):</strong>
                  <ul className="rListBullet" style={{ marginTop: 6 }}>
                    {n.top_foods.map((f) => (
                      <li key={`${n.key}-${f.fdcId}`}>
                        {f.food} — {f.amount} {f.unit} (per 100g)
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rEmpty">No USDA foods found for this nutrient.</div>
              )}
            </div>
          ))}
        </div>

        {Array.isArray(ln.sources) && ln.sources.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>Sources</div>
            <ul className="rListBullet" style={{ margin: 0 }}>
              {ln.sources.map((s, i) => (
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
  }, [data.live_nutrition]);

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
