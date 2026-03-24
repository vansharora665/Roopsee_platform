import type { AnalysisProvider } from "@/lib/ai/provider";
import type { AnalysisPromptPayload } from "@/lib/ai/prompt-builder";
import { mockAnalysisOutput } from "@/lib/ai/mock-data";
import type { AnalysisOutput } from "@/lib/validators/analysis";

export class MockAnalysisProvider implements AnalysisProvider {
  readonly name = "mock";

  async generateAnalysis(payload: AnalysisPromptPayload): Promise<AnalysisOutput> {
    const lowerPrompt = payload.userPrompt.toLowerCase();

    if (lowerPrompt.includes("acne") || lowerPrompt.includes("breakout")) {
      return {
        skin_score: {
          score: 5,
          label: "Moderate Concerns"
        },
        overall_skin_profile: {
          skin_type: "Combination to oily",
          condition: "Congestion-prone skin with mild inflammatory activity",
          overall_severity: "Moderate"
        },
        key_skin_concerns: {
          primary: ["Clogged pores", "Post-acne marks", "Uneven texture"],
          secondary: ["Mild oil imbalance", "Tone irregularity"]
        },
        positive_findings: [
          "No severe cystic lesions",
          "No visible barrier compromise",
          "No deep scarring"
        ],
        primary_observations: {
          oil_levels: "High",
          hydration: "Low",
          texture: "Uneven",
          tone: "Uneven"
        }
      };
    }

    if (lowerPrompt.includes("dry") || lowerPrompt.includes("dehydr")) {
      return {
        ...mockAnalysisOutput,
        overall_skin_profile: {
          ...mockAnalysisOutput.overall_skin_profile,
          condition: "Mild dehydration with uneven tone tendency"
        },
        primary_observations: {
          ...mockAnalysisOutput.primary_observations,
          hydration: "Low"
        }
      };
    }

    return mockAnalysisOutput;
  }
}
