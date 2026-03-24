import { analysisOutputSchema, type AnalysisOutput } from "@/lib/validators/analysis";
import { buildAnalysisPrompt, type AnalysisPromptPayload } from "@/lib/ai/prompt-builder";
import { GeminiAnalysisProvider } from "@/lib/ai/providers/gemini-provider";
import { MockAnalysisProvider } from "@/lib/ai/providers/mock-provider";
import { OpenAIAnalysisProvider } from "@/lib/ai/providers/openai-provider";
import type { CreateReportInputDto } from "@/lib/report/types";

export interface AnalysisProvider {
  readonly name: string;
  generateAnalysis(payload: AnalysisPromptPayload): Promise<AnalysisOutput>;
}

function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getProviderChain(): AnalysisProvider[] {
  const requestedProvider = process.env.AI_PROVIDER ?? "auto";

  if (requestedProvider === "mock") {
    return [new MockAnalysisProvider()];
  }

  if (requestedProvider === "gemini") {
    if (!hasGeminiKey()) {
      throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini");
    }

    return [new GeminiAnalysisProvider()];
  }

  if (requestedProvider === "openai") {
    if (!hasOpenAiKey()) {
      throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai");
    }

    const providers: AnalysisProvider[] = [new OpenAIAnalysisProvider()];

    if (hasGeminiKey()) {
      providers.push(new GeminiAnalysisProvider());
    }

    return providers;
  }

  const providers: AnalysisProvider[] = [];

  if (hasOpenAiKey()) {
    providers.push(new OpenAIAnalysisProvider());
  }

  if (hasGeminiKey()) {
    providers.push(new GeminiAnalysisProvider());
  }

  providers.push(new MockAnalysisProvider());

  return providers;
}

export async function generateValidatedAnalysis(input: CreateReportInputDto) {
  const payload = buildAnalysisPrompt(input);
  const providers = getProviderChain();
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const result = await provider.generateAnalysis(payload);

      return {
        provider: provider.name,
        prompt: payload,
        analysis: analysisOutputSchema.parse(result)
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider error";
      errors.push(`${provider.name}: ${message}`);
    }
  }

  throw new Error(`All analysis providers failed. ${errors.join(" | ")}`);
}
