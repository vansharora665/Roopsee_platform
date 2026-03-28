"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { summarizeQuizAnswers } from "@/lib/quiz/summary";
import { promptDraftPlaceholder } from "@/lib/report/manual-prompt-builder";
import type { SyncedProfileDto } from "@/lib/report/types";
import { cleanStringList } from "@/lib/utils";
import { createReportRequestSchema } from "@/lib/validators/report";

type FormValues = {
  intakeSource: "manual" | "supabase";
  promptInputMode: "manual_context" | "scan_assisted";
  includeProductCatalogInPrompt: boolean;
  syncedProfileId: string;
  name: string;
  age: number;
  sex: string;
  reportDate: string;
  inputSourcesText: string;
  questionnaireText: string;
  rawFindingsText: string;
  visibleIssuesText: string;
  negativeFindingsText: string;
  profileHintsText: string;
  reportDraftJson: string;
  image1Url: string;
  image2Url: string;
  image3Url: string;
  image1File?: FileList;
  image2File?: FileList;
  image3File?: FileList;
};

const imageFieldGroups = [
  { index: 1, label: "Front", url: "image1Url", file: "image1File" },
  { index: 2, label: "Left", url: "image2Url", file: "image2File" },
  { index: 3, label: "Right", url: "image3Url", file: "image3File" }
] as const;

function parseListInput(value: string) {
  return cleanStringList(value.split(/[\n,]+/g));
}

function readString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  return null;
}

function getProfileString(profile: SyncedProfileDto, keys: string[]) {
  for (const key of keys) {
    const directValue = readString((profile.profileJson as Record<string, unknown>)[key]);

    if (directValue) {
      return directValue;
    }
  }

  return null;
}

function getProfileNumber(profile: SyncedProfileDto, keys: string[]) {
  for (const key of keys) {
    const directValue = readNumber((profile.profileJson as Record<string, unknown>)[key]);

    if (directValue !== null) {
      return directValue;
    }
  }

  return null;
}

function getProfileStringArray(profile: SyncedProfileDto, keys: string[]) {
  for (const key of keys) {
    const value = (profile.profileJson as Record<string, unknown>)[key];

    if (typeof value === "string") {
      const items = parseListInput(value);
      if (items.length > 0) {
        return items;
      }
    }

    if (Array.isArray(value)) {
      const items = value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
      if (items.length > 0) {
        return items;
      }
    }
  }

  return [];
}

function getQuizLines(value: unknown) {
  if (Array.isArray(value)) {
    const directLines = value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);

    if (directLines.length > 0) {
      return directLines;
    }
  }

  if (typeof value === "string") {
    return value.split(/\n+/g).map((item) => item.trim()).filter(Boolean);
  }

  return summarizeQuizAnswers(value);
}

function buildInheritedProfileContext(profile: SyncedProfileDto | null) {
  if (!profile) {
    return "";
  }

  const profileJson = profile.profileJson as Record<string, unknown>;
  const lines = [
    `Full name: ${profile.fullName ?? getProfileString(profile, ["name", "full_name"]) ?? "Not provided"}`,
    `Email: ${profile.email ?? getProfileString(profile, ["email"]) ?? "Not provided"}`,
    `Phone: ${profile.phone ?? getProfileString(profile, ["phone_no", "phone", "mobile"]) ?? "Not provided"}`,
    `Gender: ${profile.sex ?? getProfileString(profile, ["gender", "sex"]) ?? "Not provided"}`,
    `Age: ${profile.age ?? getProfileNumber(profile, ["age"]) ?? "Not provided"}`,
    `Completed at: ${profile.sourceUpdatedAt ?? getProfileString(profile, ["updated_at"]) ?? "Not provided"}`
  ];

  const skinType = readString(profileJson.skin_type);
  const skinConcerns = getProfileStringArray(profile, ["skin_concerns"]);

  if (skinType) {
    lines.push(`Skin type: ${skinType}`);
  }

  if (skinConcerns.length > 0) {
    lines.push(`Skin concerns: ${skinConcerns.join(", ")}`);
  }

  return lines.join(" | ");
}

function valuesForStatus(includeProductCatalogInPrompt: boolean) {
  return includeProductCatalogInPrompt
    ? "Prompt generated with inherited master_user_quiz answers, gender, current front/left/right image URLs, and the imported product catalog for direct GPT product selection."
    : "Prompt generated with inherited master_user_quiz answers, gender, and current front/left/right image URLs. Product selection will fall back to ingredient-based catalog matching.";
}

async function uploadSelectedImages(values: FormValues) {
  const uploadPayload = new FormData();
  const image1File = values.image1File?.[0];
  const image2File = values.image2File?.[0];
  const image3File = values.image3File?.[0];

  if (image1File) uploadPayload.append("image1", image1File);
  if (image2File) uploadPayload.append("image2", image2File);
  if (image3File) uploadPayload.append("image3", image3File);

  if (Array.from(uploadPayload.keys()).length === 0) {
    return {
      image1Url: values.image1Url || null,
      image2Url: values.image2Url || null,
      image3Url: values.image3Url || null
    };
  }

  const uploadResponse = await fetch("/api/uploads", {
    method: "POST",
    body: uploadPayload
  });

  if (!uploadResponse.ok) {
    throw new Error("Image upload failed");
  }

  const uploadData = (await uploadResponse.json()) as {
    data: {
      image1Url?: string | null;
      image2Url?: string | null;
      image3Url?: string | null;
    };
  };

  return {
    image1Url: uploadData.data.image1Url ?? values.image1Url ?? null,
    image2Url: uploadData.data.image2Url ?? values.image2Url ?? null,
    image3Url: uploadData.data.image3Url ?? values.image3Url ?? null
  };
}

export function NewReportForm({ initialProfiles }: { initialProfiles: SyncedProfileDto[] }) {
  const router = useRouter();
  const [profiles, setProfiles] = useState(initialProfiles);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isSyncingProfiles, setIsSyncingProfiles] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    defaultValues: {
      intakeSource: "manual",
      promptInputMode: "scan_assisted",
      includeProductCatalogInPrompt: true,
      syncedProfileId: "",
      name: "",
      age: 25,
      sex: "Female",
      reportDate: new Date().toISOString().slice(0, 10),
      inputSourcesText: "3 facial images, Questionnaire, Skin quiz",
      questionnaireText: "",
      rawFindingsText: "",
      visibleIssuesText: "",
      negativeFindingsText: "",
      profileHintsText: "",
      reportDraftJson: "",
      image1Url: "",
      image2Url: "",
      image3Url: "",
      image1File: undefined,
      image2File: undefined,
      image3File: undefined
    }
  });

  const selectedProfileId = form.watch("syncedProfileId");
  const includeProductCatalogInPrompt = form.watch("includeProductCatalogInPrompt");
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const selectedProfileJson = (selectedProfile?.profileJson ?? {}) as Record<string, unknown>;
  const selectedProfileQuizLines = selectedProfile
    ? getQuizLines(selectedProfile.quizSummaryJson ?? selectedProfile.quizJson)
    : [];
  const inheritedProfileContext = buildInheritedProfileContext(selectedProfile);
  const selectedProfileSkinConcerns = selectedProfile
    ? getProfileStringArray(selectedProfile, ["skin_concerns"])
    : [];
  const isProfileLocked = Boolean(selectedProfile);

  function applyProfile(profileId: string) {
    const profile = profiles.find((item) => item.id === profileId) ?? null;

    form.setValue("syncedProfileId", profileId);

    if (!profile) {
      return;
    }

    const quizLines = getQuizLines(profile.quizSummaryJson ?? profile.quizJson);

    form.setValue("intakeSource", "supabase");
    form.setValue("name", profile.fullName ?? getProfileString(profile, ["name", "full_name"]) ?? "");
    form.setValue("age", profile.age ?? getProfileNumber(profile, ["age"]) ?? 25);
    form.setValue("sex", profile.sex ?? getProfileString(profile, ["sex", "gender"]) ?? "Female");
    form.setValue("questionnaireText", quizLines.join("\n"));
    form.setValue("profileHintsText", getProfileStringArray(profile, ["skin_concerns"]).join(", "));
    form.setValue("image1Url", profile.scanUrls[0] ?? "");
    form.setValue("image2Url", profile.scanUrls[1] ?? "");
    form.setValue("image3Url", profile.scanUrls[2] ?? "");
    setStatusMessage(
      "Profile details, master_user_quiz answers, gender, and front/left/right image URLs were inherited automatically."
    );
  }

  async function refreshProfiles() {
    const response = await fetch("/api/supabase/profiles", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Could not load synced profiles");
    }

    const body = (await response.json()) as { data: SyncedProfileDto[] };
    setProfiles(body.data);

    if (selectedProfileId.length > 0) {
      const refreshedProfile = body.data.find((profile) => profile.id === selectedProfileId);

      if (refreshedProfile) {
        applyProfile(refreshedProfile.id);
      }
    }
  }

  async function handleSyncProfiles() {
    setError(null);
    setStatusMessage(null);
    setIsSyncingProfiles(true);

    try {
      const response = await fetch("/api/supabase/profiles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ limit: 50 })
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Could not sync Supabase profiles");
      }

      const body = (await response.json()) as { data: SyncedProfileDto[] };
      setProfiles(body.data);

      if (selectedProfileId.length > 0) {
        const refreshedProfile = body.data.find((profile) => profile.id === selectedProfileId);

        if (refreshedProfile) {
          applyProfile(refreshedProfile.id);
        }
      }

      setStatusMessage("Latest profiles were pulled from Supabase.");
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Could not sync Supabase profiles");
    } finally {
      setIsSyncingProfiles(false);
    }
  }

  async function buildPayload(values: FormValues) {
    if (values.name.trim().length === 0) {
      throw new Error("Name is required");
    }

    if (values.reportDate.trim().length === 0) {
      throw new Error("Report date is required");
    }

    if (Number.isFinite(values.age) === false || values.age < 1 || values.age > 120) {
      throw new Error("Age must be between 1 and 120");
    }

    const uploadedUrls = await uploadSelectedImages(values);
    form.setValue("image1Url", uploadedUrls.image1Url ?? "");
    form.setValue("image2Url", uploadedUrls.image2Url ?? "");
    form.setValue("image3Url", uploadedUrls.image3Url ?? "");

    const parsedDraftJson = values.reportDraftJson.trim().length > 0 ? JSON.parse(values.reportDraftJson) : null;

    return createReportRequestSchema.parse({
      patientInfo: {
        name: values.name.trim(),
        age: values.age,
        sex: values.sex,
        reportDate: values.reportDate,
        inputSources: parseListInput(values.inputSourcesText)
      },
      assets: {
        image1Url: uploadedUrls.image1Url,
        image2Url: uploadedUrls.image2Url,
        image3Url: uploadedUrls.image3Url,
        questionnaireText: values.questionnaireText,
        profileContextText: inheritedProfileContext,
        rawFindingsText: values.rawFindingsText,
        visibleIssues: parseListInput(values.visibleIssuesText),
        negativeFindings: parseListInput(values.negativeFindingsText),
        profileHints: parseListInput(values.profileHintsText),
        quizSummaryJson: selectedProfile?.quizJson ?? selectedProfile?.quizSummaryJson ?? null,
        scanContextJson: selectedProfile?.scansJson ?? null
      },
      intakeSource: values.intakeSource,
      promptInputMode: values.promptInputMode,
      includeProductCatalogInPrompt: values.includeProductCatalogInPrompt,
      syncedProfileId: values.syncedProfileId || null,
      promptText: generatedPrompt.trim().length > 0 ? generatedPrompt : null,
      reportDraftOverride: parsedDraftJson
    });
  }

  async function handleGeneratePrompt() {
    setError(null);
    setStatusMessage(null);
    setIsGeneratingPrompt(true);

    try {
      const payload = await buildPayload(form.getValues());
      const response = await fetch("/api/reports/prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Could not build the prompt");
      }

      const body = (await response.json()) as {
        data: {
          promptText: string;
        };
      };

      setGeneratedPrompt(body.data.promptText);
      setStatusMessage(
        valuesForStatus(includeProductCatalogInPrompt)
      );
    } catch (promptError) {
      setError(promptError instanceof Error ? promptError.message : "Could not build the prompt");
    } finally {
      setIsGeneratingPrompt(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setError(null);
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const payload = await buildPayload(values);
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Could not create report");
      }

      const body = (await response.json()) as { data: { id: string } };
      router.push(`/reports/${body.data.id}`);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Could not create report");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="grid gap-4 bg-slate-950 text-white lg:grid-cols-4">
        {[
          ["1", "Choose intake source", "Use a synced Supabase profile or create a report manually."],
          ["2", "Generate prompt", "Build a consistent JSON prompt in the Roopsee format."],
          ["3", "Paste GPT JSON", "Bring the report draft back into the platform without editing raw fields later."],
          ["4", "Doctor review", "Approve products, tips, and final wording from the dashboard."]
        ].map(([step, title, description]) => (
          <div key={step} className="rounded-3xl bg-white/6 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">Step {step}</p>
            <h2 className="mt-2 text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-slate-300">{description}</p>
          </div>
        ))}
      </Card>

      <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
        <Card className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-blue">
                Intake setup
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Profile source and prompt mode</h2>
            </div>
            <Button type="button" variant="secondary" onClick={handleSyncProfiles} disabled={isSyncingProfiles || isSubmitting}>
              {isSyncingProfiles ? "Syncing Supabase..." : "Sync latest Supabase profiles"}
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Intake source
              <Select {...form.register("intakeSource")}>
                <option value="manual">Manual intake</option>
                <option value="supabase">Supabase profile</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Prompt mode
              <Select {...form.register("promptInputMode")}>
                <option value="scan_assisted">Use uploaded scans in ChatGPT</option>
                <option value="manual_context">Use written context only</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Synced profile
              <Select value={selectedProfileId} onChange={(event) => applyProfile(event.target.value)}>
                <option value="">Select a synced profile</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {(profile.fullName ?? profile.email ?? profile.externalId) + " • " + (profile.sourceTable ?? "profiles")}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
              {...form.register("includeProductCatalogInPrompt")}
            />
            <span>
              <span className="block font-semibold text-slate-900">Attach imported product catalog to prompt</span>
              <span className="mt-1 block text-slate-600">
                When enabled, the prompt includes the imported product list so GPT can return exact cleanser, sunscreen,
                moisturizer, and repair serum selections. Turn this off to use the older ingredient-plan plus catalog-search fallback.
              </span>
            </span>
          </label>

          {selectedProfile ? (
            <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-slate-500">Profile</p>
                  <p className="font-semibold text-slate-900">{selectedProfile.fullName ?? "Unnamed profile"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Contact</p>
                  <p className="font-semibold text-slate-900">{selectedProfile.email ?? selectedProfile.phone ?? "Not available"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Scans detected</p>
                  <p className="font-semibold text-slate-900">{String(selectedProfile.scanUrls.length)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Last synced</p>
                  <p className="font-semibold text-slate-900">{new Date(selectedProfile.lastSyncedAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                <p>
                  Quiz responses, gender, and image URLs were inherited from <code>master_user_quiz</code> and will be included automatically when you generate the prompt.
                </p>
                <p className="mt-1 text-emerald-700">
                  Inherited questionnaire lines: {selectedProfileQuizLines.length}
                </p>
                <p className="mt-1 text-emerald-700">
                  Inherited prompt fields below are locked. Use manual findings or upload overrides if you need to add context.
                </p>
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-blue">
              Patient context
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Editable intake details</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Name
              <Input {...form.register("name")} placeholder="Patient full name" readOnly={isProfileLocked} />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Age
              <Input {...form.register("age", { valueAsNumber: true })} type="number" min={1} max={120} readOnly={isProfileLocked} />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Sex
              <Select {...form.register("sex")} disabled={isProfileLocked}>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </Select>
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Report date
              <Input {...form.register("reportDate")} type="date" />
            </label>
          </div>

          {selectedProfile ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Email
                <Input value={selectedProfile.email ?? getProfileString(selectedProfile, ["email"]) ?? ""} readOnly />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Phone
                <Input value={selectedProfile.phone ?? getProfileString(selectedProfile, ["phone_no", "phone", "mobile"]) ?? ""} readOnly />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Completed at
                <Input value={selectedProfile.sourceUpdatedAt ?? getProfileString(selectedProfile, ["updated_at"]) ?? ""} readOnly />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Skin type
                <Input value={readString(selectedProfileJson.skin_type) ?? ""} readOnly />
              </label>
            </div>
          ) : null}

          {selectedProfile ? (
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Skin concerns
              <Input value={selectedProfileSkinConcerns.join(", ")} readOnly />
            </label>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Input sources
              <Input {...form.register("inputSourcesText")} placeholder="3 facial images, Questionnaire, Skin quiz" />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Profile hints
              <Input {...form.register("profileHintsText")} placeholder="Pigmentation-prone, post-acne marks, sensitive barrier" readOnly={isProfileLocked} />
            </label>
            <label className="space-y-2 text-sm font-medium text-slate-700 lg:col-span-2">
              Questionnaire / quiz responses
              <Textarea
                {...form.register("questionnaireText")}
                className="min-h-[180px]"
                placeholder="Only the questionnaire responses should live here. Contact and profile metadata stay in their own boxes above."
                readOnly={isProfileLocked}
              />
            </label>
          </div>

          <details className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">
              Optional manual findings and extra context
            </summary>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-700 lg:col-span-2">
                Manual findings / scan interpretation notes
                <Textarea
                  {...form.register("rawFindingsText")}
                  className="min-h-[140px]"
                  placeholder="Describe tone, texture, oiliness, hydration, lesions, pigmentation, and any visible negatives."
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Visible issues
                <Textarea
                  {...form.register("visibleIssuesText")}
                  className="min-h-[110px]"
                  placeholder="Pigmentation, dullness, clogged pores"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Negative findings
                <Textarea
                  {...form.register("negativeFindingsText")}
                  className="min-h-[110px]"
                  placeholder="No cystic acne, no visible barrier cracks"
                />
              </label>
            </div>
          </details>
        </Card>

        <Card className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-blue">
              Scan inputs
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Inherited scan URLs with upload override</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Selecting a profile auto-fills front, left, and right scan URLs from Supabase. If you upload files here, those uploaded image URLs override the inherited ones before prompt generation and report creation.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {imageFieldGroups.map((group) => (
              <div key={group.index} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-600">
                  {group.label} scan
                </h3>
                <div className="mt-4 space-y-3">
                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    Current URL
                    <Input {...form.register(group.url)} placeholder="https://..." readOnly={isProfileLocked} />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    Upload file to override URL
                    <Input {...form.register(group.file)} type="file" accept="image/*" />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-blue">
                Prompt workstation
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Generate and copy the fixed GPT prompt</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                The prompt automatically includes the selected profile metadata, the questionnaire inherited from <code>master_user_quiz.answers</code>, the scan context, and the current front/left/right image references. If catalog attachment is enabled, it also includes the imported product list so GPT can choose exact products directly.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={handleGeneratePrompt} disabled={isGeneratingPrompt || isSubmitting}>
                {isGeneratingPrompt ? "Generating prompt..." : "Generate prompt"}
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  if (generatedPrompt.trim().length === 0) {
                    return;
                  }

                  await navigator.clipboard.writeText(generatedPrompt);
                  setStatusMessage("Prompt copied to clipboard.");
                }}
                disabled={generatedPrompt.trim().length === 0}
              >
                Copy prompt
              </Button>
            </div>
          </div>

          <Textarea
            value={generatedPrompt}
            onChange={(event) => setGeneratedPrompt(event.target.value)}
            className="min-h-[360px] font-mono text-xs"
            placeholder="Generate the prompt once the intake details are ready."
          />
        </Card>

        <Card className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-blue">
              Draft JSON
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Paste the returned Roopsee draft JSON</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Paste the full JSON response from ChatGPT. The platform will validate it, match products, and create the doctor draft. If you leave it blank, the existing AI fallback can still run.
            </p>
          </div>
          <Textarea
            {...form.register("reportDraftJson")}
            className="min-h-[420px] font-mono text-xs"
            placeholder={promptDraftPlaceholder}
          />
        </Card>

        {statusMessage ? <p className="text-sm font-medium text-emerald-700">{statusMessage}</p> : null}
        {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating report..." : "Create report draft"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting}
            onClick={() => {
              form.reset();
              setGeneratedPrompt("");
              setStatusMessage(null);
              setError(null);
            }}
          >
            Reset form
          </Button>
        </div>
      </form>
    </div>
  );
}
