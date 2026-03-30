import * as XLSX from "xlsx";

import { prisma } from "../lib/db/prisma";

function asString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function asInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  return null;
}

function splitCell(value: unknown) {
  const text = asString(value);

  if (text === null) {
    return [];
  }

  return text
    .split(/[\n,;/]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function buildRowObjects(sheet: XLSX.WorkSheet) {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });

  if (rows.length < 3) {
    return [] as Array<Record<string, unknown>>;
  }

  const primaryHeaderRow = Array.isArray(rows[0]) ? rows[0] : [];
  const secondaryHeaderRow = Array.isArray(rows[1]) ? rows[1] : [];
  const width = Math.max(primaryHeaderRow.length, secondaryHeaderRow.length);
  const headers = Array.from({ length: width }, (_, index) => {
    const secondaryHeader = normalizeHeader(secondaryHeaderRow[index]);
    if (secondaryHeader.length > 0) {
      return secondaryHeader;
    }

    return normalizeHeader(primaryHeaderRow[index]);
  });

  return rows.slice(2).map((row) => {
    const cells = Array.isArray(row) ? row : [];
    const record: Record<string, unknown> = {};

    headers.forEach((header, index) => {
      if (header.length > 0) {
        record[header] = cells[index] ?? "";
      }
    });

    return record;
  });
}

async function main() {
  const workbookPath = process.argv[2] || process.env.PRODUCT_CATALOG_WORKBOOK_PATH;

  if (!workbookPath) {
    throw new Error("Pass the workbook path as an argument or set PRODUCT_CATALOG_WORKBOOK_PATH.");
  }

  const workbook = XLSX.readFile(workbookPath);
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  const rows = buildRowObjects(firstSheet);

  await prisma.productCatalog.deleteMany();

  let importedCount = 0;

  for (const [index, row] of rows.entries()) {
    const brandName = asString(row["Brand Name"]);
    const productName = asString(row["Product Name"]);
    const sourceRowNumber =
      asInt(row["S No."]) ??
      asInt(row["S.No."]) ??
      asInt(row["Serial No."]) ??
      asInt(row["Sr No."]) ??
      asInt(row["Sr. No."]) ??
      index + 3;

    if (brandName === null || productName === null) {
      continue;
    }

    const heroIngredientOne = asString(row["Hero Ingredient 1"]);
    const heroIngredientTwo = asString(row["Hero Ingredient 2"]);
    const heroIngredients = [heroIngredientOne, heroIngredientTwo].filter(
      (value): value is string => value !== null
    );

    await prisma.productCatalog.create({
      data: {
        sourceRowNumber,
        brandName,
        productName,
        qty: asString(row["Qty"]),
        mrp: asString(row["MRP"]),
        category: asString(row["Category"]),
        productType: asString(row["Product Type"]),
        claimedSkinTypes: splitCell(row["Claimed Skin Type"]),
        claimedSkinConcerns: splitCell(row["Claimed Skin Concerns"]),
        heroIngredients,
        heroIngredientStrengths: [
          {
            ingredient: heroIngredientOne,
            strength: asString(row["Hero Ingredient 1 %"])
          },
          {
            ingredient: heroIngredientTwo,
            strength: asString(row["Hero Ingredient 2 %"])
          }
        ].filter((item) => item.ingredient !== null),
        otherKeyIngredients: splitCell(row["Other Key Ingredients"]),
        potentialIrritants: splitCell(row["Potential Irritants"]),
        textureFinish: asString(row["Texture / Finish"]),
        claimedResults: asString(row["Claimed Results"]),
        dermatTestedClaim: asString(row["Dermat Tested Claim"]),
        suitableForSensitiveSkin: asString(row["Suitable for Sensitive Skin"]),
        ingredientSkinTypeAlignment: asString(row["Ingredient-Skin Type Alignment"]),
        redFlags: splitCell(row["Red Flags"]),
        overallSuitabilityScore: asInt(row["Overall Suitability Score (1-5)"]),
        researchNotes: asString(row["Research Notes / Observations"]),
        productUrl: asString(row["Link"])
      }
    });

    importedCount += 1;
  }

  console.log("Imported " + String(importedCount) + " products into ProductCatalog.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
