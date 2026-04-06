import { quizQuestionLookup } from "@/lib/quiz/question-bank";

type NormalizedQuizEntry = {
  key: string;
  question: string;
  answers: string[];
};

export type QuizInsights = {
  answerMap: Record<string, string[]>;
  concernCandidates: string[];
  secondaryConcernCandidates: string[];
  avoidIngredients: string[];
  preferredTextures: string[];
  skinTypeHints: string[];
  cleanserPreference: "clarifying_facewash" | "gentle_cleanser" | "balanced_cleanser";
  repairHeroIngredients: string[];
  repairSupportingIngredients: string[];
  parameterScores: {
    acneBreakouts: number;
    pigmentationDarkSpots: number;
    texturePores: number;
    oilinessHydration: number;
    sensitivityRedness: number;
    average: number;
  };
  parameterBands: {
    acneBreakouts: string;
    pigmentationDarkSpots: string;
    texturePores: string;
    oilinessHydration: string;
    sensitivityRedness: string;
  };
  flags: {
    sensitive: boolean;
    pregnant: boolean;
    eczema: boolean;
    psoriasis: boolean;
    breakoutProne: boolean;
    pigmentationProne: boolean;
    dehydrated: boolean;
    oily: boolean;
    antiAgingFocus: boolean;
  };
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

function clampScore(value: number) {
  return Math.round(Math.min(10, Math.max(0, value)) * 10) / 10;
}

function containsAny(values: string[], keywords: string[]) {
  const lowerValues = values.map((value) => value.toLowerCase());
  return keywords.some((keyword) => lowerValues.some((value) => value.includes(keyword)));
}

function getBand(score: number, bands: Array<{ min: number; label: string }>) {
  const rounded = clampScore(score);
  for (const band of bands) {
    if (rounded >= band.min) {
      return band.label;
    }
  }
  return bands[bands.length - 1]?.label ?? "Unknown";
}

function valuesFor(answerMap: Record<string, string[]>, key: string) {
  return answerMap[key] ?? [];
}

function buildAnswerMap(entries: NormalizedQuizEntry[]) {
  return Object.fromEntries(entries.map((entry) => [entry.key, entry.answers]));
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
              question: `Question ${index + 1}`,
              answers
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

export function deriveQuizInsights(input: unknown): QuizInsights {
  const entries = normalizeQuizAnswers(input);
  const answerMap = buildAnswerMap(entries);

  const concernAnswers = valuesFor(answerMap, "1");
  const breakoutAnswers = valuesFor(answerMap, "2");
  const washFeelAnswers = valuesFor(answerMap, "3");
  const sensitivityAnswers = valuesFor(answerMap, "4");
  const allergyAnswers = valuesFor(answerMap, "5");
  const waterAnswers = valuesFor(answerMap, "7");
  const stressAnswers = valuesFor(answerMap, "9");
  const hormonalAnswers = valuesFor(answerMap, "11");
  const pregnancyAnswers = valuesFor(answerMap, "13");
  const historyAnswers = valuesFor(answerMap, "14");
  const environmentAnswers = valuesFor(answerMap, "16");
  const routineConsistencyAnswers = valuesFor(answerMap, "18");
  const expectationAnswers = valuesFor(answerMap, "19");

  const sensitiveSignals = detectSensitivitySignals(summarizeQuizAnswers(input));
  const drynessSignals = containsAny(washFeelAnswers, ["dry", "tight"]) || containsAny(concernAnswers, ["dryness"]);
  const oilySignals = containsAny(washFeelAnswers, ["oily"]) || containsAny(concernAnswers, ["acne"]);
  const combinationSignals = containsAny(washFeelAnswers, ["combination"]);
  const pigmentationSignals = containsAny(concernAnswers, ["pigmentation", "dark spots", "melasma", "dullness"]);
  const acneSignals = containsAny(concernAnswers, ["acne"]) || containsAny(breakoutAnswers, ["rare", "occasional", "frequent", "moderate", "severe", "monthly", "weekly"]);
  const antiAgingSignals = containsAny(concernAnswers, ["wrinkles", "anti-aging", "aging", "fine lines"]);
  const dehydrationSignals = drynessSignals || containsAny(environmentAnswers, ["ac", "screens"]) || containsAny(waterAnswers, ["less than 1", "1 litre", "1 liter"]);
  const barrierSignals = sensitiveSignals.sensitive || drynessSignals || containsAny(allergyAnswers, ["allergy", "irritation"]);
  const hormonalSignals = containsAny(hormonalAnswers, ["pcos", "thyroid", "hormonal", "yes"]) || containsAny(stressAnswers, ["yes", "high", "often"]);
  const pregnant = sensitiveSignals.pregnant || containsAny(pregnancyAnswers, ["pregnant", "breastfeeding", "trying", "planning"]);

  let acneScore = 8.8;
  if (containsAny(breakoutAnswers, ["none", "never"])) acneScore = 9.4;
  if (containsAny(breakoutAnswers, ["rare", "1-2/month"])) acneScore = 7.8;
  if (containsAny(breakoutAnswers, ["occasional", "sometimes", "few times"])) acneScore = 5.8;
  if (containsAny(breakoutAnswers, ["frequent", "weekly", "moderate"])) acneScore = 3.8;
  if (containsAny(breakoutAnswers, ["severe", "daily", "cystic"])) acneScore = 1.8;
  if (containsAny(concernAnswers, ["acne"])) acneScore -= 1.2;
  if (hormonalSignals) acneScore -= 0.6;

  let pigmentationScore = 8.6;
  if (containsAny(concernAnswers, ["dark spots"])) pigmentationScore = 5.8;
  if (containsAny(concernAnswers, ["pigmentation"])) pigmentationScore = 4.8;
  if (containsAny(concernAnswers, ["melasma"])) pigmentationScore = 2.0;
  if (containsAny(concernAnswers, ["dullness"])) pigmentationScore = Math.min(pigmentationScore, 6.8);

  let textureScore = 8.4;
  if (containsAny(concernAnswers, ["wrinkles", "anti-aging"])) textureScore = 6.0;
  if (containsAny(concernAnswers, ["acne"])) textureScore = Math.min(textureScore, 6.2);
  if (containsAny(expectationAnswers, ["smooth", "texture", "pores"])) textureScore = Math.min(textureScore, 6.5);

  let balanceScore = 8.8;
  if (oilySignals) balanceScore = 5.8;
  if (drynessSignals) balanceScore = 5.4;
  if (combinationSignals) balanceScore = 6.2;
  if (dehydrationSignals) balanceScore -= 0.8;

  let sensitivityScore = 8.8;
  if (containsAny(sensitivityAnswers, ["sometimes", "occasionally", "mild"])) sensitivityScore = 5.8;
  if (containsAny(sensitivityAnswers, ["often", "frequent", "reactive"])) sensitivityScore = 3.8;
  if (containsAny(sensitivityAnswers, ["highly", "always", "severe"])) sensitivityScore = 1.8;
  if (containsAny(allergyAnswers, ["allergy", "irritation"])) sensitivityScore -= 1.4;
  if (barrierSignals) sensitivityScore -= 0.6;

  acneScore = clampScore(acneScore);
  pigmentationScore = clampScore(pigmentationScore);
  textureScore = clampScore(textureScore);
  balanceScore = clampScore(balanceScore);
  sensitivityScore = clampScore(sensitivityScore);

  const average = clampScore((acneScore + pigmentationScore + textureScore + balanceScore + sensitivityScore) / 5);

  const concernCandidates: string[] = [];
  const secondaryConcernCandidates: string[] = [];

  if (pigmentationSignals) appendUnique(concernCandidates, [containsAny(concernAnswers, ["melasma"]) ? "Melasma / deep pigmentation" : "Pigmentation / dark spots"]);
  if (acneSignals) appendUnique(concernCandidates, [acneScore <= 6 ? "Breakout tendency" : "Occasional breakouts"]);
  if (drynessSignals) appendUnique(concernCandidates, ["Dryness / dehydration"]);
  if (sensitiveSignals.sensitive || containsAny(sensitivityAnswers, ["sometimes", "often", "reactive"])) {
    appendUnique(concernCandidates, ["Sensitivity tendency"]);
  }
  if (antiAgingSignals) appendUnique(concernCandidates, ["Texture / early aging support"]);
  if (concernCandidates.length === 0) {
    appendUnique(concernCandidates, ["Barrier maintenance"]);
  }

  if (combinationSignals) appendUnique(secondaryConcernCandidates, ["Combination skin balance"]);
  if (containsAny(environmentAnswers, ["ac", "screens"])) appendUnique(secondaryConcernCandidates, ["Environmental dehydration"]);
  if (routineConsistencyAnswers.length > 0 && containsAny(routineConsistencyAnswers, ["irregular", "not regular", "sometimes"])) {
    appendUnique(secondaryConcernCandidates, ["Routine consistency"]);
  }
  if (stressAnswers.length > 0 && containsAny(stressAnswers, ["yes", "high", "sometimes"])) {
    appendUnique(secondaryConcernCandidates, ["Stress-related flare risk"]);
  }

  const avoidIngredients: string[] = [];
  if (barrierSignals) appendUnique(avoidIngredients, ["Fragrance", "Harsh scrubs", "Strong alcohol-heavy formulas"]);
  if (pregnant) appendUnique(avoidIngredients, ["Retinoids", "Hydroquinone"]);

  const preferredTextures = oilySignals
    ? ["Gel", "Fluid", "Light lotion"]
    : drynessSignals
      ? ["Cream", "Lotion", "Barrier cream"]
      : combinationSignals
        ? ["Gel", "Lotion"]
        : ["Lotion", "Gel"];

  const skinTypeHints = drynessSignals
    ? [combinationSignals ? "Combination to dry" : "Dry"]
    : oilySignals
      ? [combinationSignals ? "Combination to oily" : "Oily"]
      : combinationSignals
        ? ["Combination"]
        : ["Normal to combination"];

  let repairHeroIngredients = ["Niacinamide"];
  let repairSupportingIngredients = ["Panthenol"];

  if (containsAny(concernAnswers, ["pigmentation", "dark spots", "melasma"])) {
    repairHeroIngredients = pregnant || barrierSignals ? ["Azelaic Acid", "Niacinamide"] : ["Tranexamic Acid", "Niacinamide"];
    repairSupportingIngredients = containsAny(concernAnswers, ["melasma"]) ? ["Alpha Arbutin", "Kojic Acid"] : ["Alpha Arbutin", "Vitamin C"];
  } else if (acneSignals) {
    repairHeroIngredients = barrierSignals ? ["Niacinamide"] : ["Salicylic Acid", "Niacinamide"];
    repairSupportingIngredients = barrierSignals ? ["Zinc", "Panthenol"] : ["Zinc", "Azelaic Acid"];
  } else if (antiAgingSignals) {
    repairHeroIngredients = pregnant ? ["Peptides", "Niacinamide"] : ["Retinal", "Peptides"];
    repairSupportingIngredients = pregnant ? ["Ceramides", "Hyaluronic Acid"] : ["Ceramides", "Hyaluronic Acid"];
  } else if (drynessSignals || barrierSignals) {
    repairHeroIngredients = ["Ceramides", "Panthenol"];
    repairSupportingIngredients = ["Hyaluronic Acid", "Niacinamide"];
  }

  const cleanserPreference = oilySignals
    ? "clarifying_facewash"
    : barrierSignals || drynessSignals
      ? "gentle_cleanser"
      : "balanced_cleanser";

  return {
    answerMap,
    concernCandidates,
    secondaryConcernCandidates,
    avoidIngredients,
    preferredTextures,
    skinTypeHints,
    cleanserPreference,
    repairHeroIngredients,
    repairSupportingIngredients,
    parameterScores: {
      acneBreakouts: acneScore,
      pigmentationDarkSpots: pigmentationScore,
      texturePores: textureScore,
      oilinessHydration: balanceScore,
      sensitivityRedness: sensitivityScore,
      average
    },
    parameterBands: {
      acneBreakouts: getBand(acneScore, [
        { min: 9, label: "Clear skin" },
        { min: 7, label: "Rare pimples" },
        { min: 5, label: "Occasional acne" },
        { min: 3, label: "Moderate acne" },
        { min: 0, label: "Severe acne" }
      ]),
      pigmentationDarkSpots: getBand(pigmentationScore, [
        { min: 9, label: "Even tone" },
        { min: 7, label: "Very mild spots" },
        { min: 5, label: "Noticeable pigmentation" },
        { min: 3, label: "Uneven tone" },
        { min: 0, label: "Deep pigmentation or melasma" }
      ]),
      texturePores: getBand(textureScore, [
        { min: 9, label: "Smooth, refined skin" },
        { min: 7, label: "Slight texture" },
        { min: 5, label: "Visible pores" },
        { min: 3, label: "Rough texture" },
        { min: 0, label: "Very uneven texture or large pores" }
      ]),
      oilinessHydration: getBand(balanceScore, [
        { min: 9, label: "Well balanced" },
        { min: 7, label: "Slight imbalance" },
        { min: 5, label: "Oily or dry in areas" },
        { min: 3, label: "Noticeable imbalance" },
        { min: 0, label: "Very oily or very dry" }
      ]),
      sensitivityRedness: getBand(sensitivityScore, [
        { min: 9, label: "No sensitivity" },
        { min: 7, label: "Mild sensitivity" },
        { min: 5, label: "Occasional redness" },
        { min: 3, label: "Reactive skin" },
        { min: 0, label: "Highly sensitive or inflamed" }
      ])
    },
    flags: {
      sensitive: barrierSignals || sensitiveSignals.sensitive,
      pregnant,
      eczema: sensitiveSignals.eczema,
      psoriasis: sensitiveSignals.psoriasis,
      breakoutProne: acneSignals,
      pigmentationProne: pigmentationSignals,
      dehydrated: dehydrationSignals,
      oily: oilySignals,
      antiAgingFocus: antiAgingSignals
    }
  };
}
