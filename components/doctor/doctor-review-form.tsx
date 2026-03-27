"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_USAGE_AMOUNTS, DO_THIS_OPTIONS, NOT_THAT_OPTIONS } from "@/lib/report/default-guidance";
import type { ReportDetailDto } from "@/lib/report/types";

type ListItem = {
  value: string;
};

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
  morningRoutine: RoutineItem[];
  nightRoutine: RoutineItem[];
  doThisSelections: string[];
  notThatSelections: string[];
  expertTipItems: ListItem[];
  doctorNotes: string;
};

const productFields = [
  {
    prefix: "cleanser",
    title: "Cleanser",
    brand: "cleanserBrand",
    company: "cleanserCompany",
    productName: "cleanserProductName"
  },
  {
    prefix: "sunscreen",
    title: "Sunscreen",
    brand: "sunscreenBrand",
    company: "sunscreenCompany",
    productName: "sunscreenProductName"
  },
  {
    prefix: "moisturizer",
    title: "Moisturizer",
    brand: "moisturizerBrand",
    company: "moisturizerCompany",
    productName: "moisturizerProductName"
  },
  {
    prefix: "repairSerum",
    title: "Repair / Serum",
    brand: "repairSerumBrand",
    company: "repairSerumCompany",
    productName: "repairSerumProductName"
  }
] as const satisfies ReadonlyArray<{
  prefix: string;
  title: string;
  brand: keyof DoctorReviewFormValues;
  company: keyof DoctorReviewFormValues;
  productName: keyof DoctorReviewFormValues;
}>;

function asListItems(values: string[]) {
  return values.length ? values.map((value) => ({ value })) : [{ value: "" }];
}

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
      morningRoutine: report.doctorReview.morningRoutine.length
        ? report.doctorReview.morningRoutine
        : [{ step: "", usageAmount: "" }],
      nightRoutine: report.doctorReview.nightRoutine.length
        ? report.doctorReview.nightRoutine
        : [{ step: "", usageAmount: "" }],
      doThisSelections: report.doctorReview.doThis,
      notThatSelections: report.doctorReview.notThat,
      expertTipItems: asListItems(report.doctorReview.expertTips),
      doctorNotes: report.doctorReview.doctorNotes ?? ""
    }
  });

  const morningRoutine = useFieldArray({ control: form.control, name: "morningRoutine" });
  const nightRoutine = useFieldArray({ control: form.control, name: "nightRoutine" });
  const expertTipItems = useFieldArray({ control: form.control, name: "expertTipItems" });

  const doThisSelections = form.watch("doThisSelections");
  const notThatSelections = form.watch("notThatSelections");

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
      expertTips: values.expertTipItems.map((item) => item.value.trim()).filter(Boolean),
      doctorNotes: values.doctorNotes.trim() || null
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
            GPT-generated analysis stays read-only here. Product choices, routines, preset guidance,
            and delivery actions are finalized separately by the doctor.
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
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {report.assets.questionnaireText || "No questionnaire notes added"}
              </p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-slate-500">Manual findings</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
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
                    throw new Error("Could not approve report");
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
        <section className="grid gap-4 xl:grid-cols-2">
          {productFields.map((field) => (
            <Card className="space-y-4 border border-slate-200 shadow-none" key={field.prefix}>
              <h3 className="text-lg font-semibold text-slate-900">{field.title}</h3>
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

        <Card className="border border-slate-200 shadow-none">
          <FieldArrayHeader
            label="Expert tips"
            onAdd={() => expertTipItems.append({ value: "" })}
          />
          <div className="space-y-3">
            {expertTipItems.fields.map((field, index) => (
              <div className="grid gap-3 md:grid-cols-[1fr_auto]" key={field.id}>
                <Input
                  {...form.register(`expertTipItems.${index}.value` as const)}
                  placeholder="Doctor expert tip"
                />
                <Button type="button" variant="ghost" onClick={() => expertTipItems.remove(index)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </Card>

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
