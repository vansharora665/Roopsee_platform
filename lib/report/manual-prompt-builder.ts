import { summarizeQuizAnswers } from "@/lib/quiz/summary";
import type { ReportDraft } from "@/lib/validators/draft";
import type { PromptInputModeValue } from "@/lib/validators/report";

type PromptInput = {
  patientInfo: {
    name: string;
    age: number;
    sex: string;
    reportDate: string;
    inputSources: string[];
  };
  assets: {
    questionnaireText: string;
    profileContextText: string;
    rawFindingsText: string;
    visibleIssues: string[];
    negativeFindings: string[];
    profileHints: string[];
    image1Url?: string | null;
    image2Url?: string | null;
    image3Url?: string | null;
    quizSummaryJson?: unknown;
    scanContextJson?: unknown;
  };
  promptInputMode: PromptInputModeValue;
  productCatalogText?: string | null;
};

export const promptJsonShape: ReportDraft = {
  analysis: {
    skin_score: {
      score: 6,
      label: "Good, Needs Improvement"
    },
    overall_skin_profile: {
      skin_type: "Combination",
      condition: "Mild dehydration tendency with pigmentation",
      overall_severity: "Mild"
    },
    key_skin_concerns: {
      primary: ["Uneven skin tone", "Pigmentation"],
      secondary: ["Texture irregularity"]
    },
    positive_findings: ["No active acne"],
    primary_observations: {
      oil_levels: "Medium",
      hydration: "Low",
      texture: "Uneven",
      tone: "Uneven"
    }
  },
  ingredient_plan: {
    cleanser: {
      purpose: "Gentle cleanse without barrier disruption",
      hero_ingredients: ["Glycerin"],
      supporting_ingredients: ["Panthenol"],
      notes: "Avoid stripping surfactants if sensitive"
    },
    sunscreen: {
      purpose: "Daily UV protection and pigmentation prevention",
      hero_ingredients: ["Broad-spectrum UV filters"],
      supporting_ingredients: ["Vitamin C"],
      notes: "Prefer cosmetically elegant finish for daily wear"
    },
    moisturizer: {
      purpose: "Restore hydration and barrier support",
      hero_ingredients: ["Ceramides"],
      supporting_ingredients: ["Hyaluronic Acid"],
      notes: "Match texture to skin type"
    },
    repair_serum: {
      purpose: "Target the main concern with a hero treatment",
      hero_ingredients: ["Niacinamide"],
      supporting_ingredients: ["Kojic Acid"],
      notes: "Keep suitable for tolerance level"
    }
  },
  routine_plan: {
    morning: [
      {
        step: "Cleanser",
        usage_amount: "1 pump",
        why: "Remove excess oil and residue gently"
      },
      {
        step: "Moisturizer",
        usage_amount: "1 fingertip unit",
        why: "Support hydration and barrier comfort"
      },
      {
        step: "Sunscreen",
        usage_amount: "2 finger lengths",
        why: "Protect from UV and pigmentation worsening"
      }
    ],
    night: [
      {
        step: "Cleanser",
        usage_amount: "1 pump",
        why: "Clean skin before treatment application"
      },
      {
        step: "Repair serum",
        usage_amount: "2-3 drops",
        why: "Target the main skin concern"
      },
      {
        step: "Moisturizer",
        usage_amount: "1 fingertip unit",
        why: "Seal hydration and reduce irritation risk"
      }
    ]
  },
  product_matching: {
    target_concerns: ["Pigmentation", "Uneven tone"],
    avoid_ingredients: ["Fragrance"],
    preferred_textures: ["Gel", "Lotion"],
    notes: "Prioritize face products with high suitability"
  },
  doctor_handoff: {
    summary: "Review fit of actives, frequency, and tolerability before approval.",
    review_focus: ["Suitability for sensitivity", "Pregnancy safety if relevant"]
  },
  recommended_products: {
    cleanser: null,
    sunscreen: null,
    moisturizer: null,
    repair_serum: null
  }
};

export const promptDraftPlaceholder = JSON.stringify(promptJsonShape, null, 2);

function toQuizSummaryLines(value: unknown) {
  if (Array.isArray(value)) {
    const lines = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);

    if (lines.length > 0) {
      return lines;
    }
  }

  if (typeof value === "string") {
    return value
      .split(/\n+/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return summarizeQuizAnswers(value);
}

function buildQuestionnaireLines(questionnaireText: string, quizSummaryJson: unknown) {
  const questionnaireLines = questionnaireText
    .split(/\n+/g)
    .map((item) => item.trim())
    .filter(Boolean);

  if (questionnaireLines.length > 0) {
    return questionnaireLines;
  }

  return toQuizSummaryLines(quizSummaryJson);
}

export function buildManualPrompt(input: PromptInput) {
  const questionnaireLines = buildQuestionnaireLines(
    input.assets.questionnaireText,
    input.assets.quizSummaryJson
  );
  const scanInstruction =
    input.promptInputMode === "scan_assisted"
      ? "Use the front, left, and right facial image references below as primary evidence. If the operator attaches the same images again in ChatGPT, treat those uploaded files as the final visual input."
      : "Do not assume access to images. Use only the written context below.";

  const scanContext =
    input.assets.scanContextJson && typeof input.assets.scanContextJson === "object"
      ? JSON.stringify(input.assets.scanContextJson, null, 2)
      : String(input.assets.scanContextJson ?? "None provided");

  const imageReferences = [input.assets.image1Url, input.assets.image2Url, input.assets.image3Url].filter(Boolean);
  const hasCatalogAttachment = Boolean(input.productCatalogText && input.productCatalogText.trim().length > 0);

  return [
    "You are preparing a dermatologist-style Roopsee draft report.",
    "Return valid JSON only.",
    "Do not use markdown.",
    "Do not add any extra keys.",
    "Be clinically concise, consistent, and professional.",
    "Only return the draft JSON required for the Roopsee platform.",
    "The doctor will review and finalize expert advice separately.",
    "Use the exact JSON shape shown below and keep enum values valid for the analysis section.",
    "Do not ignore the questionnaire. It is authoritative patient context and must be used consistently.",
    "Use all available evidence together: patient metadata, questionnaire, manual notes, scan context, and image references.",
    hasCatalogAttachment
      ? "A product catalog is attached below. Choose exact products only from that catalog and populate recommended_products with simple strings in this exact format: \"Brand - Product Name\". Use null only if no suitable product exists for a slot. Do not return nested objects inside recommended_products in catalog-attached mode."
      : "No product catalog is attached. Leave recommended_products as null and let the platform do ingredient-based catalog matching later.",
    "",
    "Analysis enums:",
    "- skin_score.label: Needs Attention | Moderate Concerns | Good, Needs Improvement | Healthy Skin",
    "- overall_severity: None | Mild | Moderate | Severe",
    "- oil_levels: Low | Medium | High",
    "- hydration: Low | Good",
    "- texture: Smooth | Uneven",
    "- tone: Even | Uneven",
    "",
    scanInstruction,
    "",
    "Internal image accessibility check: Are you able to read the images from the provided references? If not, rely on the written context and still return JSON only.",
    "",
    `Patient name: ${input.patientInfo.name}`,
    `Age: ${input.patientInfo.age}`,
    `Sex: ${input.patientInfo.sex}`,
    `Report date: ${input.patientInfo.reportDate}`,
    `Input sources: ${input.patientInfo.inputSources.join(", ")}`,
    `Inherited profile metadata: ${input.assets.profileContextText || "None provided"}`,
    "Questionnaire / quiz responses:",
    questionnaireLines.length > 0
      ? questionnaireLines.map((line) => `- ${line}`).join("\n")
      : "- None provided",
    `Manual findings: ${input.assets.rawFindingsText || "None provided"}`,
    `Visible issues: ${input.assets.visibleIssues.join(", ") || "None provided"}`,
    `Negative findings: ${input.assets.negativeFindings.join(", ") || "None provided"}`,
    `Profile hints: ${input.assets.profileHints.join(", ") || "None provided"}`,
    `Scan context JSON: ${scanContext}`,
    `Image references in final order (front, left, right): ${imageReferences.join(", ") || "None provided"}`,
    "",
    hasCatalogAttachment ? "Attached product catalog:" : "Product catalog attachment: none",
    hasCatalogAttachment ? input.productCatalogText ?? "" : "",
    "",
    "For catalog-attached mode, recommended_products values should be strings like \"Cetaphil - Gentle Skin Cleanser\" or null. For non-catalog mode, keep recommended_products as null.\n\nReturn JSON in this exact structure:",
    promptDraftPlaceholder
  ].join("\n");
}
