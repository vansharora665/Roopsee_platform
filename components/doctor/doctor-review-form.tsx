"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_USAGE_AMOUNTS, DO_THIS_OPTIONS, NOT_THAT_OPTIONS } from "@/lib/report/default-guidance";
import { getSkinScoreLabel, normalizeSkinScore } from "@/lib/report/score";
import type { DoctorProductRowDto, ProductCatalogDto, ProductMatchDto, ProductSlotDto, ReportDetailDto } from "@/lib/report/types";

type RoutineItem = {
  step: string;
  usageAmount: string;
};

type ProductRowFormItem = {
  id: string;
  title: string;
  slot: ProductSlotDto | null;
  productCatalogId: string | null;
  brand: string;
  company: string;
  productName: string;
};

type DoctorReviewFormValues = {
  cleanserBrand: string;
  cleanserCompany: string;
  cleanserProductName: string;
  sunscreenBrand: string;
  sunscreenCompany: string;
  sunscreenProductName: string;
  moisturizerBrand: string;
  moisturizerCompany: string;
  moisturizerProductName: string;
  repairSerumBrand: string;
  repairSerumCompany: string;
  repairSerumProductName: string;
  productRows: ProductRowFormItem[];
  analysisSkinScore: string;
  analysisSkinType: string;
  analysisCondition: string;
  analysisOverallSeverity: "None" | "Mild" | "Moderate" | "Severe";
  analysisPrimaryConcernsText: string;
  analysisSecondaryConcernsText: string;
  analysisPositiveFindingsText: string;
  analysisOilLevels: "Low" | "Medium" | "High";
  analysisHydration: "Low" | "Good";
  analysisTexture: "Smooth" | "Uneven";
  analysisTone: "Even" | "Uneven";
  morningRoutine: RoutineItem[];
  nightRoutine: RoutineItem[];
  doThisSelections: string[];
  notThatSelections: string[];
  doctorNotes: string;
};

const overallSeverityOptions = ["None", "Mild", "Moderate", "Severe"] as const;
const oilLevelOptions = ["Low", "Medium", "High"] as const;
const hydrationOptions = ["Low", "Good"] as const;
const textureOptions = ["Smooth", "Uneven"] as const;
const toneOptions = ["Even", "Uneven"] as const;
const productSlotOptions: Array<{ value: ProductSlotDto | null; label: string }> = [
  { value: "cleanser", label: "Cleanser / Facewash" },
  { value: "sunscreen", label: "Sunscreen" },
  { value: "moisturizer", label: "Moisturizer" },
  { value: "repair_serum", label: "Repair / Serum" },
  { value: null, label: "Custom / no heading" }
];

const canonicalProductFields = [
  { slot: "cleanser", title: "Cleanser / Facewash" },
  { slot: "sunscreen", title: "Sunscreen" },
  { slot: "moisturizer", title: "Moisturizer" },
  { slot: "repair_serum", title: "Repair / Serum" }
] as const satisfies ReadonlyArray<{ slot: ProductSlotDto; title: string }>;

function createRowId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `product-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyProductRow(slot: ProductSlotDto | null = null, title = ""): ProductRowFormItem {
  return {
    id: createRowId(),
    title,
    slot,
    productCatalogId: null,
    brand: "",
    company: "",
    productName: ""
  };
}

function toProductRowFormItems(report: ReportDetailDto): ProductRowFormItem[] {
  const sourceRows = report.doctorReview.productRows.length > 0
    ? report.doctorReview.productRows
    : canonicalProductFields.map((field) => ({
        id: createRowId(),
        title: field.title,
        slot: field.slot,
        productCatalogId: null,
        brand: "",
        company: "",
        productName: ""
      } satisfies DoctorProductRowDto));

  return sourceRows.map((row) => ({
    id: row.id || createRowId(),
    title: row.title ?? "",
    slot: row.slot ?? null,
    productCatalogId: row.productCatalogId ?? null,
    brand: row.brand ?? "",
    company: row.company ?? row.brand ?? "",
    productName: row.productName ?? ""
  }));
}

function defaultTitleForSlot(slot: ProductSlotDto | null) {
  if (!slot) {
    return "";
  }

  return canonicalProductFields.find((field) => field.slot === slot)?.title ?? "";
}

function multilineToArray(value: string) {
  return value
    .split(/\n+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToMultiline(values: string[]) {
  return values.join("\n");
}

function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function slotTitle(slot: ProductSlotDto) {
  return canonicalProductFields.find((field) => field.slot === slot)?.title ?? "Recommended Product";
}

function renderRowProductLabel(row: Pick<ProductRowFormItem, "brand" | "company" | "productName">) {
  return [row.brand, row.company, row.productName].filter(Boolean).join(" - ");
}

function catalogText(product: ProductCatalogDto) {
  return [
    product.brandName,
    product.productName,
    product.productType,
    product.category,
    product.claimedSkinConcerns.join(", "),
    product.claimedSkinTypes.join(", "),
    product.heroIngredients.join(", ")
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isRelevantToSlot(product: ProductCatalogDto, slot: ProductSlotDto | null) {
  if (!slot) {
    return true;
  }

  const pool = [product.productName, product.productType, product.category, product.brandName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (slot === "cleanser") {
    return /cleanser|face wash|facewash/.test(pool);
  }

  if (slot === "sunscreen") {
    return /sunscreen|spf|sun/.test(pool);
  }

  if (slot === "moisturizer") {
    return /moisturizer|cream|lotion|gel/.test(pool) && !/sunscreen|spf|cleanser|face wash|serum/.test(pool);
  }

  return /serum|treatment|repair|cream/.test(pool) && !/sunscreen|spf|cleanser|face wash/.test(pool);
}

function productSearchScore(product: ProductCatalogDto, query: string, slot: ProductSlotDto | null) {
  const normalizedQuery = query.trim().toLowerCase();
  const haystack = catalogText(product);
  let score = 0;

  if (isRelevantToSlot(product, slot)) {
    score += 22;
  }

  if (!normalizedQuery) {
    score += product.overallSuitabilityScore ?? 0;
    return score;
  }

  if (product.productName.toLowerCase().startsWith(normalizedQuery)) {
    score += 40;
  }

  if (product.brandName.toLowerCase().startsWith(normalizedQuery)) {
    score += 22;
  }

  if (haystack.includes(normalizedQuery)) {
    score += 28;
  }

  const tokens = normalizedQuery.split(/\s+/g).filter(Boolean);
  score += tokens.filter((token) => haystack.includes(token)).length * 8;
  score += product.overallSuitabilityScore ?? 0;

  return score;
}

function findCatalogProduct(catalog: ProductCatalogDto[], row: ProductRowFormItem) {
  if (row.productCatalogId) {
    return catalog.find((product) => product.id === row.productCatalogId) ?? null;
  }

  return catalog.find(
    (product) =>
      product.brandName === row.brand &&
      product.productName === row.productName
  ) ?? null;
}

function matchesSuggestion(suggestion: ProductMatchDto, row: ProductRowFormItem) {
  return suggestion.product.id === row.productCatalogId || (
    suggestion.product.brandName === row.brand &&
    suggestion.product.productName === row.productName
  );
}

function FieldArrayHeader({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{label}</h3>
      <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={onAdd}>
        Add row
      </Button>
    </div>
  );
}

function SelectionDropdown({
  title,
  description,
  options,
  selectedValues,
  onToggle
}: {
  title: string;
  description: string;
  options: readonly string[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => setIsOpen((open) => !open)}>
          <span>{isOpen ? "Hide options" : "Select items"}</span>
          <span>{selectedValues.length} selected</span>
        </Button>
        {isOpen ? (
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3">
            {options.map((option) => {
              const checked = selectedValues.includes(option);

              return (
                <label key={option} className="flex cursor-pointer items-start gap-3 rounded-2xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                    checked={checked}
                    onChange={() => onToggle(option)}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {selectedValues.length > 0 ? selectedValues.map((value) => (
          <span key={value} className="rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-semibold text-brand-navy">
            {value}
          </span>
        )) : <p className="text-sm text-slate-500">No items selected yet.</p>}
      </div>
    </div>
  );
}

function ProductPicker({
  row,
  catalog,
  onSelect,
  onClear
}: {
  row: ProductRowFormItem;
  catalog: ProductCatalogDto[];
  onSelect: (product: ProductCatalogDto) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState(renderRowProductLabel(row));
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const nextQuery = [row.brand, row.company, row.productName].filter(Boolean).join(" - ");
    setQuery(nextQuery);
  }, [row.brand, row.company, row.productName, row.productCatalogId]);

  const filteredCatalog = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const tokenizedQuery = normalizedQuery.split(/\s+/g).filter(Boolean);

    return catalog
      .map((product) => ({
        product,
        score: productSearchScore(product, query, row.slot)
      }))
      .filter((item) => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = catalogText(item.product);
        return (
          item.product.brandName.toLowerCase().includes(normalizedQuery) ||
          item.product.productName.toLowerCase().includes(normalizedQuery) ||
          tokenizedQuery.every((token) => haystack.includes(token))
        );
      })
      .sort((left, right) => right.score - left.score)
      .map((item) => item.product);
  }, [catalog, query, row.slot]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && filteredCatalog.length > 0) {
              event.preventDefault();
              onSelect(filteredCatalog[0]);
              setQuery(`${filteredCatalog[0].brandName} - ${filteredCatalog[0].productName}`);
              setIsOpen(false);
            }
          }}
          placeholder="Start typing to search products"
        />
        <Button type="button" variant="secondary" onClick={() => setIsOpen((open) => !open)}>
          {isOpen ? "Hide" : "Browse"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setQuery("");
            onClear();
          }}
        >
          Clear
        </Button>
      </div>
      {isOpen ? (
        <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <p className="px-3 pb-2 text-xs font-medium text-slate-500">
            {filteredCatalog.length} matching products
          </p>
          {filteredCatalog.length > 0 ? filteredCatalog.map((product) => (
            <button
              key={product.id}
              type="button"
              className="flex w-full flex-col rounded-xl px-3 py-2 text-left hover:bg-slate-50"
              onClick={() => {
                onSelect(product);
                setQuery(`${product.brandName} - ${product.productName}`);
                setIsOpen(false);
              }}
            >
              <span className="text-sm font-semibold text-slate-900">
                {product.brandName} - {product.productName}
              </span>
              <span className="text-xs text-slate-500">
                {[product.productType, product.claimedSkinConcerns.join(", "), product.qty].filter(Boolean).join(" • ")}
              </span>
            </button>
          )) : (
            <p className="px-3 py-2 text-sm text-slate-500">No matching products found.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function DoctorReviewForm({ report, productCatalog }: { report: ReportDetailDto; productCatalog: ProductCatalogDto[] }) {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [isEditingProducts, setIsEditingProducts] = useState(false);

  const form = useForm<DoctorReviewFormValues>({
    defaultValues: {
      cleanserBrand: report.doctorReview.cleanserBrand ?? "",
      cleanserCompany: report.doctorReview.cleanserCompany ?? "",
      cleanserProductName: report.doctorReview.cleanserProductName ?? "",
      sunscreenBrand: report.doctorReview.sunscreenBrand ?? "",
      sunscreenCompany: report.doctorReview.sunscreenCompany ?? "",
      sunscreenProductName: report.doctorReview.sunscreenProductName ?? "",
      moisturizerBrand: report.doctorReview.moisturizerBrand ?? "",
      moisturizerCompany: report.doctorReview.moisturizerCompany ?? "",
      moisturizerProductName: report.doctorReview.moisturizerProductName ?? "",
      repairSerumBrand: report.doctorReview.repairSerumBrand ?? "",
      repairSerumCompany: report.doctorReview.repairSerumCompany ?? "",
      repairSerumProductName: report.doctorReview.repairSerumProductName ?? "",
      productRows: toProductRowFormItems(report),
      analysisSkinScore: String(report.analysisOutput.skinScore),
      analysisSkinType: report.analysisOutput.skinType,
      analysisCondition: report.analysisOutput.condition,
      analysisOverallSeverity: report.analysisOutput.overallSeverity as DoctorReviewFormValues["analysisOverallSeverity"],
      analysisPrimaryConcernsText: arrayToMultiline(report.analysisOutput.primaryConcerns),
      analysisSecondaryConcernsText: arrayToMultiline(report.analysisOutput.secondaryConcerns),
      analysisPositiveFindingsText: arrayToMultiline(report.analysisOutput.positiveFindings),
      analysisOilLevels: report.analysisOutput.oilLevels as DoctorReviewFormValues["analysisOilLevels"],
      analysisHydration: report.analysisOutput.hydration as DoctorReviewFormValues["analysisHydration"],
      analysisTexture: report.analysisOutput.texture as DoctorReviewFormValues["analysisTexture"],
      analysisTone: report.analysisOutput.tone as DoctorReviewFormValues["analysisTone"],
      morningRoutine: report.doctorReview.morningRoutine.length
        ? report.doctorReview.morningRoutine
        : [{ step: "", usageAmount: "" }],
      nightRoutine: report.doctorReview.nightRoutine.length
        ? report.doctorReview.nightRoutine
        : [{ step: "", usageAmount: "" }],
      doThisSelections: report.doctorReview.doThis,
      notThatSelections: report.doctorReview.notThat,
      doctorNotes: report.doctorReview.doctorNotes ?? ""
    }
  });

  const morningRoutine = useFieldArray({ control: form.control, name: "morningRoutine" });
  const nightRoutine = useFieldArray({ control: form.control, name: "nightRoutine" });
  const productRows = useFieldArray({ control: form.control, name: "productRows" });

  const doThisSelections = form.watch("doThisSelections");
  const notThatSelections = form.watch("notThatSelections");
  const liveSkinScore = form.watch("analysisSkinScore");
  const watchedProductRows = form.watch("productRows");

  const quantityGuidance = useMemo(
    () => [
      `Facewash / cleanser: ${DEFAULT_USAGE_AMOUNTS.cleanser}`,
      `Sunscreen: ${DEFAULT_USAGE_AMOUNTS.sunscreen}`,
      `Moisturizer: ${DEFAULT_USAGE_AMOUNTS.moisturizer}`,
      `Repair or active cream: ${DEFAULT_USAGE_AMOUNTS.repairCream}`,
      `Serum: ${DEFAULT_USAGE_AMOUNTS.serum}`
    ],
    []
  );

  const scorePreview = useMemo(() => {
    const parsed = Number.parseFloat(liveSkinScore);
    if (!Number.isFinite(parsed)) {
      return report.analysisOutput.skinScoreLabel;
    }

    return getSkinScoreLabel(normalizeSkinScore(parsed));
  }, [liveSkinScore, report.analysisOutput.skinScoreLabel]);

  const suggestionsBySlot = useMemo(() => {
    return canonicalProductFields.reduce<Record<string, ProductMatchDto[]>>((accumulator, field) => {
      accumulator[field.slot] = report.productMatches
        .filter((match) => match.slot === field.slot)
        .sort((left, right) => left.rank - right.rank)
        .slice(0, 3);

      return accumulator;
    }, {});
  }, [report.productMatches]);

  function toggleSelection(name: "doThisSelections" | "notThatSelections", value: string) {
    const currentValues = form.getValues(name);
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((item) => item !== value)
      : [...currentValues, value];

    form.setValue(name, nextValues, { shouldDirty: true });
  }

  function updateRowFromProduct(index: number, product: ProductCatalogDto) {
    const currentRow = form.getValues(`productRows.${index}` as const);
    const nextSlot = currentRow.slot;
    const title = normalizeText(currentRow.title) ?? defaultTitleForSlot(nextSlot);

    form.setValue(`productRows.${index}.title`, title ?? "", { shouldDirty: true });
    form.setValue(`productRows.${index}.productCatalogId`, product.id, { shouldDirty: true });
    form.setValue(`productRows.${index}.brand`, product.brandName, { shouldDirty: true });
    form.setValue(`productRows.${index}.company`, product.brandName, { shouldDirty: true });
    form.setValue(`productRows.${index}.productName`, product.productName, { shouldDirty: true });
  }

  function clearProductRow(index: number) {
    form.setValue(`productRows.${index}.productCatalogId`, null, { shouldDirty: true });
    form.setValue(`productRows.${index}.brand`, "", { shouldDirty: true });
    form.setValue(`productRows.${index}.company`, "", { shouldDirty: true });
    form.setValue(`productRows.${index}.productName`, "", { shouldDirty: true });
  }

  function removeRowsForSlot(slot: ProductSlotDto) {
    const indexes = form.getValues("productRows")
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.slot === slot)
      .map(({ index }) => index)
      .sort((left, right) => right - left);

    indexes.forEach((index) => productRows.remove(index));
  }

  function restoreCanonicalRow(slot: ProductSlotDto, title: string) {
    productRows.append(createEmptyProductRow(slot, title));
  }

  function applySuggestedProduct(slot: ProductSlotDto, suggestion: ProductMatchDto) {
    const rows = form.getValues("productRows");
    let targetIndex = rows.findIndex((row) => row.slot === slot);

    if (targetIndex === -1) {
      productRows.append(createEmptyProductRow(slot, slotTitle(slot)));
      targetIndex = form.getValues("productRows").findIndex((row) => row.slot === slot);
    }

    if (targetIndex === -1) {
      return;
    }

    form.setValue(`productRows.${targetIndex}.slot`, slot, { shouldDirty: true });
    form.setValue(`productRows.${targetIndex}.title`, defaultTitleForSlot(slot), { shouldDirty: true });
    updateRowFromProduct(targetIndex, suggestion.product);
  }

  function buildPayload(values: DoctorReviewFormValues) {
    const normalizedRows = values.productRows
      .map((row) => ({
        id: row.id,
        title: row.title.trim(),
        slot: row.slot,
        productCatalogId: row.productCatalogId ?? null,
        brand: normalizeText(row.brand),
        company: normalizeText(row.company) ?? normalizeText(row.brand),
        productName: normalizeText(row.productName)
      }))
      .filter((row) => row.title || row.slot || row.productCatalogId || row.brand || row.company || row.productName);

    const firstRowForSlot = (slot: ProductSlotDto) => normalizedRows.find((row) => row.slot === slot) ?? null;

    return {
      cleanserBrand: firstRowForSlot("cleanser")?.brand ?? null,
      cleanserCompany: firstRowForSlot("cleanser")?.company ?? null,
      cleanserProductName: firstRowForSlot("cleanser")?.productName ?? null,
      sunscreenBrand: firstRowForSlot("sunscreen")?.brand ?? null,
      sunscreenCompany: firstRowForSlot("sunscreen")?.company ?? null,
      sunscreenProductName: firstRowForSlot("sunscreen")?.productName ?? null,
      moisturizerBrand: firstRowForSlot("moisturizer")?.brand ?? null,
      moisturizerCompany: firstRowForSlot("moisturizer")?.company ?? null,
      moisturizerProductName: firstRowForSlot("moisturizer")?.productName ?? null,
      repairSerumBrand: firstRowForSlot("repair_serum")?.brand ?? null,
      repairSerumCompany: firstRowForSlot("repair_serum")?.company ?? null,
      repairSerumProductName: firstRowForSlot("repair_serum")?.productName ?? null,
      productRows: normalizedRows,
      morningRoutine: values.morningRoutine.filter((item) => item.step.trim() && item.usageAmount.trim()),
      nightRoutine: values.nightRoutine.filter((item) => item.step.trim() && item.usageAmount.trim()),
      doThis: Array.from(new Set(values.doThisSelections.map((item) => item.trim()).filter(Boolean))),
      notThat: Array.from(new Set(values.notThatSelections.map((item) => item.trim()).filter(Boolean))),
      expertTips: [],
      doctorNotes: values.doctorNotes.trim() || null,
      analysisOverride: {
        skinScore: Number.parseFloat(values.analysisSkinScore),
        skinType: values.analysisSkinType.trim(),
        condition: values.analysisCondition.trim(),
        overallSeverity: values.analysisOverallSeverity,
        primaryConcerns: multilineToArray(values.analysisPrimaryConcernsText),
        secondaryConcerns: multilineToArray(values.analysisSecondaryConcernsText),
        positiveFindings: multilineToArray(values.analysisPositiveFindingsText),
        oilLevels: values.analysisOilLevels,
        hydration: values.analysisHydration,
        texture: values.analysisTexture,
        tone: values.analysisTone
      }
    };
  }

  async function saveReview() {
    const values = form.getValues();
    const response = await fetch(`/api/reports/${report.id}/doctor-review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildPayload(values))
    });

    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error ?? "Could not save doctor review");
    }

    return response.json();
  }

  async function runAction(action: string, handler: () => Promise<void>) {
    setBusyAction(action);
    setError(null);
    setStatusMessage(null);

    try {
      await handler();
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "The action failed");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Card className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
            Doctor workflow
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">Editable review fields</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            The doctor can adjust generated analysis, primary concerns, product selection, routines, and guidance before approval.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/reports/${report.id}/preview`} target="_blank">
            <Button variant="secondary">Preview report</Button>
          </Link>
          {report.generatedFile?.pdfUrl ? (
            <Link href={report.generatedFile.pdfUrl} target="_blank">
              <Button variant="secondary">Download PDF</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-4 border border-slate-200 shadow-none">
          <h3 className="text-lg font-semibold text-slate-900">Patient context</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Name</p>
              <p className="font-medium text-slate-900">{report.patientInfo.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Sex / Age</p>
              <p className="font-medium text-slate-900">
                {report.patientInfo.sex} / {report.patientInfo.age}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-slate-500">Input sources</p>
              <p className="font-medium text-slate-900">
                {report.patientInfo.inputSources.join(", ")}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-slate-500">Questionnaire</p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {report.assets.questionnaireText || "No questionnaire notes added"}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-slate-500">Manual findings</p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">
                {report.assets.rawFindingsText || "No manual findings added"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 border border-slate-200 shadow-none">
          <h3 className="text-lg font-semibold text-slate-900">Workflow actions</h3>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() =>
                runAction("save", async () => {
                  await saveReview();
                  setStatusMessage("Doctor review draft saved.");
                })
              }
              disabled={busyAction !== null}
            >
              {busyAction === "save" ? "Saving..." : "Save draft"}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                runAction("review", async () => {
                  await saveReview();
                  const response = await fetch(`/api/reports/${report.id}/status`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ status: "under_doctor_review" })
                  });

                  if (!response.ok) {
                    throw new Error("Could not mark report under review");
                  }

                  setStatusMessage("Report moved to doctor review.");
                })
              }
              disabled={busyAction !== null}
            >
              {busyAction === "review" ? "Updating..." : "Mark under review"}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                runAction("approve", async () => {
                  await saveReview();
                  const response = await fetch(`/api/reports/${report.id}/approve`, {
                    method: "POST"
                  });

                  if (!response.ok) {
                    const body = (await response.json().catch(() => ({}))) as { error?: string };
                    throw new Error(body.error ?? "Could not approve report");
                  }

                  setStatusMessage("Report approved, stamped as doctor verified, and synced to Supabase.");
                })
              }
              disabled={busyAction !== null}
            >
              {busyAction === "approve" ? "Approving..." : "Approve report"}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                runAction("pdf", async () => {
                  if (!["approved", "sent_to_user"].includes(report.status)) {
                    throw new Error("Approve the report before generating the final PDF");
                  }

                  await saveReview();
                  const response = await fetch(`/api/reports/${report.id}/generate-pdf`, {
                    method: "POST"
                  });

                  if (!response.ok) {
                    const body = (await response.json()) as { error?: string };
                    throw new Error(body.error ?? "Could not generate PDF");
                  }

                  setStatusMessage("Final PDF generated.");
                })
              }
              disabled={busyAction !== null}
            >
              {busyAction === "pdf" ? "Generating..." : "Generate final PDF"}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                runAction("send", async () => {
                  const response = await fetch(`/api/reports/${report.id}/send`, {
                    method: "POST"
                  });

                  if (!response.ok) {
                    throw new Error("Could not mark report as sent");
                  }

                  setStatusMessage("Report marked as sent to user.");
                })
              }
              disabled={busyAction !== null}
            >
              {busyAction === "send" ? "Sending..." : "Mark sent to user"}
            </Button>
          </div>
          {statusMessage ? <p className="text-sm font-medium text-emerald-700">{statusMessage}</p> : null}
          {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
        </Card>
      </div>

      <form className="space-y-8" onSubmit={(event) => event.preventDefault()}>
        <Card className="space-y-5 border border-slate-200 shadow-none">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Doctor-adjustable analysis</h3>
              <p className="text-sm text-slate-600">
                These fields control the generated analysis shown in the final report.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Score label preview: <span className="font-semibold text-slate-900">{scorePreview}</span>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Skin score
              <Input type="number" step="0.1" min="0" max="10" {...form.register("analysisSkinScore")} />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Overall severity
              <select {...form.register("analysisOverallSeverity")} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900">
                {overallSeverityOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Skin type
              <Input {...form.register("analysisSkinType")} />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Condition
              <Input {...form.register("analysisCondition")} />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Oil levels
              <select {...form.register("analysisOilLevels")} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900">
                {oilLevelOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Hydration
              <select {...form.register("analysisHydration")} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900">
                {hydrationOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Texture
              <select {...form.register("analysisTexture")} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900">
                {textureOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Tone
              <select {...form.register("analysisTone")} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900">
                {toneOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700 xl:col-span-2">
              Primary concerns
              <Textarea {...form.register("analysisPrimaryConcernsText")} className="min-h-[120px]" placeholder="One concern per line" />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700 xl:col-span-2">
              Secondary concerns
              <Textarea {...form.register("analysisSecondaryConcernsText")} className="min-h-[120px]" placeholder="One concern per line" />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700 xl:col-span-2">
              Positive findings
              <Textarea {...form.register("analysisPositiveFindingsText")} className="min-h-[120px]" placeholder="One finding per line" />
            </label>
          </div>
        </Card>

        <Card className="space-y-5 border border-slate-200 shadow-none">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Recommended products</h3>
              <p className="text-sm text-slate-600">
                The matched products stay as defaults, but the doctor can edit headings, search the full product list, add rows, or remove rows.
              </p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setIsEditingProducts((value) => !value)}>
              {isEditingProducts ? "Hide editor" : "Edit products"}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {canonicalProductFields.map((field) => {
              const existingRow = watchedProductRows.find((row) => row.slot === field.slot) ?? null;
              const currentRow = existingRow ?? createEmptyProductRow(field.slot, field.title);
              const selectedSuggestion = suggestionsBySlot[field.slot].find((suggestion) => matchesSuggestion(suggestion, currentRow)) ?? null;

              return (
                <div key={field.slot} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{field.title}</h4>
                    {existingRow ? (
                      <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => removeRowsForSlot(field.slot)}>
                        Remove section
                      </Button>
                    ) : (
                      <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={() => restoreCanonicalRow(field.slot, field.title)}>
                        Restore section
                      </Button>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {existingRow ? (renderRowProductLabel(currentRow) || "No product selected yet") : "Section removed from report"}
                  </p>
                  <div className="mt-3 space-y-2">
                    {suggestionsBySlot[field.slot].length > 0 ? suggestionsBySlot[field.slot].map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        className={`flex w-full flex-col rounded-2xl border px-3 py-2 text-left ${selectedSuggestion?.id === suggestion.id ? "border-brand-blue bg-brand-blue/5" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}`}
                        onClick={() => applySuggestedProduct(field.slot, suggestion)}
                      >
                        <span className="text-sm font-semibold text-slate-900">
                          #{suggestion.rank} {suggestion.product.brandName} - {suggestion.product.productName}
                        </span>
                        <span className="text-xs text-slate-500">Match score {suggestion.matchScore.toFixed(1)}</span>
                      </button>
                    )) : <p className="text-sm text-slate-500">No catalog suggestions yet.</p>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Current report rows</p>
            <div className="mt-3 space-y-2">
              {watchedProductRows.filter((row) => row.title || row.brand || row.productName || row.productCatalogId).map((row) => {
                const selectedCatalogProduct = findCatalogProduct(productCatalog, row);

                return (
                  <div key={row.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                    <span className="font-semibold text-slate-900">{row.title || slotTitle(row.slot ?? "cleanser")}</span>
                    {": "}
                    <span>{renderRowProductLabel(row) || "No product selected"}</span>
                    {selectedCatalogProduct?.qty ? <span className="text-slate-500"> • {selectedCatalogProduct.qty}</span> : null}
                  </div>
                );
              })}
            </div>
          </div>

          {isEditingProducts ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">Editable product rows</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => productRows.append(createEmptyProductRow())}
                  >
                    Add custom row
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => canonicalProductFields.forEach((field) => {
                      if (!form.getValues("productRows").some((row) => row.slot === field.slot)) {
                        productRows.append(createEmptyProductRow(field.slot, field.title));
                      }
                    })}
                  >
                    Restore default slots
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {productRows.fields.map((field, index) => {
                  const currentRow = watchedProductRows[index] ?? createEmptyProductRow();
                  const selectedCatalogProduct = findCatalogProduct(productCatalog, currentRow);

                  return (
                    <div key={field.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="grid flex-1 gap-4 md:grid-cols-2">
                          <label className="space-y-2 text-sm font-medium text-slate-700">
                            Heading
                            <Input {...form.register(`productRows.${index}.title` as const)} placeholder="Optional heading" />
                          </label>
                          <label className="space-y-2 text-sm font-medium text-slate-700">
                            Slot
                            <select
                              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                              value={currentRow.slot ?? "custom"}
                              onChange={(event) => {
                                const rawValue = event.target.value;
                                const nextSlot = rawValue === "custom" ? null : (rawValue as ProductSlotDto);
                                form.setValue(`productRows.${index}.slot`, nextSlot, { shouldDirty: true });
                                if (!normalizeText(form.getValues(`productRows.${index}.title` as const) ?? "")) {
                                  form.setValue(`productRows.${index}.title`, defaultTitleForSlot(nextSlot), { shouldDirty: true });
                                }
                              }}
                            >
                              {productSlotOptions.map((option) => (
                                <option key={option.label} value={option.value ?? "custom"}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => productRows.remove(index)}
                          >
                            Delete row
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-4">
                        <ProductPicker
                          row={currentRow}
                          catalog={productCatalog}
                          onSelect={(product) => updateRowFromProduct(index, product)}
                          onClear={() => clearProductRow(index)}
                        />

                        <div className="grid gap-4 md:grid-cols-3">
                          <label className="space-y-2 text-sm font-medium text-slate-700">
                            Brand
                            <Input {...form.register(`productRows.${index}.brand` as const)} />
                          </label>
                          <label className="space-y-2 text-sm font-medium text-slate-700">
                            Company
                            <Input {...form.register(`productRows.${index}.company` as const)} />
                          </label>
                          <label className="space-y-2 text-sm font-medium text-slate-700">
                            Product name
                            <Input {...form.register(`productRows.${index}.productName` as const)} />
                          </label>
                        </div>

                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                          {selectedCatalogProduct ? (
                            <>
                              <span className="font-semibold text-slate-900">Selected catalog product:</span>{" "}
                              {selectedCatalogProduct.brandName} - {selectedCatalogProduct.productName}
                              {selectedCatalogProduct.productType ? ` • ${selectedCatalogProduct.productType}` : ""}
                              {selectedCatalogProduct.qty ? ` • ${selectedCatalogProduct.qty}` : ""}
                              {selectedCatalogProduct.mrp !== null ? ` • MRP ${selectedCatalogProduct.mrp}` : ""}
                            </>
                          ) : (
                            "No catalog product selected for this row yet."
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border border-slate-200 shadow-none">
            <FieldArrayHeader
              label="Morning routine"
              onAdd={() => morningRoutine.append({ step: "", usageAmount: DEFAULT_USAGE_AMOUNTS.cleanser })}
            />
            <div className="space-y-3">
              {morningRoutine.fields.map((field, index) => (
                <div key={field.id} className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                  <Input placeholder="Step" {...form.register(`morningRoutine.${index}.step` as const)} />
                  <Input placeholder="Usage amount" {...form.register(`morningRoutine.${index}.usageAmount` as const)} />
                  <Button type="button" variant="ghost" onClick={() => morningRoutine.remove(index)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border border-slate-200 shadow-none">
            <FieldArrayHeader
              label="Night routine"
              onAdd={() => nightRoutine.append({ step: "", usageAmount: DEFAULT_USAGE_AMOUNTS.serum })}
            />
            <div className="space-y-3">
              {nightRoutine.fields.map((field, index) => (
                <div key={field.id} className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                  <Input placeholder="Step" {...form.register(`nightRoutine.${index}.step` as const)} />
                  <Input placeholder="Usage amount" {...form.register(`nightRoutine.${index}.usageAmount` as const)} />
                  <Button type="button" variant="ghost" onClick={() => nightRoutine.remove(index)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="space-y-4 border border-slate-200 shadow-none">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Product quantity guidance</h3>
            <p className="text-sm text-slate-600">
              These amounts are reflected in the final report and can guide routine edits.
            </p>
          </div>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {quantityGuidance.map((item) => (
              <li key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                {item}
              </li>
            ))}
          </ul>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border border-slate-200 shadow-none">
            <SelectionDropdown
              title="Do This"
              description="Select all lifestyle, routine, and care instructions the doctor wants on the report."
              options={DO_THIS_OPTIONS}
              selectedValues={doThisSelections}
              onToggle={(value) => toggleSelection("doThisSelections", value)}
            />
          </Card>

          <Card className="border border-slate-200 shadow-none">
            <SelectionDropdown
              title="Not That"
              description="Select all cautionary notes and avoid-list items for the final report."
              options={NOT_THAT_OPTIONS}
              selectedValues={notThatSelections}
              onToggle={(value) => toggleSelection("notThatSelections", value)}
            />
          </Card>
        </div>

        <Card className="space-y-3 border border-slate-200 shadow-none">
          <h3 className="text-lg font-semibold text-slate-900">Doctor notes</h3>
          <Textarea
            {...form.register("doctorNotes")}
            className="min-h-[140px]"
            placeholder="Add any review note, doctor note, or caveat here."
          />
        </Card>
      </form>
    </Card>
  );
}
