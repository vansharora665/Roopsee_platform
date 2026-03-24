import type { AnalysisProvider } from "@/lib/ai/provider";
import type { AnalysisPromptPayload } from "@/lib/ai/prompt-builder";
import type { AnalysisOutput } from "@/lib/validators/analysis";

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

export class OpenAIAnalysisProvider implements AnalysisProvider {
  readonly name = "openai";

  async generateAnalysis(payload: AnalysisPromptPayload): Promise<AnalysisOutput> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: payload.systemPrompt
          },
          {
            role: "user",
            content: payload.userPrompt
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "roopsee_skin_analysis",
            strict: true,
            schema: payload.jsonSchema
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI request failed: ${errorText}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error(data.error?.message ?? "OpenAI returned an empty response");
    }

    return JSON.parse(content) as AnalysisOutput;
  }
}
