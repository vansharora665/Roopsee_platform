import { DEFAULT_USAGE_AMOUNTS } from "@/lib/report/default-guidance";
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
      score: 6.8,
      label: "Moderate (Needs improvement)"
    },
    overall_skin_profile: {
      skin_type: "Example skin type",
      condition: "Example overall condition summary",
      overall_severity: "Moderate"
    },
    key_skin_concerns: {
      primary: ["Example primary concern"],
      secondary: ["Example secondary concern"]
    },
    positive_findings: ["Example positive finding"],
    primary_observations: {
      oil_levels: "Medium",
      hydration: "Low",
      texture: "Uneven",
      tone: "Uneven"
    }
  },
  ingredient_plan: {
    cleanser: {
      purpose: "Gentle cleansing without disrupting the barrier",
      hero_ingredients: ["Glycerin"],
      supporting_ingredients: ["Panthenol"],
      notes: "Avoid stripping surfactants if sensitivity is suspected"
    },
    sunscreen: {
      purpose: "Daily UV protection and pigmentation prevention",
      hero_ingredients: ["Broad-spectrum UV filters"],
      supporting_ingredients: ["Vitamin E"],
      notes: "Prioritize a finish the patient can wear daily"
    },
    moisturizer: {
      purpose: "Restore hydration and support the barrier",
      hero_ingredients: ["Ceramides"],
      supporting_ingredients: ["Hyaluronic Acid"],
      notes: "Match the weight of the formula to the skin type"
    },
    repair_serum: {
      purpose: "Target the main concern with a corrective active",
      hero_ingredients: ["Niacinamide"],
      supporting_ingredients: ["Kojic Acid"],
      notes: "Keep the treatment suitable for ongoing tolerance"
    }
  },
  routine_plan: {
    morning: [
      {
        step: "Cleanser",
        usage_amount: DEFAULT_USAGE_AMOUNTS.cleanser,
        why: "Remove overnight oil and residue gently"
      },
      {
        step: "Moisturizer",
        usage_amount: DEFAULT_USAGE_AMOUNTS.moisturizer,
        why: "Support hydration and barrier comfort"
      },
      {
        step: "Sunscreen",
        usage_amount: DEFAULT_USAGE_AMOUNTS.sunscreen,
        why: "Protect against UV-triggered worsening of pigmentation and acne marks"
      }
    ],
    night: [
      {
        step: "Cleanser",
        usage_amount: DEFAULT_USAGE_AMOUNTS.cleanser,
        why: "Prepare the skin for treatment products"
      },
      {
        step: "Repair serum",
        usage_amount: DEFAULT_USAGE_AMOUNTS.serum,
        why: "Target the main concern with a corrective active"
      },
      {
        step: "Moisturizer",
        usage_amount: DEFAULT_USAGE_AMOUNTS.moisturizer,
        why: "Seal hydration and reduce irritation risk"
      }
    ]
  },
  product_matching: {
    target_concerns: ["Pigmentation", "Uneven tone"],
    avoid_ingredients: ["Fragrance"],
    preferred_textures: ["Gel", "Lotion"],
    notes: "Prioritize face products with high suitability for the drafted ingredients"
  },
  doctor_handoff: {
    summary: "Review product fit, usage frequency, and patient tolerability before approval.",
    review_focus: ["Suitability for sensitivity", "Practical adherence"]
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
      ? "Use the front, left, and right facial image references below as primary evidence. If the operator uploads the same images manually in ChatGPT, treat the uploaded files as the final visual input."
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
    "The JSON example below is a schema placeholder only. Do not copy its example values unless the case evidence truly supports them.",
    "Do not ignore the questionnaire. It is authoritative patient context and must be used consistently.",
    "Use all available evidence together: patient metadata, questionnaire, manual notes, scan context, and image references.",
    "Primary concerns must be case-specific. Do not default to pigmentation, uneven tone, acne, or dehydration unless the evidence clearly supports those concerns.",
    "Different cases with different questionnaire responses and image findings must produce meaningfully different scores, conditions, and concern lists.",
    "Keep primary concerns to the 1 or 2 strongest issues only. Use secondary concerns for weaker or supporting issues.",
    "If the evidence for a concern is weak, do not promote it to primary.",
    "Choose cleanser versus facewash based on skin type, oiliness, hydration, and breakout tendency. Do not recommend serums, moisturizers, sunscreens, lip products, or body products in the cleanser slot.",
    hasCatalogAttachment
      ? 'A product catalog is attached below. Choose exact products only from that catalog and populate recommended_products with simple strings in this exact format: "Brand - Product Name". Use null only if no suitable product exists for a slot. Do not return nested objects inside recommended_products in catalog-attached mode.'
      : "No product catalog is attached. Leave recommended_products as null and let the platform do ingredient-based catalog matching later.",
    "",
    "Scoring method:",
    "- Internally score these 5 parameters from 0 to 10: Acne / Breakouts, Pigmentation / Dark Spots, Texture and Pores, Oiliness / Hydration, Sensitivity / Redness.",
    "- Use the operator questionnaire, visible issues, negative findings, and image evidence together to determine each parameter score.",
    "- Final skin_score.score must be the average of those 5 parameter scores, rounded to one decimal place.",
    "- Do not return the 5 internal parameter scores in the JSON. Return only the final average score and label.",
    "",
    "Parameter rubrics:",
    "- Acne / Breakouts: 9-10 Clear skin | 7-8 Rare pimples | 5-6 Occasional acne | 3-4 Moderate acne | 0-2 Severe acne",
    "- Pigmentation / Dark Spots: 9-10 Even tone | 7-8 Very mild spots | 5-6 Noticeable pigmentation | 3-4 Uneven tone | 0-2 Deep pigmentation or melasma",
    "- Texture and Pores: 9-10 Smooth refined skin | 7-8 Slight texture | 5-6 Visible pores | 3-4 Rough texture | 0-2 Very uneven texture or large pores",
    "- Oiliness / Hydration: 9-10 Well balanced | 7-8 Slight imbalance | 5-6 Oily or dry in areas | 3-4 Noticeable imbalance | 0-2 Very oily or very dry",
    "- Sensitivity / Redness: 9-10 No sensitivity | 7-8 Mild sensitivity | 5-6 Occasional redness | 3-4 Reactive skin | 0-2 Highly sensitive or inflamed",
    "",
    "Final score labels:",
    "- 9-10: Excellent (Healthy & glowing)",
    "- 7-8.9: Good (Minor concerns)",
    "- 5-6.9: Moderate (Needs improvement)",
    "- 3-4.9: Concerning (Active issues)",
    "- 0-2.9: Severe (Needs treatment focus)",
    "",
    "Analysis enums:",
    "- skin_score.label: Excellent (Healthy & glowing) | Good (Minor concerns) | Moderate (Needs improvement) | Concerning (Active issues) | Severe (Needs treatment focus)",
    "- overall_severity: None | Mild | Moderate | Severe",
    "- oil_levels: Low | Medium | High",
    "- hydration: Low | Good",
    "- texture: Smooth | Uneven",
    "- tone: Even | Uneven",
    "",
    "Routine quantity rules:",
    `- Sunscreen: ${DEFAULT_USAGE_AMOUNTS.sunscreen}`,
    `- Facewash / Cleanser: ${DEFAULT_USAGE_AMOUNTS.cleanser}`,
    `- Moisturizer: ${DEFAULT_USAGE_AMOUNTS.moisturizer}`,
    `- Repair or active cream: ${DEFAULT_USAGE_AMOUNTS.repairCream}`,
    `- Serum: ${DEFAULT_USAGE_AMOUNTS.serum}`,
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
    'For catalog-attached mode, recommended_products values should be strings like "Cetaphil - Gentle Skin Cleanser" or null. For non-catalog mode, keep recommended_products as null.',
    "",
    "Return JSON in this exact structure:",
    promptDraftPlaceholder
  ].join("\n");
}
