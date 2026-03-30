import { quizQuestionLookup } from "@/lib/quiz/question-bank";

type NormalizedQuizEntry = {
  key: string;
  question: string;
  answers: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function appendUnique(target: string[], values: string[]) {
  for (const value of values) {
    if (!target.includes(value)) {
      target.push(value);
    }
  }
}

function toStringArray(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/[\n,]+/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => toStringArray(item));
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  if (isRecord(value)) {
    const collected: string[] = [];
    appendUnique(collected, toStringArray(value.selected));
    appendUnique(collected, toStringArray(value.answer));
    appendUnique(collected, toStringArray(value.answers));
    appendUnique(collected, toStringArray(value.value));
    appendUnique(collected, toStringArray(value.response));

    if (isRecord(value.details)) {
      for (const [detailKey, detailValue] of Object.entries(value.details)) {
        const detailLines = toStringArray(detailValue);

        if (detailLines.length === 0) {
          continue;
        }

        const label = detailKey
          .replace(/[_-]+/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const prefix = label.length > 0 ? `${label}: ` : "";

        appendUnique(
          collected,
          detailLines.map((line) => `${prefix}${line}`)
        );
      }
    }

    return collected;
  }

  return [];
}

function prettifyKey(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeQuizAnswers(input: unknown): NormalizedQuizEntry[] {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input.flatMap((item, index) => {
      if (isRecord(item)) {
        const key = String(item.id ?? item.questionId ?? index + 1);
        const question =
          typeof item.question === "string"
            ? item.question
            : quizQuestionLookup[key]?.prompt ?? `Question ${key}`;
        const answers = toStringArray(item.answer ?? item.answers ?? item.value ?? item.response ?? item);

        return answers.length ? [{ key, question, answers }] : [];
      }

      const answers = toStringArray(item);
      return answers.length
        ? [
            {
              key: String(index + 1),
              question: `Question ${index + 1}`
              ,answers
            }
          ]
        : [];
    });
  }

  if (isRecord(input)) {
    return Object.entries(input).flatMap(([key, value]) => {
      const question = quizQuestionLookup[key]?.prompt ?? prettifyKey(key);
      const answers = toStringArray(value);

      return answers.length ? [{ key, question, answers }] : [];
    });
  }

  return [];
}

export function summarizeQuizAnswers(input: unknown) {
  return normalizeQuizAnswers(input).map((entry) => `${entry.question}: ${entry.answers.join(", ")}`);
}

export function detectSensitivitySignals(quizSummary: string[]) {
  const lower = quizSummary.join(" ").toLowerCase();

  return {
    sensitive:
      lower.includes("sensitive") ||
      lower.includes("burning") ||
      lower.includes("itch") ||
      lower.includes("reactive") ||
      lower.includes("sting"),
    pregnant:
      lower.includes("pregnant") ||
      lower.includes("breastfeeding") ||
      lower.includes("planning for pregnancy"),
    eczema: lower.includes("eczema"),
    psoriasis: lower.includes("psoriasis")
  };
}
