import { analysisJsonSchema } from "@/lib/validators/analysis";
import type { CreateReportInputDto } from "@/lib/report/types";
import { mockAnalysisInput, mockAnalysisOutput } from "@/lib/ai/mock-data";

export type AnalysisPromptPayload = {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: typeof analysisJsonSchema;
  sampleInput: typeof mockAnalysisInput;
  sampleOutput: typeof mockAnalysisOutput;
};

export function buildAnalysisPrompt(input: CreateReportInputDto): AnalysisPromptPayload {
  const sources = input.patientInfo.inputSources.join(", ");
  const visibleIssues = input.assets.visibleIssues.length
    ? input.assets.visibleIssues.join("; ")
    : "None provided";
  const negativeFindings = input.assets.negativeFindings.length
    ? input.assets.negativeFindings.join("; ")
    : "None provided";
  const profileHints = input.assets.profileHints.length
    ? input.assets.profileHints.join("; ")
    : "None provided";

  return {
    systemPrompt: [
      "You are generating a dermatologist-style skin analysis.",
      "Return valid JSON only.",
      "Do not return markdown, prose, or explanations.",
      "Do not add extra keys.",
      "Fill only the analysis fields defined by the schema.",
      "Use concise, professional dermatologist-style wording.",
      "Calculate skin_score.score as the average of five internal parameter scores: Acne / Breakouts, Pigmentation / Dark Spots, Texture and Pores, Oiliness / Hydration, and Sensitivity / Redness.",
      "Return only the final average score rounded to one decimal place and the matching score label from the schema."
    ].join(" "),
    userPrompt: [
      "Generate a structured skin analysis JSON that matches the provided schema exactly.",
      `Patient name: ${input.patientInfo.name}`,
      `Age: ${input.patientInfo.age}`,
      `Sex: ${input.patientInfo.sex}`,
      `Report date: ${input.patientInfo.reportDate}`,
      `Input sources: ${sources}`,
      `Questionnaire/manual findings: ${input.assets.questionnaireText || "None provided"}`,
      `Visible issues: ${visibleIssues}`,
      `Negative findings: ${negativeFindings}`,
      `Optional profile hints: ${profileHints}`,
      `Raw findings text: ${input.assets.rawFindingsText || "None provided"}`,
      "Scoring rubric:",
      "- Acne / Breakouts: 9-10 Clear skin | 7-8 Rare pimples | 5-6 Occasional acne | 3-4 Moderate acne | 0-2 Severe acne",
      "- Pigmentation / Dark Spots: 9-10 Even tone | 7-8 Very mild spots | 5-6 Noticeable pigmentation | 3-4 Uneven tone | 0-2 Deep pigmentation or melasma",
      "- Texture and Pores: 9-10 Smooth refined skin | 7-8 Slight texture | 5-6 Visible pores | 3-4 Rough texture | 0-2 Very uneven texture or large pores",
      "- Oiliness / Hydration: 9-10 Well balanced | 7-8 Slight imbalance | 5-6 Oily or dry in areas | 3-4 Noticeable imbalance | 0-2 Very oily or very dry",
      "- Sensitivity / Redness: 9-10 No sensitivity | 7-8 Mild sensitivity | 5-6 Occasional redness | 3-4 Reactive skin | 0-2 Highly sensitive or inflamed",
      "Final labels: 9-10 Excellent (Healthy & glowing), 7-8.9 Good (Minor concerns), 5-6.9 Moderate (Needs improvement), 3-4.9 Concerning (Active issues), 0-2.9 Severe (Needs treatment focus).",
      "Only return the JSON object. The values must comply with the allowed enums and score ranges."
    ].join("\n"),
    jsonSchema: analysisJsonSchema,
    sampleInput: mockAnalysisInput,
    sampleOutput: mockAnalysisOutput
  };
}
