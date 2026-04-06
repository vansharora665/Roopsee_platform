import { rm } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { generateValidatedAnalysis } from "@/lib/ai/provider";
import { sendTelegramMessage } from "@/lib/notifications/telegram";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_USAGE_AMOUNTS } from "@/lib/report/default-guidance";
import { deriveQuizInsights } from "@/lib/quiz/summary";
import { getSkinScoreLabel, normalizeSkinScore } from "@/lib/report/score";
import {
  formatProductCatalogForPrompt,
  rankProductsForDraft,
  resolveAiRecommendedProducts
} from "@/lib/catalog/matcher";
import type { RankedProductMatch } from "@/lib/catalog/matcher";
import { buildManualPrompt } from "@/lib/report/manual-prompt-builder";
import { reportInclude, serializeReport, toReportListItem } from "@/lib/report/mappers";
import { getGeneratedReportsDir, getUploadsReportsDir } from "@/lib/storage/files";
import type {
  BuildPromptResultDto,
  CreateReportInputDto,
  DoctorProductRowDto,
  DoctorReviewInputDto,
  ProductCatalogDto,
  ProductSlotDto,
  ReportDetailDto,
  ReportListItemDto,
  ReportStatusDto,
  SyncedProfileDto
} from "@/lib/report/types";
import {
  extractStoredScanUrls,
  getSyncedProfileById,
  listSupabaseProductMetadata,
  updateSupabaseQuizResultReport,
  updateSupabaseUserProducts
} from "@/lib/supabase/profile-service";
import {
  createReportRequestSchema,
  doctorReviewUpdateSchema,
  reportStatusSchema
} from "@/lib/validators/report";
import type { AnalysisOutput } from "@/lib/validators/analysis";
import type { ReportDraft } from "@/lib/validators/draft";

function buildDraftFromAnalysis(analysis: AnalysisOutput, quizSummaryJson?: unknown): ReportDraft {
  const insights = deriveQuizInsights(quizSummaryJson);
  const primaryConcerns = Array.from(new Set([
    ...analysis.key_skin_concerns.primary,
    ...insights.concernCandidates
  ])).slice(0, 2);
  const secondaryConcerns = Array.from(new Set([
    ...analysis.key_skin_concerns.secondary,
    ...insights.secondaryConcernCandidates,
    ...analysis.key_skin_concerns.primary.filter((item) => !primaryConcerns.includes(item))
  ])).filter((item) => !primaryConcerns.includes(item)).slice(0, 3);
  const mainConcern = primaryConcerns[0] ?? secondaryConcerns[0] ?? "Skin support";
  const normalizedConcernPool = `${primaryConcerns.join(" ")} ${secondaryConcerns.join(" ")}`.toLowerCase();
  const isPigmentationLed = /pigmentation|dark spot|melasma/.test(normalizedConcernPool);
  const isBreakoutLed = /breakout|acne/.test(normalizedConcernPool);
  const isDrynessLed = /dry|dehydrat|barrier|sensitivity/.test(normalizedConcernPool) || insights.flags.dehydrated || insights.flags.sensitive;
  const isAgingLed = /aging|wrinkle|texture/.test(normalizedConcernPool) || insights.flags.antiAgingFocus;
  const cleanserIsFacewash = insights.cleanserPreference === "clarifying_facewash";

  const cleanserPlan = cleanserIsFacewash
    ? {
        purpose: "Lift oil, sweat, and congestion gently without triggering rebound dryness.",
        hero_ingredients: ["Glycerin", "Mild surfactants"],
        supporting_ingredients: isBreakoutLed ? ["Zinc PCA", "Panthenol"] : ["Panthenol"],
        notes: "Prefer a clarifying facewash texture because the case shows more oil or breakout tendency."
      }
    : insights.cleanserPreference === "gentle_cleanser"
      ? {
          purpose: "Cleanse without stripping an already dry, sensitive, or barrier-stressed skin profile.",
          hero_ingredients: ["Glycerin", "Ceramides"],
          supporting_ingredients: ["Panthenol", "Betaine"],
          notes: "Keep the cleanser creamy or lotion-like and avoid foaming harshness."
        }
      : {
          purpose: "Cleanse effectively while keeping the skin balanced and comfortable.",
          hero_ingredients: ["Glycerin"],
          supporting_ingredients: ["Panthenol"],
          notes: "Use a balanced cleanser that the patient can tolerate twice daily."
        };

  const sunscreenPlan = {
    purpose: isPigmentationLed
      ? "Prevent tanning, dark spot worsening, and UV-triggered uneven tone."
      : "Provide reliable daily UV protection without interfering with adherence.",
    hero_ingredients: ["Broad-spectrum UV filters"],
    supporting_ingredients: isPigmentationLed ? ["Iron oxides", "Vitamin E"] : ["Vitamin E"],
    notes: isPigmentationLed
      ? "Prefer cosmetically elegant sunscreen use every day because pigmentation control depends on consistency."
      : "Choose a wearable finish the patient will actually reapply."
  };

  const moisturizerPlan = isDrynessLed
    ? {
        purpose: "Repair barrier weakness, reduce tightness, and retain hydration for longer.",
        hero_ingredients: ["Ceramides", "Panthenol"],
        supporting_ingredients: ["Hyaluronic Acid", "Squalane"],
        notes: "Bias toward lotion or cream textures because this case shows dryness, sensitivity, or AC-related dehydration."
      }
    : insights.flags.oily
      ? {
          purpose: "Support hydration without a heavy residue that discourages adherence.",
          hero_ingredients: ["Ceramides"],
          supporting_ingredients: ["Hyaluronic Acid", "Niacinamide"],
          notes: "Use light gel-cream or lotion textures for oily or combination-leaning skin."
        }
      : {
          purpose: "Maintain hydration and keep the barrier stable around active treatment use.",
          hero_ingredients: ["Ceramides"],
          supporting_ingredients: ["Hyaluronic Acid", "Panthenol"],
          notes: "Match the moisturizer weight to the patient comfort and climate exposure."
        };

  const repairPlan = isPigmentationLed
    ? {
        purpose: `Target ${mainConcern.toLowerCase()} with a brightening-focused but tolerable corrective active.`,
        hero_ingredients: insights.repairHeroIngredients,
        supporting_ingredients: insights.repairSupportingIngredients,
        notes: insights.flags.sensitive
          ? "Keep the brightening plan barrier-friendly and avoid stacking too many strong depigmenting actives at once."
          : "Use pigment-corrective actives consistently and support with sunscreen discipline."
      }
    : isBreakoutLed
      ? {
          purpose: `Target ${mainConcern.toLowerCase()} with a sebum-balancing and breakout-aware treatment plan.`,
          hero_ingredients: insights.repairHeroIngredients,
          supporting_ingredients: insights.repairSupportingIngredients,
          notes: insights.flags.sensitive
            ? "Keep acne treatment gentle enough to avoid barrier damage or rebound irritation."
            : "Use corrective actives that reduce breakouts without making adherence difficult."
        }
      : isAgingLed
        ? {
            purpose: `Support ${mainConcern.toLowerCase()} with texture-refining and skin-renewal support.`,
            hero_ingredients: insights.repairHeroIngredients,
            supporting_ingredients: insights.repairSupportingIngredients,
            notes: insights.flags.pregnant
              ? "Avoid retinoid-led treatment and stay with pregnancy-compatible renewal support."
              : "Bias toward gradual texture refinement over aggressive actives."
          }
        : {
            purpose: `Support ${mainConcern.toLowerCase()} safely and consistently.`,
            hero_ingredients: insights.repairHeroIngredients,
            supporting_ingredients: insights.repairSupportingIngredients,
            notes: insights.flags.sensitive
              ? "Introduce corrective actives gradually because tolerance may be a limiting factor."
              : "Keep the repair plan focused on the clearest concern rather than overloading the routine."
          };

  return {
    analysis: {
      ...analysis,
      key_skin_concerns: {
        primary: primaryConcerns,
        secondary: secondaryConcerns
      }
    },
    ingredient_plan: {
      cleanser: cleanserPlan,
      sunscreen: sunscreenPlan,
      moisturizer: moisturizerPlan,
      repair_serum: repairPlan
    },
    routine_plan: {
      morning: [
        {
          step: cleanserIsFacewash ? "Facewash" : "Cleanser",
          usage_amount: DEFAULT_USAGE_AMOUNTS.cleanser,
          why: cleanserIsFacewash
            ? "Reduce surface oil and residue without leaving the skin stripped."
            : "Remove overnight residue while keeping the barrier comfortable."
        },
        {
          step: "Moisturizer",
          usage_amount: DEFAULT_USAGE_AMOUNTS.moisturizer,
          why: isDrynessLed
            ? "Rebuild comfort and hydration before daytime exposure."
            : "Keep the barrier stable and improve tolerance through the day."
        },
        {
          step: "Sunscreen",
          usage_amount: DEFAULT_USAGE_AMOUNTS.sunscreen,
          why: isPigmentationLed
            ? "Prevent worsening of dark spots and uneven tone."
            : "Protect from UV-triggered irritation and long-term damage."
        }
      ],
      night: [
        {
          step: cleanserIsFacewash ? "Facewash" : "Cleanser",
          usage_amount: DEFAULT_USAGE_AMOUNTS.cleanser,
          why: "Prepare the skin for treatment without increasing irritation."
        },
        {
          step: isPigmentationLed || isBreakoutLed || isAgingLed ? "Repair serum" : "Barrier treatment",
          usage_amount: isDrynessLed && !isPigmentationLed && !isBreakoutLed && !isAgingLed
            ? DEFAULT_USAGE_AMOUNTS.repairCream
            : DEFAULT_USAGE_AMOUNTS.serum,
          why: `Address ${mainConcern.toLowerCase()} with the most relevant targeted step in the routine.`
        },
        {
          step: "Moisturizer",
          usage_amount: DEFAULT_USAGE_AMOUNTS.moisturizer,
          why: isDrynessLed
            ? "Seal hydration and reduce overnight tightness or reactivity."
            : "Support tolerance around the active step and keep the barrier steady."
        }
      ]
    },
    product_matching: {
      target_concerns: Array.from(new Set([...primaryConcerns, ...secondaryConcerns, ...insights.concernCandidates])).slice(0, 5),
      avoid_ingredients: insights.avoidIngredients,
      preferred_textures: Array.from(new Set([
        ...insights.preferredTextures,
        ...(analysis.primary_observations.oil_levels === "High" ? ["Gel", "Fluid"] : []),
        ...(analysis.primary_observations.hydration === "Low" ? ["Lotion", "Cream"] : [])
      ])).slice(0, 4),
      notes: `Prioritize products that fit the dominant case pattern: ${Array.from(new Set([...primaryConcerns, ...insights.concernCandidates])).join(", ")}.`
    },
    doctor_handoff: {
      summary: `Questionnaire-driven case signals suggest ${Array.from(new Set([...primaryConcerns, ...secondaryConcerns])).join(", ")} with a likely ${insights.skinTypeHints[0] ?? analysis.overall_skin_profile.skin_type.toLowerCase()} tendency. Review final fit, tolerance, and practicality before approval.`,
      review_focus: Array.from(new Set([
        insights.flags.sensitive ? "Sensitivity / tolerance" : "Tolerance",
        insights.flags.pregnant ? "Pregnancy-safe actives" : "Contraindications",
        isPigmentationLed ? "Sunscreen adherence" : "Practical adherence"
      ]))
    }
  };
}

function normalizeDraftScore(draft: ReportDraft): ReportDraft {
  const normalizedScore = normalizeSkinScore(draft.analysis.skin_score.score);

  return {
    ...draft,
    analysis: {
      ...draft.analysis,
      skin_score: {
        score: normalizedScore,
        label: getSkinScoreLabel(normalizedScore)
      }
    }
  };
}

function buildRoutineItems(plan: ReportDraft["routine_plan"]["morning"]) {
  return plan.map((item) => ({
    step: item.step,
    usageAmount: item.usage_amount
  }));
}

function bestProductForSlot(matches: RankedProductMatch[], slot: ProductSlotDto) {
  return matches.find((match) => match.slot === slot && match.rank === 1)?.product ?? null;
}

function mergePreferredProductMatches(
  aiMatches: ReturnType<typeof resolveAiRecommendedProducts>,
  fallbackMatches: ReturnType<typeof rankProductsForDraft>
): RankedProductMatch[] {
  const slots = ["cleanser", "sunscreen", "moisturizer", "repair_serum"] as const;

  return slots.flatMap((slot) => {
    const preferred = aiMatches.filter((match) => match.slot === slot);
    return preferred.length > 0 ? preferred : fallbackMatches.filter((match) => match.slot === slot);
  });
}

const defaultProductRowConfig = [
  { slot: "cleanser", title: "Cleanser / Facewash" },
  { slot: "sunscreen", title: "Sunscreen" },
  { slot: "moisturizer", title: "Moisturizer" },
  { slot: "repair_serum", title: "Repair / Serum" }
] as const satisfies ReadonlyArray<{ slot: ProductSlotDto; title: string }>;

type LegacyDoctorProductFields = Pick<
  DoctorReviewInputDto,
  | "cleanserBrand"
  | "cleanserCompany"
  | "cleanserProductName"
  | "sunscreenBrand"
  | "sunscreenCompany"
  | "sunscreenProductName"
  | "moisturizerBrand"
  | "moisturizerCompany"
  | "moisturizerProductName"
  | "repairSerumBrand"
  | "repairSerumCompany"
  | "repairSerumProductName"
>;

type MatchLike = {
  slot: ProductSlotDto;
  rank: number;
  product: {
    id: string;
    brandName: string;
    productName: string;
    productType?: string | null;
  };
};

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeComparableText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function numberFromNullableString(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value.replace(/[^\d.]+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArrayFromJson(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function defaultProductRowTitle(slot: ProductSlotDto, productType?: string | null) {
  if (slot === "cleanser") {
    const normalizedProductType = (productType ?? "").toLowerCase();

    if (normalizedProductType.includes("face wash") || normalizedProductType.includes("facewash")) {
      return "Facewash";
    }

    if (normalizedProductType.includes("cleanser")) {
      return "Cleanser";
    }
  }

  return defaultProductRowConfig.find((item) => item.slot === slot)?.title ?? "Recommended Product";
}

function getProductTypeFallback(slot: ProductSlotDto | null, title?: string | null) {
  const normalizedTitle = (title ?? "").toLowerCase();

  if (slot === "cleanser") {
    return normalizedTitle.includes("facewash") || normalizedTitle.includes("face wash")
      ? "Facewash"
      : "Cleanser";
  }

  if (slot === "sunscreen") {
    return "Sunscreen";
  }

  if (slot === "moisturizer") {
    return "Moisturizer";
  }

  if (slot === "repair_serum") {
    return normalizedTitle.includes("cream") ? "Active Cream" : "Serum";
  }

  return normalizeText(title) ?? "Recommended Product";
}

function buildProductRowFromMatch(config: (typeof defaultProductRowConfig)[number], match?: MatchLike): DoctorProductRowDto {
  return {
    id: `${config.slot}-${match?.product.id ?? "default"}`,
    title: defaultProductRowTitle(config.slot, match?.product.productType ?? null),
    slot: config.slot,
    productCatalogId: match?.product.id ?? null,
    brand: match?.product.brandName ?? null,
    company: match?.product.brandName ?? null,
    productName: match?.product.productName ?? null
  };
}

function buildDefaultDoctorProductRows(matches: MatchLike[]): DoctorProductRowDto[] {
  return defaultProductRowConfig.map((config) => {
    const match = matches
      .filter((item) => item.slot === config.slot)
      .sort((left, right) => left.rank - right.rank)[0];

    return buildProductRowFromMatch(config, match);
  });
}

function hasAnyLegacyProductFields(fields: LegacyDoctorProductFields) {
  return Object.values(fields).some((value) => Boolean(normalizeText(value)));
}

function buildProductRowsFromLegacyFields(fields: LegacyDoctorProductFields): DoctorProductRowDto[] {
  return [
    {
      id: "cleanser-row",
      title: defaultProductRowTitle("cleanser"),
      slot: "cleanser",
      productCatalogId: null,
      brand: normalizeText(fields.cleanserBrand),
      company: normalizeText(fields.cleanserCompany),
      productName: normalizeText(fields.cleanserProductName)
    },
    {
      id: "sunscreen-row",
      title: defaultProductRowTitle("sunscreen"),
      slot: "sunscreen",
      productCatalogId: null,
      brand: normalizeText(fields.sunscreenBrand),
      company: normalizeText(fields.sunscreenCompany),
      productName: normalizeText(fields.sunscreenProductName)
    },
    {
      id: "moisturizer-row",
      title: defaultProductRowTitle("moisturizer"),
      slot: "moisturizer",
      productCatalogId: null,
      brand: normalizeText(fields.moisturizerBrand),
      company: normalizeText(fields.moisturizerCompany),
      productName: normalizeText(fields.moisturizerProductName)
    },
    {
      id: "repair-serum-row",
      title: defaultProductRowTitle("repair_serum"),
      slot: "repair_serum",
      productCatalogId: null,
      brand: normalizeText(fields.repairSerumBrand),
      company: normalizeText(fields.repairSerumCompany),
      productName: normalizeText(fields.repairSerumProductName)
    }
  ];
}

function normalizeDoctorProductRows(
  rows: Array<{
    id: string;
    title: string;
    slot?: ProductSlotDto | null;
    productCatalogId?: string | null;
    brand?: string | null;
    company?: string | null;
    productName?: string | null;
  }>
) {
  return rows
    .map((row, index) => {
      const slot = row.slot ?? null;
      const title = normalizeText(row.title) ?? (slot ? defaultProductRowTitle(slot) : "");
      const brand = normalizeText(row.brand);
      const company = normalizeText(row.company) ?? brand;
      const productName = normalizeText(row.productName);
      const productCatalogId = normalizeText(row.productCatalogId);

      return {
        id: normalizeText(row.id) ?? `product-row-${index + 1}`,
        title,
        slot,
        productCatalogId,
        brand,
        company,
        productName
      } satisfies DoctorProductRowDto;
    })
    .filter((row) => row.title || row.slot || row.productCatalogId || row.brand || row.company || row.productName);
}

function buildLegacyDoctorFieldsFromRows(rows: DoctorProductRowDto[]): LegacyDoctorProductFields {
  const firstRowForSlot = (slot: ProductSlotDto) => rows.find((row) => row.slot === slot) ?? null;
  const cleanser = firstRowForSlot("cleanser");
  const sunscreen = firstRowForSlot("sunscreen");
  const moisturizer = firstRowForSlot("moisturizer");
  const repairSerum = firstRowForSlot("repair_serum");

  return {
    cleanserBrand: cleanser?.brand ?? null,
    cleanserCompany: cleanser?.company ?? null,
    cleanserProductName: cleanser?.productName ?? null,
    sunscreenBrand: sunscreen?.brand ?? null,
    sunscreenCompany: sunscreen?.company ?? null,
    sunscreenProductName: sunscreen?.productName ?? null,
    moisturizerBrand: moisturizer?.brand ?? null,
    moisturizerCompany: moisturizer?.company ?? null,
    moisturizerProductName: moisturizer?.productName ?? null,
    repairSerumBrand: repairSerum?.brand ?? null,
    repairSerumCompany: repairSerum?.company ?? null,
    repairSerumProductName: repairSerum?.productName ?? null
  };
}

async function buildApprovedProductsPayload(report: ReportDetailDto) {
  const rows = normalizeDoctorProductRows(report.doctorReview.productRows);
  const catalogProducts = rows.length > 0
    ? await prisma.productCatalog.findMany()
    : [];
  const supabaseProducts = rows.length > 0
    ? await listSupabaseProductMetadata()
    : [];
  const catalogById = new Map(catalogProducts.map((product) => [product.id, product]));
  const supabaseProductById = new Map(
    supabaseProducts
      .filter((product): product is { id: number; brand_name: string | null; product_name: string | null; image_url: string | null } => typeof product.id === "number")
      .map((product) => [product.id, product])
  );
  const fallbackConcerns = [...report.analysisOutput.primaryConcerns, ...report.analysisOutput.secondaryConcerns]
    .filter(Boolean)
    .join(", ");

  function findCatalogProductForRow(row: DoctorProductRowDto) {
    if (row.productCatalogId) {
      const directMatch = catalogById.get(row.productCatalogId);
      if (directMatch) {
        return directMatch;
      }
    }

    const normalizedBrand = normalizeComparableText(row.brand ?? row.company ?? null);
    const normalizedProductName = normalizeComparableText(row.productName);

    if (!normalizedBrand && !normalizedProductName) {
      return null;
    }

    return (
      catalogProducts.find((product) => {
        const productBrand = normalizeComparableText(product.brandName);
        const productName = normalizeComparableText(product.productName);

        if (normalizedBrand && normalizedProductName) {
          return productBrand === normalizedBrand && productName === normalizedProductName
        }

        if (normalizedProductName) {
          return productName === normalizedProductName;
        }

        return productBrand === normalizedBrand;
      }) ?? null
    );
  }

  return rows.flatMap((row) => {
    const catalogProduct = findCatalogProductForRow(row);
    const brandName = catalogProduct?.brandName ?? row.brand ?? row.company ?? "";
    const productName = catalogProduct?.productName ?? row.productName ?? "";

    if (!brandName && !productName) {
      return [];
    }

    const claimedSkinType = catalogProduct
      ? stringArrayFromJson(catalogProduct.claimedSkinTypes).join(", ")
      : "";
    const claimedSkinConcerns = catalogProduct
      ? stringArrayFromJson(catalogProduct.claimedSkinConcerns).join(", ")
      : "";
    const normalizedBrand = normalizeComparableText(brandName);
    const normalizedProductName = normalizeComparableText(productName);
    const supabaseProduct = (
      (typeof catalogProduct?.sourceRowNumber === "number" ? supabaseProductById.get(catalogProduct.sourceRowNumber) : null) ??
      supabaseProducts.find((product) => {
        const productBrand = normalizeComparableText(product.brand_name ?? null);
        const foundProductName = normalizeComparableText(product.product_name ?? null);
        return productBrand === normalizedBrand && foundProductName === normalizedProductName;
      }) ??
      null
    );

    return [
      {
        id: catalogProduct?.sourceRowNumber ?? null,
        mrp: numberFromNullableString(catalogProduct?.mrp ?? null),
        qty: catalogProduct?.qty ?? null,
        image_url: supabaseProduct?.image_url ?? null,
        brand_name: brandName,
        product_name: productName,
        product_type: catalogProduct?.productType ?? getProductTypeFallback(row.slot, row.title),
        claimed_skin_type: claimedSkinType || report.analysisOutput.skinType,
        claimed_skin_concerns: claimedSkinConcerns || fallbackConcerns
      }
    ];
  });
}

function getSupabaseUserId(report: ReportDetailDto) {
  if (!report.syncedProfile) {
    return null;
  }

  const profileJson = report.syncedProfile.profileJson as Record<string, unknown>;
  const userId = profileJson.user_id ?? profileJson.quiz_user_id ?? profileJson.userId ?? profileJson.id;

  return typeof userId === "string" && userId.trim().length > 0 ? userId : null;
}

function getSupabaseUserEmail(report: ReportDetailDto) {
  return report.syncedProfile?.email?.trim() || null;
}

function getSupabaseQuizResultId(report: ReportDetailDto) {
  if (!report.syncedProfile) {
    return null;
  }

  const profileJson = report.syncedProfile.profileJson as Record<string, unknown>;
  const quizResultId = profileJson.quiz_result_id ?? profileJson.quizResultId ?? report.syncedProfile.externalId;

  return typeof quizResultId === "string" && quizResultId.trim().length > 0 ? quizResultId : null;
}

function toAbsoluteReportUrl(pdfUrl: string | null | undefined) {
  if (!pdfUrl) {
    return null;
  }

  if (pdfUrl.startsWith("http://") || pdfUrl.startsWith("https://")) {
    return pdfUrl;
  }

  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl || !pdfUrl.startsWith("/")) {
    return pdfUrl;
  }

  return `${appUrl.replace(/\/$/, "")}${pdfUrl}`;
}

async function syncApprovedProductsToSupabase(report: ReportDetailDto) {
  const userId = getSupabaseUserId(report);
  const userEmail = getSupabaseUserEmail(report);

  if (!userId && !userEmail) {
    return;
  }

  await updateSupabaseUserProducts({
    userId,
    userEmail,
    products: await buildApprovedProductsPayload(report)
  });
}

async function resolveReportInput(input: CreateReportInputDto) {
  const syncedProfile = input.syncedProfileId ? await getSyncedProfileById(input.syncedProfileId) : null;

  if (input.syncedProfileId && !syncedProfile) {
    throw new Error("Supabase profile not found");
  }

  const syncedScanUrls = extractStoredScanUrls(syncedProfile);
  const imageUrls = [input.assets.image1Url, input.assets.image2Url, input.assets.image3Url].map(
    (value, index) => value || syncedScanUrls[index] || null
  );
  const questionnaireText = input.assets.questionnaireText || syncedProfile?.profileSummary || "";
  const quizSummaryJson = input.assets.quizSummaryJson ?? syncedProfile?.quizSummaryJson ?? syncedProfile?.quizJson ?? null;
  const scanContextJson = input.assets.scanContextJson ?? syncedProfile?.scansJson ?? null;

  const resolvedInput: CreateReportInputDto = {
    ...input,
    assets: {
      ...input.assets,
      image1Url: imageUrls[0],
      image2Url: imageUrls[1],
      image3Url: imageUrls[2],
      questionnaireText,
      quizSummaryJson,
      scanContextJson
    }
  };

  const catalogForPrompt = input.includeProductCatalogInPrompt
    ? await prisma.productCatalog.findMany({
        orderBy: [{ category: "asc" }, { productType: "asc" }, { brandName: "asc" }, { productName: "asc" }]
      })
    : [];
  const promptText =
    input.promptText?.trim() ||
    buildManualPrompt({
      patientInfo: resolvedInput.patientInfo,
      assets: {
        ...resolvedInput.assets,
        quizSummaryJson,
        scanContextJson,
        image1Url: imageUrls[0],
        image2Url: imageUrls[1],
        image3Url: imageUrls[2]
      },
      promptInputMode: resolvedInput.promptInputMode,
      productCatalogText: input.includeProductCatalogInPrompt
        ? formatProductCatalogForPrompt(catalogForPrompt)
        : null
    });

  return {
    syncedProfile,
    resolvedInput,
    promptText
  };
}

async function buildDraftAndSource(input: CreateReportInputDto, promptText: string) {
  if (input.reportDraftOverride) {
    return {
      draft: normalizeDraftScore(input.reportDraftOverride),
      rawResponseText: JSON.stringify(input.reportDraftOverride, null, 2),
      provider: "manual-import",
      promptText
    };
  }

  if (input.analysisOverride) {
    const draft = normalizeDraftScore(buildDraftFromAnalysis(input.analysisOverride, input.assets.quizSummaryJson));
    return {
      draft,
      rawResponseText: JSON.stringify(draft, null, 2),
      provider: "manual-analysis",
      promptText
    };
  }

  const analysisResult = await generateValidatedAnalysis(input);
  const draft = normalizeDraftScore(buildDraftFromAnalysis(analysisResult.analysis, input.assets.quizSummaryJson));

  return {
    draft,
    rawResponseText: JSON.stringify(draft, null, 2),
    provider: analysisResult.provider,
    promptText: JSON.stringify(analysisResult.prompt, null, 2)
  };
}

export async function buildPromptPreview(input: CreateReportInputDto): Promise<BuildPromptResultDto> {
  const validatedInput = createReportRequestSchema.parse(input);
  const resolved = await resolveReportInput(validatedInput);

  return {
    promptText: resolved.promptText,
    resolvedInput: resolved.resolvedInput
  };
}

export async function createReport(input: CreateReportInputDto): Promise<ReportDetailDto> {
  const validatedInput = createReportRequestSchema.parse(input);
  const resolved = await resolveReportInput(validatedInput);
  const draftResult = await buildDraftAndSource(resolved.resolvedInput, resolved.promptText);
  const catalog = await prisma.productCatalog.findMany();
  const fallbackProductMatches = rankProductsForDraft({
    patientSkinType: draftResult.draft.analysis.overall_skin_profile.skin_type,
    quizSummaryJson: resolved.resolvedInput.assets.quizSummaryJson,
    draft: draftResult.draft,
    catalog
  });
  const aiRecommendedMatches = resolved.resolvedInput.includeProductCatalogInPrompt
    ? resolveAiRecommendedProducts(draftResult.draft.recommended_products, catalog)
    : [];
  const productMatches = mergePreferredProductMatches(aiRecommendedMatches, fallbackProductMatches);
  const defaultProductRows = buildDefaultDoctorProductRows(productMatches);
  const legacyDoctorProductFields = buildLegacyDoctorFieldsFromRows(defaultProductRows);

  const record = await prisma.report.create({
    data: {
      status: "draft_generated",
      intakeSource: resolved.resolvedInput.intakeSource,
      promptInputMode: resolved.resolvedInput.promptInputMode,
      syncedProfile: resolved.syncedProfile
        ? {
            connect: {
              id: resolved.syncedProfile.id
            }
          }
        : undefined,
      patientInfo: {
        create: {
          name: resolved.resolvedInput.patientInfo.name,
          age: resolved.resolvedInput.patientInfo.age,
          sex: resolved.resolvedInput.patientInfo.sex,
          reportDate: new Date(resolved.resolvedInput.patientInfo.reportDate),
          inputSources: resolved.resolvedInput.patientInfo.inputSources
        }
      },
      assets: {
        create: {
          image1Url: resolved.resolvedInput.assets.image1Url || null,
          image2Url: resolved.resolvedInput.assets.image2Url || null,
          image3Url: resolved.resolvedInput.assets.image3Url || null,
          questionnaireText: resolved.resolvedInput.assets.questionnaireText || "",
          rawFindingsText: resolved.resolvedInput.assets.rawFindingsText || "",
          visibleIssues: resolved.resolvedInput.assets.visibleIssues,
          negativeFindings: resolved.resolvedInput.assets.negativeFindings,
          profileHints: resolved.resolvedInput.assets.profileHints,
          scanContextJson: resolved.resolvedInput.assets.scanContextJson ?? undefined,
          quizSummaryJson: resolved.resolvedInput.assets.quizSummaryJson ?? undefined
        }
      },
      analysisOutput: {
        create: {
          skinScore: draftResult.draft.analysis.skin_score.score,
          skinScoreLabel: draftResult.draft.analysis.skin_score.label,
          skinType: draftResult.draft.analysis.overall_skin_profile.skin_type,
          condition: draftResult.draft.analysis.overall_skin_profile.condition,
          overallSeverity: draftResult.draft.analysis.overall_skin_profile.overall_severity,
          primaryConcerns: draftResult.draft.analysis.key_skin_concerns.primary,
          secondaryConcerns: draftResult.draft.analysis.key_skin_concerns.secondary,
          positiveFindings: draftResult.draft.analysis.positive_findings,
          oilLevels: draftResult.draft.analysis.primary_observations.oil_levels,
          hydration: draftResult.draft.analysis.primary_observations.hydration,
          texture: draftResult.draft.analysis.primary_observations.texture,
          tone: draftResult.draft.analysis.primary_observations.tone,
          ingredientPlan: draftResult.draft.ingredient_plan,
          routinePlan: draftResult.draft.routine_plan,
          productMatchingNotes: draftResult.draft.product_matching,
          doctorHandoffJson: draftResult.draft.doctor_handoff,
          rawModelJson: draftResult.draft.analysis
        }
      },
      promptSession: {
        create: {
          status: "completed",
          promptText: draftResult.promptText,
          promptContext: {
            provider: draftResult.provider,
            intakeSource: resolved.resolvedInput.intakeSource,
            promptInputMode: resolved.resolvedInput.promptInputMode,
            includeProductCatalogInPrompt: resolved.resolvedInput.includeProductCatalogInPrompt,
            syncedProfileId: resolved.syncedProfile?.id ?? null
          },
          responseRawText: draftResult.rawResponseText,
          responseJson: draftResult.draft
        }
      },
      doctorReview: {
        create: {
          ...legacyDoctorProductFields,
          productRows: defaultProductRows as Prisma.InputJsonValue,
          morningRoutine: buildRoutineItems(draftResult.draft.routine_plan.morning),
          nightRoutine: buildRoutineItems(draftResult.draft.routine_plan.night),
          doThis: [],
          notThat: [],
          expertTips: [],
          doctorNotes: null
        }
      },
      generatedFile: {
        create: {
          pdfUrl: null,
          htmlSnapshotPath: null
        }
      },
      productMatches: {
        create: productMatches.map((match) => ({
          slot: match.slot,
          rank: match.rank,
          matchScore: match.matchScore,
          reasonJson: match.reasonJson as Prisma.InputJsonValue,
          product: {
            connect: {
              id: match.product.id
            }
          }
        }))
      }
    },
    include: reportInclude
  });

  const serializedReport = serializeReport(record);
  await sendTelegramMessage(`draft for ${serializedReport.patientInfo.name} report is generated`);

  return serializedReport;
}

function serializeProductCatalogRecord(product: Awaited<ReturnType<typeof prisma.productCatalog.findMany>>[number]): ProductCatalogDto {
  return {
    id: product.id,
    sourceRowNumber: product.sourceRowNumber ?? null,
    brandName: product.brandName,
    productName: product.productName,
    qty: product.qty ?? null,
    mrp: numberFromNullableString(product.mrp),
    imageUrl: null,
    category: product.category ?? null,
    productType: product.productType ?? null,
    claimedSkinTypes: stringArrayFromJson(product.claimedSkinTypes),
    claimedSkinConcerns: stringArrayFromJson(product.claimedSkinConcerns),
    heroIngredients: stringArrayFromJson(product.heroIngredients),
    otherKeyIngredients: stringArrayFromJson(product.otherKeyIngredients),
    potentialIrritants: stringArrayFromJson(product.potentialIrritants),
    textureFinish: product.textureFinish ?? null,
    overallSuitabilityScore: product.overallSuitabilityScore ?? null,
    productUrl: product.productUrl ?? null
  };
}

export async function listProductCatalog(): Promise<ProductCatalogDto[]> {
  const catalog = await prisma.productCatalog.findMany({
    orderBy: [{ category: "asc" }, { productType: "asc" }, { brandName: "asc" }, { productName: "asc" }]
  });

  return catalog.map(serializeProductCatalogRecord);
}

export async function listReports(status?: ReportStatusDto): Promise<ReportListItemDto[]> {
  const parsedStatus = status ? reportStatusSchema.parse(status) : undefined;
  const reports = await prisma.report.findMany({
    where: parsedStatus ? { status: parsedStatus } : undefined,
    include: reportInclude,
    orderBy: {
      createdAt: "desc"
    }
  });

  return reports.map(toReportListItem);
}

export async function getReportById(id: string): Promise<ReportDetailDto> {
  const report = await prisma.report.findUnique({
    where: {
      id
    },
    include: reportInclude
  });

  if (!report) {
    throw new Error("Report not found");
  }

  return serializeReport(report);
}

function resolveManagedFilePath(fileUrl: string | null | undefined) {
  if (!fileUrl?.startsWith("/")) {
    return null;
  }

  const managedRoots = [
    {
      prefix: "/generated/reports/",
      dir: getGeneratedReportsDir()
    },
    {
      prefix: "/uploads/reports/",
      dir: getUploadsReportsDir()
    }
  ];

  const match = managedRoots.find((item) => fileUrl.startsWith(item.prefix));

  if (!match) {
    return null;
  }

  const relativePath = fileUrl.slice(match.prefix.length);

  if (!relativePath) {
    return null;
  }

  return path.join(match.dir, relativePath);
}

async function cleanupManagedReportFiles(report: {
  assets?: {
    image1Url: string | null;
    image2Url: string | null;
    image3Url: string | null;
  } | null;
  generatedFile?: {
    pdfUrl: string | null;
    htmlSnapshotPath: string | null;
  } | null;
}) {
  const filePaths = new Set<string>();

  if (report.generatedFile?.htmlSnapshotPath) {
    filePaths.add(report.generatedFile.htmlSnapshotPath);
  }

  const managedUrls = [
    report.generatedFile?.pdfUrl,
    report.assets?.image1Url,
    report.assets?.image2Url,
    report.assets?.image3Url
  ];

  for (const fileUrl of managedUrls) {
    const managedPath = resolveManagedFilePath(fileUrl);

    if (managedPath) {
      filePaths.add(managedPath);
    }
  }

  await Promise.all(
    Array.from(filePaths).map(async (filePath) => {
      try {
        await rm(filePath, { force: true });
      } catch {
        // Report deletion should succeed even if local file cleanup does not.
      }
    })
  );
}

function buildAnalysisFromDoctorOverride(
  analysisOverride: NonNullable<DoctorReviewInputDto["analysisOverride"]>
): AnalysisOutput {
  const normalizedScore = normalizeSkinScore(analysisOverride.skinScore);

  return {
    skin_score: {
      score: normalizedScore,
      label: getSkinScoreLabel(normalizedScore)
    },
    overall_skin_profile: {
      skin_type: analysisOverride.skinType,
      condition: analysisOverride.condition,
      overall_severity: analysisOverride.overallSeverity
    },
    key_skin_concerns: {
      primary: analysisOverride.primaryConcerns,
      secondary: analysisOverride.secondaryConcerns
    },
    positive_findings: analysisOverride.positiveFindings,
    primary_observations: {
      oil_levels: analysisOverride.oilLevels,
      hydration: analysisOverride.hydration,
      texture: analysisOverride.texture,
      tone: analysisOverride.tone
    }
  };
}

function buildDoctorEditedAnalysisUpdate(
  analysisOverride: NonNullable<DoctorReviewInputDto["analysisOverride"]>
) {
  const rawModelJson = buildAnalysisFromDoctorOverride(analysisOverride);

  return {
    skinScore: rawModelJson.skin_score.score,
    skinScoreLabel: rawModelJson.skin_score.label,
    skinType: analysisOverride.skinType,
    condition: analysisOverride.condition,
    overallSeverity: analysisOverride.overallSeverity,
    primaryConcerns: analysisOverride.primaryConcerns as Prisma.InputJsonValue,
    secondaryConcerns: analysisOverride.secondaryConcerns as Prisma.InputJsonValue,
    positiveFindings: analysisOverride.positiveFindings as Prisma.InputJsonValue,
    oilLevels: analysisOverride.oilLevels,
    hydration: analysisOverride.hydration,
    texture: analysisOverride.texture,
    tone: analysisOverride.tone,
    rawModelJson: rawModelJson as Prisma.InputJsonValue
  };
}

export async function updateDoctorReview(
  reportId: string,
  input: DoctorReviewInputDto
): Promise<ReportDetailDto> {
  const reviewer = await getCurrentUser();
  const validatedInput = doctorReviewUpdateSchema.parse(input);
  const {
    analysisOverride,
    productRows,
    cleanserBrand,
    cleanserCompany,
    cleanserProductName,
    sunscreenBrand,
    sunscreenCompany,
    sunscreenProductName,
    moisturizerBrand,
    moisturizerCompany,
    moisturizerProductName,
    repairSerumBrand,
    repairSerumCompany,
    repairSerumProductName,
    ...doctorReviewInput
  } = validatedInput;

  const existingReport = await prisma.report.findUnique({
    where: {
      id: reportId
    },
    include: reportInclude
  });

  if (!existingReport) {
    throw new Error("Report not found");
  }

  const catalog = analysisOverride ? await prisma.productCatalog.findMany() : [];
  const rerankedMatches: ReturnType<typeof rankProductsForDraft> | null = analysisOverride
    ? rankProductsForDraft({
        patientSkinType: analysisOverride.skinType,
        quizSummaryJson: existingReport.assets?.quizSummaryJson ?? undefined,
        draft: normalizeDraftScore(buildDraftFromAnalysis(buildAnalysisFromDoctorOverride(analysisOverride), existingReport.assets?.quizSummaryJson ?? undefined)),
        catalog
      })
    : null;

  const existingSerializedReport = serializeReport(existingReport);
  const submittedLegacyFields: LegacyDoctorProductFields = {
    cleanserBrand,
    cleanserCompany,
    cleanserProductName,
    sunscreenBrand,
    sunscreenCompany,
    sunscreenProductName,
    moisturizerBrand,
    moisturizerCompany,
    moisturizerProductName,
    repairSerumBrand,
    repairSerumCompany,
    repairSerumProductName
  };
  const candidateProductRows = productRows.length > 0
    ? productRows
    : hasAnyLegacyProductFields(submittedLegacyFields)
      ? buildProductRowsFromLegacyFields(submittedLegacyFields)
      : existingSerializedReport.doctorReview.productRows.length > 0
        ? existingSerializedReport.doctorReview.productRows
        : buildDefaultDoctorProductRows(rerankedMatches ?? existingSerializedReport.productMatches);
  const normalizedProductRows = normalizeDoctorProductRows(candidateProductRows);
  const legacyDoctorProductFields = buildLegacyDoctorFieldsFromRows(normalizedProductRows);

  const report = await prisma.report.update({
    where: {
      id: reportId
    },
    data: {
      doctorReview: {
        update: {
          ...doctorReviewInput,
          ...legacyDoctorProductFields,
          productRows: normalizedProductRows as Prisma.InputJsonValue,
          reviewedByUserId: reviewer?.id ?? null
        }
      },
      ...(analysisOverride
        ? {
            analysisOutput: {
              update: buildDoctorEditedAnalysisUpdate(analysisOverride)
            },
            productMatches: {
              deleteMany: {},
              create: rerankedMatches?.map((match) => ({
                slot: match.slot,
                rank: match.rank,
                matchScore: match.matchScore,
                reasonJson: match.reasonJson as Prisma.InputJsonValue,
                product: {
                  connect: {
                    id: match.product.id
                  }
                }
              }))
            }
          }
        : {})
    },
    include: reportInclude
  });

  return serializeReport(report);
}

export async function updateReportStatus(reportId: string, status: ReportStatusDto) {
  const validatedStatus = reportStatusSchema.parse(status);
  const report = await prisma.report.update({
    where: {
      id: reportId
    },
    data: {
      status: validatedStatus
    },
    include: reportInclude
  });

  return serializeReport(report);
}

export async function deleteReport(reportId: string) {
  const report = await prisma.report.findUnique({
    where: {
      id: reportId
    },
    select: {
      id: true,
      assets: {
        select: {
          image1Url: true,
          image2Url: true,
          image3Url: true
        }
      },
      generatedFile: {
        select: {
          pdfUrl: true,
          htmlSnapshotPath: true
        }
      }
    }
  });

  if (!report) {
    throw new Error("Report not found");
  }

  await prisma.report.delete({
    where: {
      id: reportId
    }
  });

  await cleanupManagedReportFiles(report);

  return {
    id: reportId,
    deleted: true
  };
}

export async function approveReport(reportId: string) {
  const reviewer = await getCurrentUser();
  const report = await prisma.report.update({
    where: {
      id: reportId
    },
    data: {
      status: "approved",
      approvedAt: new Date(),
      approvedByUserId: reviewer?.id ?? null,
      doctorReview: {
        update: {
          reviewedByUserId: reviewer?.id ?? null
        }
      }
    },
    include: reportInclude
  });

  const serializedReport = serializeReport(report);
  await syncApprovedProductsToSupabase(serializedReport);
  await sendTelegramMessage(`doctor has approved ${serializedReport.patientInfo.name} report`);

  return serializedReport;
}

export async function markReportSent(reportId: string) {
  const existingReport = await prisma.report.findUnique({
    where: {
      id: reportId
    },
    select: {
      status: true
    }
  });

  if (!existingReport) {
    throw new Error("Report not found");
  }

  if (!["approved", "sent_to_user"].includes(existingReport.status)) {
    throw new Error("Report must be approved before sending to the user");
  }

  const report = await prisma.report.update({
    where: {
      id: reportId
    },
    data: {
      status: "sent_to_user",
      sentAt: new Date()
    },
    include: reportInclude
  });

  return serializeReport(report);
}

export async function saveGeneratedFiles(
  reportId: string,
  input: {
    pdfUrl: string;
    htmlSnapshotPath: string;
  }
) {
  const report = await prisma.report.update({
    where: {
      id: reportId
    },
    data: {
      generatedFile: {
        update: {
          pdfUrl: input.pdfUrl,
          htmlSnapshotPath: input.htmlSnapshotPath
        }
      }
    },
    include: reportInclude
  });

  const serializedReport = serializeReport(report);
  const quizResultId = getSupabaseQuizResultId(serializedReport);
  const absoluteReportUrl = toAbsoluteReportUrl(serializedReport.generatedFile?.pdfUrl ?? null);

  if (quizResultId && absoluteReportUrl) {
    await updateSupabaseQuizResultReport({
      quizResultId,
      reportUrl: absoluteReportUrl
    });
  }

  return serializedReport;
}
