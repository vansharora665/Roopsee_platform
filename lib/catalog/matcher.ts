import type { ProductCatalog } from "@prisma/client";

import { deriveQuizInsights, detectSensitivitySignals, summarizeQuizAnswers } from "@/lib/quiz/summary";
import type { ProductSlotDto } from "@/lib/report/types";
import type {
  RecommendedProduct,
  RecommendedProducts,
  ReportDraft
} from "@/lib/validators/draft";

export type ProductCandidate = Pick<
  ProductCatalog,
  | "id"
  | "brandName"
  | "productName"
  | "category"
  | "productType"
  | "claimedSkinTypes"
  | "claimedSkinConcerns"
  | "heroIngredients"
  | "otherKeyIngredients"
  | "potentialIrritants"
  | "textureFinish"
  | "overallSuitabilityScore"
  | "productUrl"
  | "redFlags"
  | "suitableForSensitiveSkin"
  | "ingredientSkinTypeAlignment"
>;

export type RankedProductMatch = {
  slot: ProductSlotDto;
  rank: number;
  matchScore: number;
  reasonJson: Record<string, unknown>;
  product: ProductCandidate;
};

type MatchContext = {
  patientSkinType: string;
  quizSummaryJson?: unknown;
  draft: ReportDraft;
  catalog: ProductCandidate[];
};

const slotKeywords: Record<ProductSlotDto, string[]> = {
  cleanser: ["cleanser", "face wash", "facewash", "face cleanser", "gel cleanser", "foaming cleanser"],
  sunscreen: ["sunscreen", "spf", "sun screen", "sunblock"],
  moisturizer: ["moisturizer", "cream", "lotion", "gel moisturizer", "barrier cream"],
  repair_serum: ["serum", "repair", "treatment", "active", "corrector", "spot cream", "gel cream"]
};

const slotExclusionKeywords: Record<ProductSlotDto, string[]> = {
  cleanser: ["serum", "sunscreen", "spf", "moisturizer", "lotion", "lip", "body", "balm", "mask"],
  sunscreen: ["serum", "cleanser", "face wash", "moisturizer", "lip balm", "body lotion"],
  moisturizer: ["serum", "cleanser", "face wash", "sunscreen", "spf", "lip", "body"],
  repair_serum: ["cleanser", "face wash", "sunscreen", "spf", "lip", "body", "soap"]
};

type CleanserPreference = {
  preferredKeywords: string[];
  discouragedKeywords: string[];
  label: string;
};

function stringArrayFromUnknown(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function tokenize(values: string[]) {
  return values.map((value) => value.trim().toLowerCase()).filter(Boolean);
}

function includesToken(haystack: string[], needle: string) {
  const lowerNeedle = needle.toLowerCase();
  return haystack.some((item) => item.includes(lowerNeedle) || lowerNeedle.includes(item));
}

function slotMatchesProduct(slot: ProductSlotDto, product: ProductCandidate) {
  const haystack = tokenize([
    product.category ?? "",
    product.productType ?? "",
    product.productName,
    product.brandName
  ]);

  return slotKeywords[slot].some((keyword) => includesToken(haystack, keyword));
}

function getProductTextPool(product: ProductCandidate) {
  return tokenize([
    product.category ?? "",
    product.productType ?? "",
    product.productName,
    product.brandName,
    product.textureFinish ?? ""
  ]);
}

function isFaceProduct(product: ProductCandidate) {
  const category = (product.category ?? "").toLowerCase();
  return category.length === 0 || category.includes("face");
}

function hasExcludedSlotKeyword(slot: ProductSlotDto, pool: string[]) {
  return slotExclusionKeywords[slot].some((keyword) => includesToken(pool, keyword));
}

function isEligibleForSlot(slot: ProductSlotDto, product: ProductCandidate) {
  const productTextPool = getProductTextPool(product);
  const productType = (product.productType ?? "").toLowerCase();
  const category = (product.category ?? "").toLowerCase();

  if (!isFaceProduct(product)) {
    return false;
  }

  if (hasExcludedSlotKeyword(slot, productTextPool)) {
    return false;
  }

  if (slot === "cleanser") {
    return slotMatchesProduct(slot, product) || productType.includes("cleanser") || productType.includes("face wash");
  }

  if (slot === "sunscreen") {
    return slotMatchesProduct(slot, product) || productType.includes("sunscreen") || productTextPool.some((item) => item.includes("spf"));
  }

  if (slot === "moisturizer") {
    return productType.includes("moisturizer") || productType.includes("cream") || productType.includes("lotion") || category.includes("face");
  }

  return productType.includes("serum") || productType.includes("treatment") || productTextPool.some((item) => item.includes("repair") || item.includes("active"));
}

function getCleanserPreference(args: {
  patientSkinType: string;
  concerns: string[];
  quizSummaryJson?: unknown;
  oilLevels: string;
  hydration: string;
}) : CleanserPreference {
  const quizTokens = tokenize(summarizeQuizAnswers(args.quizSummaryJson));
  const signalPool = tokenize([
    args.patientSkinType,
    ...args.concerns,
    args.oilLevels,
    args.hydration,
    ...quizTokens
  ]);

  const oilySignals = ["oily", "acne", "breakout", "comedone", "high", "combination"];
  const gentleSignals = ["dry", "dehydrated", "sensitive", "redness", "low", "barrier"];

  if (oilySignals.some((signal) => includesToken(signalPool, signal))) {
    return {
      preferredKeywords: ["face wash", "facewash", "foaming", "foam", "gel cleanser", "gel"],
      discouragedKeywords: ["cleansing balm", "milk cleanser", "cream cleanser"],
      label: "clarifying_facewash"
    };
  }

  if (gentleSignals.some((signal) => includesToken(signalPool, signal))) {
    return {
      preferredKeywords: ["cleanser", "gentle", "cream cleanser", "hydrating", "lotion cleanser"],
      discouragedKeywords: ["foaming", "face wash", "scrub"],
      label: "gentle_cleanser"
    };
  }

  return {
    preferredKeywords: ["cleanser", "face wash", "facewash"],
    discouragedKeywords: [],
    label: "balanced_cleanser"
  };
}

function extractIngredientPool(product: ProductCandidate) {
  return tokenize([
    ...stringArrayFromUnknown(product.heroIngredients),
    ...stringArrayFromUnknown(product.otherKeyIngredients)
  ]);
}

function extractConcernPool(product: ProductCandidate) {
  return tokenize(stringArrayFromUnknown(product.claimedSkinConcerns));
}

function extractSkinTypePool(product: ProductCandidate) {
  return tokenize([
    ...stringArrayFromUnknown(product.claimedSkinTypes),
    product.ingredientSkinTypeAlignment ?? ""
  ]);
}

function extractIrritantPool(product: ProductCandidate) {
  return tokenize([
    ...stringArrayFromUnknown(product.potentialIrritants),
    ...stringArrayFromUnknown(product.redFlags)
  ]);
}

export function rankProductsForDraft({ patientSkinType, quizSummaryJson, draft, catalog }: MatchContext) {
  const quizInsights = deriveQuizInsights(quizSummaryJson);
  const concerns = tokenize([
    ...draft.analysis.key_skin_concerns.primary,
    ...draft.analysis.key_skin_concerns.secondary,
    ...draft.product_matching.target_concerns,
    ...quizInsights.concernCandidates,
    ...quizInsights.secondaryConcernCandidates
  ]);
  const preferredTextures = tokenize([
    ...draft.product_matching.preferred_textures,
    ...quizInsights.preferredTextures
  ]);
  const avoidIngredients = tokenize([
    ...draft.product_matching.avoid_ingredients,
    ...quizInsights.avoidIngredients
  ]);
  const patientSkinTypeTokens = tokenize([patientSkinType, ...quizInsights.skinTypeHints]);
  const detectedSignals = detectSensitivitySignals(summarizeQuizAnswers(quizSummaryJson));
  const sensitivitySignals = {
    sensitive: detectedSignals.sensitive || quizInsights.flags.sensitive,
    pregnant: detectedSignals.pregnant || quizInsights.flags.pregnant,
    eczema: detectedSignals.eczema || quizInsights.flags.eczema,
    psoriasis: detectedSignals.psoriasis || quizInsights.flags.psoriasis
  };

  return (Object.keys(slotKeywords) as ProductSlotDto[]).flatMap((slot) => {
    const desiredSlot = draft.ingredient_plan[slot];
    const desiredHeroIngredients = tokenize(desiredSlot.hero_ingredients);
    const desiredSupportingIngredients = tokenize(desiredSlot.supporting_ingredients);
    const cleanserPreference = slot === "cleanser"
      ? getCleanserPreference({
          patientSkinType,
          concerns,
          quizSummaryJson,
          oilLevels: draft.analysis.primary_observations.oil_levels,
          hydration: draft.analysis.primary_observations.hydration
        })
      : null;

    const eligibleCatalog = catalog.filter((product) => isEligibleForSlot(slot, product));
    const candidateCatalog = eligibleCatalog.length > 0 ? eligibleCatalog : catalog;

    const ranked = candidateCatalog
      .map((product) => {
        const ingredientPool = extractIngredientPool(product);
        const concernPool = extractConcernPool(product);
        const skinTypePool = extractSkinTypePool(product);
        const irritantPool = extractIrritantPool(product);
        const productTextPool = getProductTextPool(product);
        const textureText = (product.textureFinish ?? "").toLowerCase();
        const matchedHeroIngredients = desiredHeroIngredients.filter((ingredient) =>
          includesToken(ingredientPool, ingredient)
        );
        const matchedSupportingIngredients = desiredSupportingIngredients.filter((ingredient) =>
          includesToken(ingredientPool, ingredient)
        );
        const matchedConcerns = concerns.filter((concern) => includesToken(concernPool, concern));
        const matchedSkinTypes = patientSkinTypeTokens.filter((item) => includesToken(skinTypePool, item));
        const matchedTextures = preferredTextures.filter((texture) => textureText.includes(texture));
        const matchedCleanserFormat = cleanserPreference
          ? cleanserPreference.preferredKeywords.filter((keyword) => includesToken(productTextPool, keyword))
          : [];
        const discouragedCleanserFormat = cleanserPreference
          ? cleanserPreference.discouragedKeywords.filter((keyword) => includesToken(productTextPool, keyword))
          : [];
        const avoidedIngredientHits = avoidIngredients.filter((ingredient) =>
          includesToken(ingredientPool, ingredient) || includesToken(irritantPool, ingredient)
        );

        const penalties: string[] = [];
        let score = 0;

        if (slotMatchesProduct(slot, product)) {
          score += 36;
        } else {
          score -= 12;
          penalties.push("slot_mismatch");
        }

        if (!isEligibleForSlot(slot, product)) {
          score -= 40;
          penalties.push("slot_ineligible");
        }

        score += matchedHeroIngredients.length * 14;
        score += matchedSupportingIngredients.length * 6;
        score += matchedConcerns.length * 6;
        score += matchedSkinTypes.length * 7;
        score += matchedTextures.length * 4;
        score += (product.overallSuitabilityScore ?? 0) * 4;

        if (cleanserPreference) {
          score += matchedCleanserFormat.length * 8;
          if (matchedCleanserFormat.length === 0) {
            score -= 3;
          }

          if (discouragedCleanserFormat.length > 0) {
            penalties.push(...discouragedCleanserFormat.map((item) => `cleanser_format:${item}`));
            score -= discouragedCleanserFormat.length * 8;
          }
        }

        if (sensitivitySignals.sensitive) {
          if ((product.suitableForSensitiveSkin ?? "").toLowerCase().includes("yes")) {
            score += 6;
          }

          const sensitivePenalties = irritantPool.filter((item) =>
            ["fragrance", "essential oil", "perfume", "alcohol", "menthol"].some((flag) =>
              item.includes(flag)
            )
          );

          if (sensitivePenalties.length) {
            penalties.push(...sensitivePenalties.map((item) => `sensitivity:${item}`));
            score -= sensitivePenalties.length * 8;
          }
        }

        if (sensitivitySignals.pregnant) {
          const pregnancyFlags = ingredientPool.filter((item) =>
            ["retinol", "retinoid", "hydroquinone"].some((flag) => item.includes(flag))
          );

          if (pregnancyFlags.length) {
            penalties.push(...pregnancyFlags.map((item) => `pregnancy:${item}`));
            score -= pregnancyFlags.length * 10;
          }
        }

        if (avoidedIngredientHits.length) {
          penalties.push(...avoidedIngredientHits.map((item) => `avoid:${item}`));
          score -= avoidedIngredientHits.length * 12;
        }

        return {
          slot,
          matchScore: score,
          product,
          reasonJson: {
            desiredPurpose: desiredSlot.purpose,
            matchedHeroIngredients,
            matchedSupportingIngredients,
            matchedConcerns,
            matchedSkinTypes,
            matchedTextures,
            penalties,
            notes: desiredSlot.notes,
            cleanserPreference: cleanserPreference?.label,
            matchedCleanserFormat,
            discouragedCleanserFormat
          }
        };
      })
      .sort((left, right) => right.matchScore - left.matchScore)
      .slice(0, 3)
      .map((item, index) => ({
        ...item,
        rank: index + 1
      }));

    return ranked;
  });
}

function normalizeLookupText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildRecommendationCandidates(recommendation: RecommendedProduct) {
  if (typeof recommendation !== "string") {
    return {
      preferredBrand: recommendation.brand,
      preferredProductName: recommendation.product_name,
      rationale: recommendation.rationale,
      rawLabel: `${recommendation.brand} - ${recommendation.product_name}`,
      candidateTexts: [
        `${recommendation.brand} - ${recommendation.product_name}`,
        `${recommendation.brand} ${recommendation.product_name}`,
        recommendation.product_name
      ]
    };
  }

  const rawLabel = recommendation.trim();
  const withoutBracketPrefix = rawLabel.replace(/^\[[^\]]+\]\s*/, "");
  const beforeMetadata = withoutBracketPrefix.split("|")[0]?.trim() ?? withoutBracketPrefix;
  const dashParts = beforeMetadata.split(/\s+-\s+/g).map((part) => part.trim()).filter(Boolean);
  const preferredBrand = dashParts.length > 1 ? dashParts[0] : "";
  const preferredProductName = dashParts.length > 1 ? dashParts.slice(1).join(" - ") : beforeMetadata;

  return {
    preferredBrand,
    preferredProductName,
    rationale: "",
    rawLabel,
    candidateTexts: [rawLabel, withoutBracketPrefix, beforeMetadata, preferredProductName].filter(Boolean)
  };
}

function findCatalogProductFromRecommendation(
  recommendation: RecommendedProduct,
  catalog: ProductCandidate[],
  slot: ProductSlotDto
) {
  const lookup = buildRecommendationCandidates(recommendation);
  const normalizedBrand = normalizeLookupText(lookup.preferredBrand);
  const normalizedProductName = normalizeLookupText(lookup.preferredProductName);
  const normalizedCandidates = lookup.candidateTexts.map(normalizeLookupText).filter(Boolean);

  if (normalizedBrand && normalizedProductName) {
    const exactMatch = catalog.find((product) => {
      return (
        normalizeLookupText(product.brandName) === normalizedBrand &&
        normalizeLookupText(product.productName) === normalizedProductName
      );
    });

    if (exactMatch && isEligibleForSlot(slot, exactMatch)) {
      return exactMatch;
    }
  }

  const combinedMatch = catalog.find((product) => {
    const combined = normalizeLookupText(`${product.brandName} ${product.productName}`);
    return normalizedCandidates.some((candidate) => candidate === combined);
  });

  if (combinedMatch && isEligibleForSlot(slot, combinedMatch)) {
    return combinedMatch;
  }

  if (normalizedProductName) {
    const productNameMatch = catalog.find((product) => {
      return normalizeLookupText(product.productName) === normalizedProductName;
    });

    if (productNameMatch && isEligibleForSlot(slot, productNameMatch)) {
      return productNameMatch;
    }
  }

  return (
    catalog.find((product) => {
      if (!isEligibleForSlot(slot, product)) {
        return false;
      }
      const combined = normalizeLookupText(`${product.brandName} ${product.productName}`);
      const productName = normalizeLookupText(product.productName);

      return normalizedCandidates.some((candidate) => {
        return (
          combined.includes(candidate) ||
          candidate.includes(combined) ||
          productName.includes(candidate) ||
          candidate.includes(productName)
        );
      });
    }) ?? null
  );
}

function buildRecommendationReason(recommendation: RecommendedProduct) {
  if (typeof recommendation === "string") {
    return {
      source: "ai_catalog_selection",
      selectedText: recommendation
    };
  }

  return {
    source: "ai_catalog_selection",
    rationale: recommendation.rationale,
    selectedBrand: recommendation.brand,
    selectedProductName: recommendation.product_name
  };
}

export function resolveAiRecommendedProducts(
  recommendedProducts: RecommendedProducts | undefined,
  catalog: ProductCandidate[]
): RankedProductMatch[] {
  if (!recommendedProducts) {
    return [];
  }

  return (Object.entries(recommendedProducts) as Array<[ProductSlotDto, RecommendedProduct | null]>).flatMap(
    ([slot, recommendation]) => {
      if (!recommendation) {
        return [];
      }

      const product = findCatalogProductFromRecommendation(recommendation, catalog, slot);

      if (!product || !isEligibleForSlot(slot, product)) {
        return [];
      }

      return [
        {
          slot,
          rank: 1,
          matchScore: 999,
          reasonJson: buildRecommendationReason(recommendation),
          product
        }
      ];
    }
  );
}

export function formatProductCatalogForPrompt(catalog: ProductCandidate[]) {
  if (catalog.length === 0) {
    return "No catalog is loaded in the platform right now.";
  }

  return catalog
    .map((product) => {
      const sourceRowNumber = "sourceRowNumber" in product ? product.sourceRowNumber : null;
      const qty = "qty" in product ? product.qty : null;
      const mrp = "mrp" in product ? product.mrp : null;
      const parts = [
        sourceRowNumber ? `Row ID: ${String(sourceRowNumber)}` : null,
        `[${product.productType ?? product.category ?? "Product"}]`,
        `${product.brandName} - ${product.productName}`,
        qty ? `Qty: ${qty}` : null,
        mrp ? `MRP: ${mrp}` : null,
        product.claimedSkinTypes ? `Skin types: ${stringArrayFromUnknown(product.claimedSkinTypes).join(", ") || "NR"}` : null,
        product.claimedSkinConcerns ? `Concerns: ${stringArrayFromUnknown(product.claimedSkinConcerns).join(", ") || "NR"}` : null,
        product.heroIngredients ? `Hero ingredients: ${stringArrayFromUnknown(product.heroIngredients).join(", ") || "NR"}` : null,
        product.otherKeyIngredients ? `Other ingredients: ${stringArrayFromUnknown(product.otherKeyIngredients).join(", ") || "NR"}` : null,
        product.textureFinish ? `Texture: ${product.textureFinish}` : null,
        product.potentialIrritants ? `Potential irritants: ${stringArrayFromUnknown(product.potentialIrritants).join(", ") || "NR"}` : null,
        product.overallSuitabilityScore !== null ? `Suitability: ${String(product.overallSuitabilityScore)}/5` : null,
        product.productUrl ? `Link: ${product.productUrl}` : null
      ].filter((value): value is string => Boolean(value));

      return `- ${parts.join(" | ")}`;
    })
    .join("\n");
}
