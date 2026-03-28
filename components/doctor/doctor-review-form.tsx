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
import type { ProductMatchDto, ReportDetailDto } from "@/lib/report/types";

type RoutineItem = {
  step: string;
  usageAmount: string;
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

const productFields = [
  {
    slot: "cleanser",
    prefix: "cleanser",
    title: "Cleanser / Facewash",
    brand: "cleanserBrand",
    company: "cleanserCompany",
    productName: "cleanserProductName"
  },
  {
    slot: "sunscreen",
    prefix: "sunscreen",
    title: "Sunscreen",
    brand: "sunscreenBrand",
    company: "sunscreenCompany",
    productName: "sunscreenProductName"
  },
  {
    slot: "moisturizer",
    prefix: "moisturizer",
    title: "Moisturizer",
    brand: "moisturizerBrand",
    company: "moisturizerCompany",
    productName: "moisturizerProductName"
  },
  {
    slot: "repair_serum",
    prefix: "repairSerum",
    title: "Repair / Serum",
    brand: "repairSerumBrand",
    company: "repairSerumCompany",
    productName: "repairSerumProductName"
  }
] as const satisfies ReadonlyArray<{
  slot: "cleanser" | "sunscreen" | "moisturizer" | "repair_serum";
  prefix: string;
  title: string;
  brand: keyof DoctorReviewFormValues;
  company: keyof DoctorReviewFormValues;
  productName: keyof DoctorReviewFormValues;
}>;

function FieldArrayHeader({
  label,
  onAdd
}: {
  label: string;
  onAdd: () => void;
}) {
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

function matchesSuggestion(
  suggestion: ProductMatchDto,
  brand: string,
  company: string,
  productName: string
) {
  return (
    suggestion.product.brandName === brand &&
    suggestion.product.brandName === company &&
    suggestion.product.productName === productName
  );
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

export function DoctorReviewForm({ report }: { report: ReportDetailDto }) {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

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

  const doThisSelections = form.watch("doThisSelections");
  const notThatSelections = form.watch("notThatSelections");
  const liveSkinScore = form.watch("analysisSkinScore");

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
    return productFields.reduce<Record<string, ProductMatchDto[]>>((accumulator, field) => {
      accumulator[field.slot] = report.productMatches
        .filter((match) => match.slot === field.slot)
        .sort((left, right) => left.rank - right.rank)
        .slice(0, 3);

      return accumulator;
    }, {});
  }, [report.productMatches]);

  useEffect(() => {
    for (const field of productFields) {
      const hasExistingSelection = Boolean(
        form.getValues(field.brand) || form.getValues(field.company) || form.getValues(field.productName)
      );

      if (hasExistingSelection) {
        continue;
      }

      const defaultSuggestion = suggestionsBySlot[field.slot]?.[0];

      if (!defaultSuggestion) {
        continue;
      }

      form.setValue(field.brand, defaultSuggestion.product.brandName, { shouldDirty: false });
      form.setValue(field.company, defaultSuggestion.product.brandName, { shouldDirty: false });
      form.setValue(field.productName, defaultSuggestion.product.productName, { shouldDirty: false });
    }
  }, [form, suggestionsBySlot]);

  function toggleSelection(name: "doThisSelections" | "notThatSelections", value: string) {
    const currentValues = form.getValues(name);
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((item) => item !== value)
      : [...currentValues, value];

    form.setValue(name, nextValues, { shouldDirty: true });
  }

  function buildPayload(values: DoctorReviewFormValues) {
    return {
      cleanserBrand: values.cleanserBrand || null,
      cleanserCompany: values.cleanserCompany || null,
      cleanserProductName: values.cleanserProductName || null,
      sunscreenBrand: values.sunscreenBrand || null,
      sunscreenCompany: values.sunscreenCompany || null,
      sunscreenProductName: values.sunscreenProductName || null,
      moisturizerBrand: values.moisturizerBrand || null,
      moisturizerCompany: values.moisturizerCompany || null,
      moisturizerProductName: values.moisturizerProductName || null,
      repairSerumBrand: values.repairSerumBrand || null,
      repairSerumCompany: values.repairSerumCompany || null,
      repairSerumProductName: values.repairSerumProductName || null,
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

  function applySuggestedProduct(field: (typeof productFields)[number], suggestion: ProductMatchDto | null) {
    if (!suggestion) {
      form.setValue(field.brand, "", { shouldDirty: true });
      form.setValue(field.company, "", { shouldDirty: true });
      form.setValue(field.productName, "", { shouldDirty: true });
      return;
    }

    form.setValue(field.brand, suggestion.product.brandName, { shouldDirty: true });
    form.setValue(field.company, suggestion.product.brandName, { shouldDirty: true });
    form.setValue(field.productName, suggestion.product.productName, { shouldDirty: true });
  }

  function getSelectedSuggestionId(field: (typeof productFields)[number]) {
    const brand = form.watch(field.brand);
    const company = form.watch(field.company);
    const productName = form.watch(field.productName);
    const matchedSuggestion = (suggestionsBySlot[field.slot] ?? []).find((suggestion) =>
      matchesSuggestion(suggestion, brand, company, productName)
    );

    return matchedSuggestion?.id ?? "manual";
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
            The doctor can now adjust the generated analysis, product selection, routines, and guidance before approval.
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

        <section className="grid gap-4 xl:grid-cols-2">
          {productFields.map((field) => (
            <Card className="space-y-4 border border-slate-200 shadow-none" key={field.prefix}>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-slate-900">{field.title}</h3>
                <p className="text-sm text-slate-600">
                  Choose from the top 3 matched products. The first suggestion is kept as the default.
                </p>
              </div>
              <div className="space-y-3">
                {(suggestionsBySlot[field.slot] ?? []).map((suggestion, index) => {
                  const selected = getSelectedSuggestionId(field) === suggestion.id;

                  return (
                    <label
                      key={suggestion.id}
                      className={`flex cursor-pointer gap-3 rounded-2xl border p-3 transition ${
                        selected
                          ? "border-brand-blue bg-brand-blue/5"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${field.prefix}-suggestion`}
                        className="mt-1 h-4 w-4 border-slate-300 text-brand-blue focus:ring-brand-blue"
                        checked={selected}
                        onChange={() => applySuggestedProduct(field, suggestion)}
                      />
                      <div className="space-y-1 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                            Option {index + 1}
                          </span>
                          {index === 0 ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                              Default
                            </span>
                          ) : null}
                        </div>
                        <p className="font-semibold text-slate-900">
                          {suggestion.product.brandName} - {suggestion.product.productName}
                        </p>
                        <p className="text-slate-600">Match score: {Math.round(suggestion.matchScore)} / 100</p>
                      </div>
                    </label>
                  );
                })}
                <label className="flex cursor-pointer gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
                  <input
                    type="radio"
                    name={`${field.prefix}-suggestion`}
                    className="mt-1 h-4 w-4 border-slate-300 text-brand-blue focus:ring-brand-blue"
                    checked={getSelectedSuggestionId(field) === "manual"}
                    onChange={() => applySuggestedProduct(field, null)}
                  />
                  <div>
                    <p className="font-semibold text-slate-900">Custom selection</p>
                    <p>Switch here if the doctor wants to override the suggested options manually.</p>
                  </div>
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Brand
                  <Input {...form.register(field.brand)} />
                </label>
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Company
                  <Input {...form.register(field.company)} />
                </label>
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Product name
                  <Input {...form.register(field.productName)} />
                </label>
              </div>
            </Card>
          ))}
        </section>

        <Card className="space-y-4 border border-slate-200 shadow-none">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Suggested quantity guidance</h3>
            <p className="mt-1 text-sm text-slate-600">
              Use these standard quantities unless the doctor wants to override them in the routine.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {quantityGuidance.map((item) => (
              <div key={item} className="rounded-2xl bg-slate-50 p-3 text-sm font-medium text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </Card>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="border border-slate-200 shadow-none">
            <FieldArrayHeader
              label="Morning routine"
              onAdd={() => morningRoutine.append({ step: "", usageAmount: "" })}
            />
            <div className="space-y-3">
              {morningRoutine.fields.map((field, index) => (
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" key={field.id}>
                  <Input
                    {...form.register(`morningRoutine.${index}.step` as const)}
                    placeholder="Step"
                  />
                  <Input
                    {...form.register(`morningRoutine.${index}.usageAmount` as const)}
                    placeholder="Usage amount"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => morningRoutine.remove(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border border-slate-200 shadow-none">
            <FieldArrayHeader
              label="Night routine"
              onAdd={() => nightRoutine.append({ step: "", usageAmount: "" })}
            />
            <div className="space-y-3">
              {nightRoutine.fields.map((field, index) => (
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]" key={field.id}>
                  <Input
                    {...form.register(`nightRoutine.${index}.step` as const)}
                    placeholder="Step"
                  />
                  <Input
                    {...form.register(`nightRoutine.${index}.usageAmount` as const)}
                    placeholder="Usage amount"
                  />
                  <Button type="button" variant="ghost" onClick={() => nightRoutine.remove(index)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="border border-slate-200 shadow-none">
            <SelectionDropdown
              title="Do This"
              description="Select the care instructions that should appear automatically in the final report."
              options={DO_THIS_OPTIONS}
              selectedValues={doThisSelections}
              onToggle={(value) => toggleSelection("doThisSelections", value)}
            />
          </Card>

          <Card className="border border-slate-200 shadow-none">
            <SelectionDropdown
              title="Not That"
              description="Select the warnings and avoid-list items that should appear automatically in the final report."
              options={NOT_THAT_OPTIONS}
              selectedValues={notThatSelections}
              onToggle={(value) => toggleSelection("notThatSelections", value)}
            />
          </Card>
        </section>

        <Card className="space-y-3 border border-slate-200 shadow-none">
          <h3 className="text-lg font-semibold text-slate-900">Doctor notes</h3>
          <Textarea
            {...form.register("doctorNotes")}
            placeholder="Optional notes for the final report or internal context"
            className="min-h-[140px]"
          />
        </Card>
      </form>
    </Card>
  );
}
