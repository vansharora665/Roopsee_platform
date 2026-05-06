import * as XLSX from "xlsx";

import { deriveQuizInsights, normalizeQuizAnswers } from "@/lib/quiz/summary";
import type { ProductCatalogDto, ProductSlotDto, SyncedProfileDto } from "@/lib/report/types";

const DEFAULT_PROTOCOL_SHEET_ID = "131WoOqnwGoQitp3vDoDTN8ppf9C3ieSqEsoYvEBebHM";
const DEFAULT_CACHE_MS = 10 * 60 * 1000;

export type ProtocolTwinProducts = {
  bench_twin: string[];
  international_twin: string[];
  premium_twin: string[];
  herbal_twin: string[];
};

export type ProtocolProduct = {
  id: string;
  sourceRowNumber: number | null;
  slot: ProductSlotDto | null;
  slotTitle: string;
  condition: string;
  brandName: string;
  productName: string;
  qty: string | null;
  mrp: number | null;
  imageUrl: string | null;
  productType: string | null;
  productUrl: string | null;
  twins: ProtocolTwinProducts;
};

export type ProtocolRecommendationRow = {
  id: string;
  title: string;
  slot: ProductSlotDto | null;
  productCatalogId: string | null;
  brand: string | null;
  company: string | null;
  productName: string | null;
  protocolCondition: string | null;
  sourceProductId: number | null;
  twinProducts: ProtocolTwinProducts | null;
  protocolNote: string | null;
};

export type ProtocolRecommendation = {
  rule: ProtocolRule | null;
  rows: ProtocolRecommendationRow[];
  toners: string[];
  oralSupplements: string[];
  lifestyleChanges: string[];
  expectedTimeline: string | null;
  issues: string[];
  resolvedSkinType: string;
  resolvedConcern: string;
};

type ProtocolRule = {
  skinType: string;
  concern: string;
  slots: Array<{
    slot: ProductSlotDto | null;
    title: string;
    conditions: string[];
  }>;
  toners: string[];
  oralSupplements: string[];
  lifestyleChanges: string[];
  expectedTimeline: string | null;
};

type ProtocolWorkbook = {
  rules: ProtocolRule[];
  products: ProtocolProduct[];
  productsByCondition: Map<string, ProtocolProduct[]>;
  productsById: Map<string, ProtocolProduct>;
  productsByName: Map<string, ProtocolProduct>;
};

let workbookCache: { expiresAt: number; value: ProtocolWorkbook } | null = null;

function protocolSheetUrl() {
  const explicitUrl = process.env.PROTOCOL_GOOGLE_SHEET_XLSX_URL?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  const sheetId = process.env.PROTOCOL_GOOGLE_SHEET_ID?.trim() || DEFAULT_PROTOCOL_SHEET_ID;
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
}

function cacheMs() {
  const parsed = Number.parseInt(process.env.PROTOCOL_SHEET_CACHE_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CACHE_MS;
}

function normalizeLookup(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readCell(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function splitProtocolItems(value: string) {
  return value
    .split(/\s+\+\s+|\n+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitSemicolonItems(value: string) {
  return value
    .split(/[;\n]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitTwinItems(value: string) {
  return value
    .split(/\s+\+\s+|\n+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value.replace(/[^\d.]+/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function makeProtocolProductId(productName: string, rowNumber: number | null) {
  const key = normalizeLookup(productName).replace(/\s+/g, "-") || "unknown-product";
  return `protocol:${rowNumber ?? "x"}:${key}`;
}

function inferBrandFromProductName(productName: string) {
  const cleaned = productName.trim();
  const knownBrands = [
    "Acnemoist",
    "Adaferin",
    "Aziderm",
    "Beauty of Joseon",
    "Bioderma",
    "Cetaphil",
    "CeraVe",
    "Clinique",
    "COSRX",
    "Deconstruct",
    "Dermatica",
    "Kiehl",
    "La Shield",
    "Minimalist",
    "Physiogel",
    "Re'equil",
    "Re’equil",
    "Sesderma",
    "Suganda",
    "The Derma Co",
    "The Ordinary",
    "UV Doux",
    "Venusia"
  ];
  const match = knownBrands.find((brand) => cleaned.toLowerCase().startsWith(brand.toLowerCase()));

  if (match) {
    return match.replace("Re’equil", "Re'equil");
  }

  return cleaned.split(/\s+/g).slice(0, 2).join(" ");
}

function slotFromProductListColumn(column: number): { slot: ProductSlotDto | null; title: string; productType: string } {
  switch (column) {
    case 0:
      return { slot: "cleanser", title: "Cleanser / Facewash", productType: "Cleanser / Facewash" };
    case 2:
      return { slot: "sunscreen", title: "Sunscreen", productType: "Sunscreen" };
    case 4:
      return { slot: "moisturizer", title: "Moisturizer", productType: "Moisturizer" };
    case 6:
      return { slot: "am_serum", title: "AM Serum", productType: "AM Serum" };
    case 8:
      return { slot: "pm_repair", title: "PM Serum / Cream / Repair", productType: "PM Serum / Cream / Repair" };
    case 10:
      return { slot: null, title: "Oral Supplement", productType: "Oral Supplement" };
    case 12:
      return { slot: null, title: "Toner / Mask", productType: "Toner / Mask" };
    default:
      return { slot: null, title: "Protocol Product", productType: "Protocol Product" };
  }
}

function productDetailsFromSingleList(rows: unknown[][]) {
  const details = new Map<string, {
    sourceRowNumber: number | null;
    brandName: string;
    productName: string;
    qty: string | null;
    productUrl: string | null;
  }>();

  for (const row of rows.slice(2)) {
    for (const offset of [0, 6]) {
      const sourceRowNumber = Number.parseInt(readCell(row[offset]), 10);
      const brandName = readCell(row[offset + 1]);
      const productName = readCell(row[offset + 2]);
      const qty = readCell(row[offset + 3]) || null;
      const productUrl = readCell(row[offset + 4]) || null;

      if (!productName) {
        continue;
      }

      details.set(normalizeLookup(productName), {
        sourceRowNumber: Number.isFinite(sourceRowNumber) ? sourceRowNumber : null,
        brandName: brandName || inferBrandFromProductName(productName),
        productName,
        qty,
        productUrl
      });
    }
  }

  return details;
}

function parseTwins(rows: unknown[][]) {
  const twins = new Map<string, ProtocolTwinProducts>();

  for (const row of rows.slice(1)) {
    const prescribedProduct = readCell(row[1]);

    if (!prescribedProduct) {
      continue;
    }

    twins.set(normalizeLookup(prescribedProduct), {
      bench_twin: splitTwinItems(readCell(row[2])),
      international_twin: splitTwinItems(readCell(row[3])),
      premium_twin: splitTwinItems(readCell(row[4])),
      herbal_twin: splitTwinItems(readCell(row[5]))
    });
  }

  return twins;
}

function emptyTwins(): ProtocolTwinProducts {
  return {
    bench_twin: [],
    international_twin: [],
    premium_twin: [],
    herbal_twin: []
  };
}

function parseProtocolProducts(workbook: XLSX.WorkBook) {
  const productRows = XLSX.utils.sheet_to_json<unknown[]>(
    workbook.Sheets["Dr Monika_Product list"],
    { header: 1, defval: "" }
  );
  const singleListRows = XLSX.utils.sheet_to_json<unknown[]>(
    workbook.Sheets["Single list of products"],
    { header: 1, defval: "" }
  );
  const twinRows = XLSX.utils.sheet_to_json<unknown[]>(
    workbook.Sheets["Product list with twin products"],
    { header: 1, defval: "" }
  );
  const details = productDetailsFromSingleList(singleListRows);
  const twins = parseTwins(twinRows);
  const products: ProtocolProduct[] = [];

  for (const row of productRows.slice(3)) {
    for (const column of [0, 2, 4, 6, 8, 10, 12]) {
      const condition = readCell(row[column]);
      const productCell = readCell(row[column + 1]);

      if (!condition || !productCell) {
        continue;
      }

      const slotInfo = slotFromProductListColumn(column);
      for (const productName of splitProtocolItems(productCell)) {
        const detail = details.get(normalizeLookup(productName));
        const sourceRowNumber = detail?.sourceRowNumber ?? null;
        const id = makeProtocolProductId(productName, sourceRowNumber);
        products.push({
          id,
          sourceRowNumber,
          slot: slotInfo.slot,
          slotTitle: slotInfo.title,
          condition,
          brandName: detail?.brandName ?? inferBrandFromProductName(productName),
          productName: detail?.productName ?? productName,
          qty: detail?.qty ?? null,
          mrp: null,
          imageUrl: null,
          productType: slotInfo.productType,
          productUrl: detail?.productUrl ?? null,
          twins: twins.get(normalizeLookup(productName)) ?? emptyTwins()
        });
      }
    }
  }

  return products;
}

function parseRules(workbook: XLSX.WorkBook): ProtocolRule[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(
    workbook.Sheets["Dr Monika_Skin protocol"],
    { header: 1, defval: "" }
  );

  return rows.slice(2).flatMap((row): ProtocolRule[] => {
    const skinType = readCell(row[1]);
    const concern = readCell(row[2]);

    if (!skinType || !concern) {
      return [];
    }

    return [{
      skinType,
      concern,
      slots: [
        { slot: "cleanser", title: "Cleanser / Facewash", conditions: splitProtocolItems(readCell(row[3])) },
        { slot: "sunscreen", title: "Sunscreen", conditions: splitProtocolItems(readCell(row[4])) },
        { slot: "moisturizer", title: "Moisturizer", conditions: splitProtocolItems(readCell(row[5])) },
        { slot: "am_serum", title: "AM Serum", conditions: splitProtocolItems(readCell(row[6])) },
        { slot: "pm_repair", title: "PM Serum / Cream / Repair", conditions: splitProtocolItems(readCell(row[7])) }
      ],
      toners: splitProtocolItems(readCell(row[8])),
      oralSupplements: splitProtocolItems(readCell(row[9])),
      lifestyleChanges: splitSemicolonItems(readCell(row[10])),
      expectedTimeline: readCell(row[11]) || null
    }];
  });
}

async function fetchWorkbookBuffer() {
  const response = await fetch(protocolSheetUrl(), {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Protocol Google Sheet download failed: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function buildWorkbook(buffer: Buffer): ProtocolWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const rules = parseRules(workbook);
  const products = parseProtocolProducts(workbook);
  const productsByCondition = new Map<string, ProtocolProduct[]>();
  const productsById = new Map<string, ProtocolProduct>();
  const productsByName = new Map<string, ProtocolProduct>();

  for (const product of products) {
    const conditionKey = normalizeLookup(product.condition);
    const existing = productsByCondition.get(conditionKey) ?? [];
    existing.push(product);
    productsByCondition.set(conditionKey, existing);
    productsById.set(product.id, product);
    productsByName.set(normalizeLookup(product.productName), product);
  }

  return {
    rules,
    products,
    productsByCondition,
    productsById,
    productsByName
  };
}

export async function loadProtocolWorkbook() {
  const now = Date.now();

  if (workbookCache && workbookCache.expiresAt > now) {
    return workbookCache.value;
  }

  const workbook = buildWorkbook(await fetchWorkbookBuffer());
  workbookCache = {
    expiresAt: now + cacheMs(),
    value: workbook
  };
  return workbook;
}

function concernTokens(value: string) {
  return normalizeLookup(value)
    .split(/\s+/g)
    .filter((token) => token.length > 2 && !["and", "skin"].includes(token));
}

function scoreRule(rule: ProtocolRule, skinType: string, concern: string, concernPool: string[]) {
  const ruleSkinType = normalizeLookup(rule.skinType);
  const targetSkinType = normalizeLookup(skinType);
  const ruleConcern = normalizeLookup(rule.concern);
  const targetConcern = normalizeLookup(concern);
  let score = 0;

  if (ruleSkinType === targetSkinType) {
    score += 100;
  } else if (ruleSkinType.includes(targetSkinType) || targetSkinType.includes(ruleSkinType)) {
    score += 72;
  } else if (targetSkinType && ruleSkinType.split(" ").some((token) => targetSkinType.includes(token))) {
    score += 45;
  }

  if (ruleConcern === targetConcern) {
    score += 100;
  } else if (targetConcern && (ruleConcern.includes(targetConcern) || targetConcern.includes(ruleConcern))) {
    score += 76;
  }

  const ruleConcernTokens = concernTokens(rule.concern);
  const targetConcernTokens = new Set([...concernTokens(concern), ...concernPool.flatMap(concernTokens)]);
  const overlap = ruleConcernTokens.filter((token) => targetConcernTokens.has(token)).length;
  score += overlap * 12;

  return score;
}

function getProfileQuizObject(profile?: SyncedProfileDto | null) {
  if (!profile) {
    return null;
  }

  return profile.quizJson ?? profile.quizSummaryJson ?? profile.profileJson ?? null;
}

function readStringFromObject(object: unknown, keys: string[]) {
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    return null;
  }

  const record = object as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function resolveProtocolInputs(args: {
  profile?: SyncedProfileDto | null;
  quizJson?: unknown;
  analysisSkinType?: string | null;
  primaryConcerns?: string[];
  secondaryConcerns?: string[];
}) {
  const quizJson = args.quizJson ?? getProfileQuizObject(args.profile);
  const quizInsights = deriveQuizInsights(quizJson);
  const explicitSkinType =
    readStringFromObject(args.profile?.profileJson, ["skin_type", "skinType"]) ??
    readStringFromObject(args.profile?.quizJson, ["skin_type", "skinType"]) ??
    args.analysisSkinType ??
    quizInsights.skinTypeHints[0] ??
    "Normal";
  const concernPool = [
    ...(args.primaryConcerns ?? []),
    ...quizInsights.concernCandidates,
    ...(args.secondaryConcerns ?? []),
    ...quizInsights.secondaryConcernCandidates,
    ...normalizeQuizAnswers(quizJson).flatMap((entry) => entry.answers)
  ].filter(Boolean);
  const explicitConcern =
    readStringFromObject(args.profile?.profileJson, ["concern", "skin_concern", "skinConcern"]) ??
    readStringFromObject(args.profile?.quizJson, ["concern", "skin_concern", "skinConcern"]) ??
    args.primaryConcerns?.[0] ??
    quizInsights.concernCandidates[0] ??
    "Oily";

  return {
    skinType: explicitSkinType,
    concern: explicitConcern,
    concernPool
  };
}

function rowFromProduct(args: {
  product: ProtocolProduct;
  title: string;
  slot: ProductSlotDto | null;
  condition: string;
  index: number;
}): ProtocolRecommendationRow {
  return {
    id: `${args.slot ?? "protocol"}-${args.index}-${normalizeLookup(args.product.productName).replace(/\s+/g, "-")}`,
    title: args.title,
    slot: args.slot,
    productCatalogId: args.product.id,
    brand: args.product.brandName,
    company: args.product.brandName,
    productName: args.product.productName,
    protocolCondition: args.condition,
    sourceProductId: args.product.sourceRowNumber,
    twinProducts: args.product.twins,
    protocolNote: null
  };
}

function missingRow(args: {
  title: string;
  slot: ProductSlotDto | null;
  condition: string;
  index: number;
}): ProtocolRecommendationRow {
  return {
    id: `${args.slot ?? "protocol"}-${args.index}-review-needed`,
    title: `${args.title} - review needed`,
    slot: args.slot,
    productCatalogId: null,
    brand: null,
    company: null,
    productName: null,
    protocolCondition: args.condition,
    sourceProductId: null,
    twinProducts: null,
    protocolNote: `No exact product was mapped for "${args.condition}". Doctor should select manually.`
  };
}

export async function recommendProtocolProducts(args: {
  profile?: SyncedProfileDto | null;
  quizJson?: unknown;
  analysisSkinType?: string | null;
  primaryConcerns?: string[];
  secondaryConcerns?: string[];
}) : Promise<ProtocolRecommendation> {
  const workbook = await loadProtocolWorkbook();
  const resolved = resolveProtocolInputs(args);
  const scoredRules = workbook.rules
    .map((rule) => ({
      rule,
      score: scoreRule(rule, resolved.skinType, resolved.concern, resolved.concernPool)
    }))
    .sort((left, right) => right.score - left.score);
  const selected = scoredRules[0]?.score > 0 ? scoredRules[0].rule : null;
  const issues: string[] = [];

  if (!selected) {
    issues.push(`No skin protocol rule matched "${resolved.skinType}" with "${resolved.concern}".`);
    return {
      rule: null,
      rows: [],
      toners: [],
      oralSupplements: [],
      lifestyleChanges: [],
      expectedTimeline: null,
      issues,
      resolvedSkinType: resolved.skinType,
      resolvedConcern: resolved.concern
    };
  }

  if (normalizeLookup(selected.skinType) !== normalizeLookup(resolved.skinType) || normalizeLookup(selected.concern) !== normalizeLookup(resolved.concern)) {
    issues.push(`Closest protocol used: ${selected.skinType} / ${selected.concern}. Doctor can regenerate after editing skin type or primary concern.`);
  }

  let rowIndex = 0;
  const rows = selected.slots.flatMap((slotConfig) => {
    return slotConfig.conditions.flatMap((condition) => {
      const products = workbook.productsByCondition.get(normalizeLookup(condition)) ?? [];

      if (products.length === 0) {
        rowIndex += 1;
        issues.push(`No exact product found for protocol condition "${condition}".`);
        return [missingRow({ title: slotConfig.title, slot: slotConfig.slot, condition, index: rowIndex })];
      }

      return products.map((product) => {
        rowIndex += 1;
        return rowFromProduct({
          product,
          title: slotConfig.title,
          slot: slotConfig.slot,
          condition,
          index: rowIndex
        });
      });
    });
  });

  return {
    rule: selected,
    rows,
    toners: selected.toners,
    oralSupplements: selected.oralSupplements,
    lifestyleChanges: selected.lifestyleChanges,
    expectedTimeline: selected.expectedTimeline,
    issues,
    resolvedSkinType: selected.skinType,
    resolvedConcern: selected.concern
  };
}

export async function listProtocolProductCatalog(): Promise<ProductCatalogDto[]> {
  try {
    const workbook = await loadProtocolWorkbook();
    return workbook.products.map((product) => ({
      id: product.id,
      sourceRowNumber: product.sourceRowNumber,
      brandName: product.brandName,
      productName: product.productName,
      qty: product.qty,
      mrp: product.mrp,
      imageUrl: product.imageUrl,
      category: "Dr Monika protocol",
      productType: product.productType,
      claimedSkinTypes: [],
      claimedSkinConcerns: [product.condition],
      heroIngredients: [product.condition],
      otherKeyIngredients: [],
      potentialIrritants: [],
      textureFinish: null,
      overallSuitabilityScore: null,
      productUrl: product.productUrl,
      protocolCondition: product.condition,
      twinProducts: product.twins
    }));
  } catch {
    return [];
  }
}

export async function resolveProtocolProductFromRow(args: {
  productCatalogId?: string | null;
  brand?: string | null;
  productName?: string | null;
}) {
  try {
    const workbook = await loadProtocolWorkbook();

    if (args.productCatalogId) {
      const direct = workbook.productsById.get(args.productCatalogId);
      if (direct) {
        return direct;
      }
    }

    if (args.productName) {
      const byName = workbook.productsByName.get(normalizeLookup(args.productName));
      if (byName) {
        return byName;
      }
    }

    const normalizedBrand = normalizeLookup(args.brand);
    const normalizedProductName = normalizeLookup(args.productName);

    if (!normalizedProductName) {
      return null;
    }

    return workbook.products.find((product) => {
      return normalizeLookup(product.productName) === normalizedProductName &&
        (!normalizedBrand || normalizeLookup(product.brandName) === normalizedBrand);
    }) ?? null;
  } catch {
    return null;
  }
}

export function buildProtocolDoctorNotes(recommendation: ProtocolRecommendation) {
  const lines = [
    recommendation.toners.length ? `Toners (generic): ${recommendation.toners.join(", ")}` : null,
    recommendation.oralSupplements.length ? `Oral supplements (generic): ${recommendation.oralSupplements.join(", ")}` : null,
    recommendation.expectedTimeline ? `Expected timeline: ${recommendation.expectedTimeline}` : null,
    recommendation.issues.length ? `Protocol review notes: ${recommendation.issues.join(" ")}` : null
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}
