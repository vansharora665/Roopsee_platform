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
      "Use concise, professional dermatologist-style wording."
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
      "Only return the JSON object. The values must comply with the allowed enums and score ranges."
    ].join("\n"),
    jsonSchema: analysisJsonSchema,
    sampleInput: mockAnalysisInput,
    sampleOutput: mockAnalysisOutput
  };
}
