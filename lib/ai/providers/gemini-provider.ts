import type { AnalysisProvider } from "@/lib/ai/provider";
import type { AnalysisPromptPayload } from "@/lib/ai/prompt-builder";
import type { AnalysisOutput } from "@/lib/validators/analysis";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
    code?: number;
    status?: string;
  };
};

export class GeminiAnalysisProvider implements AnalysisProvider {
  readonly name = "gemini";

  async generateAnalysis(payload: AnalysisPromptPayload): Promise<AnalysisOutput> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required when using the Gemini provider");
    }

    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${payload.systemPrompt}\n\n${payload.userPrompt}`
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: payload.jsonSchema
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini request failed: ${errorText}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();

    if (!content) {
      throw new Error(data.error?.message ?? "Gemini returned an empty response");
    }

    return JSON.parse(content) as AnalysisOutput;
  }
}
