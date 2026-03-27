import type { AnalysisOutput } from "@/lib/validators/analysis";

export const mockAnalysisInput = {
  patientInfo: {
    name: "Aashi",
    age: 25,
    sex: "Female",
    reportDate: "2026-03-17",
    inputSources: ["3 facial images", "Questionnaire"]
  },
  questionnaireText:
    "Reports mild dryness around the cheeks, uneven tone, and occasional post-acne marks.",
  rawFindingsText:
    "No active inflammatory acne. Visible dullness, mild pigmentation, and slight T-zone oiliness.",
  visibleIssues: ["Mild pigmentation", "Dullness", "Combination-zone oiliness"],
  negativeFindings: ["No cystic acne", "No barrier damage", "No deep scarring"],
  profileHints: ["Combination skin", "Concerned about tone uniformity"]
};

export const mockAnalysisOutput: AnalysisOutput = {
  skin_score: {
    score: 6.4,
    label: "Moderate (Needs improvement)"
  },
  overall_skin_profile: {
    skin_type: "Combination",
    condition: "Mild dehydration tendency with post-inflammatory pigmentation",
    overall_severity: "Mild"
  },
  key_skin_concerns: {
    primary: ["Uneven skin tone", "Pigmentation", "Dullness"],
    secondary: ["Mild clogged pores", "Texture irregularity"]
  },
  positive_findings: [
    "No active acne or breakouts",
    "No marked barrier sensitivity",
    "No deep scarring or wrinkles"
  ],
  primary_observations: {
    oil_levels: "Medium",
    hydration: "Low",
    texture: "Uneven",
    tone: "Uneven"
  }
};
