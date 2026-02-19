export type SectionMap = Record<string, string>;
export type SimplifiedSectionsMap = Record<string, string>;

export type UmlsMention = {
  cui?: string;
  name?: string;
  score?: number;
  [key: string]: unknown;
};

export type GuidanceItem = {
  meaning?: string;
  overview?: string;
  why_it_matters?: string;
  common_symptoms?: string[];
  when_to_seek_help?: string[];
  [key: string]: unknown;
};

export type DiseaseExplanation = {
  meaning: string;
  why_it_matters: string;
  common_symptoms: string[];
  when_to_seek_help: string[];
  synonyms?: string[];
  confidence?: number;
};


export type ApiResponse = {
  filename: string;
  stored_path: string;
  text_length: number;
  report_type: string;
  sections: SectionMap;
  simplified_sections: SimplifiedSectionsMap;
  umls_mentions: UmlsMention[];
  detected_conditions: string[];
  radiology_findings: unknown[];

  // ✅ Support BOTH shapes during migration:
  guidance: Record<string, ConditionGuidance> | GuidancePacket;

  disease_explanations: Record<string, DiseaseExplanation>;
  live_nutrition?: LiveNutrition;
  extracted_text_preview: string;
  disclaimer: string;
};


export type ApiError = {
  error: string;
  details?: string;
};

export type ConditionGuidance = {
  meaning?: string;
  overview?: string;
  why_it_matters?: string;
  common_symptoms?: string[];
  when_to_seek_help?: string[];
  recommended_foods?: string[];
  foods_to_limit?: string[];
  lifestyle?: string[] | string;
  [key: string]: unknown;
};

export type GeneralGuidance = {
  overview?: string;
  recommended_foods?: string[];
  foods_to_limit?: string[];
  lifestyle?: string[] | string;
};

export type USDATopFood = {
  food: string;
  fdcId: number;
  amount: number;
  unit: string;
};

export type NutrientRecommendation = {
  key: string;
  priority?: number;
  why_needed?: string;
  foods?: string[];
  absorption_tip?: string;
  avoid_with?: string;

  top_foods?: USDATopFood[];

  [key: string]: unknown;
};



export type GuidancePacket = {
  matchedGuidance?: Record<string, ConditionGuidance>;
  generalGuidance?: GeneralGuidance;
  nutrients?: NutrientRecommendation[];
  safetyNotes?: string[];
  unknownConditions?: string[];
};


export type LiveNutritionSource = {
  title: string;
  url: string;
  snippet: string;
};

export type TopFood = {
  food: string;
  fdcId: number;
  amount: number;
  unit: string;
};

export type LiveNutrientPacket = {
  key: string;
  label: string;
  unit_hint?: string;
  top_foods: TopFood[];
};

export type LiveNutrition = {
  condition: string;
  sources: LiveNutritionSource[];
  nutrients_found?: string[];
  foods_ranked_by_usda?: Record<string, TopFood[]>;
  nutrients?: LiveNutrientPacket[];
};
