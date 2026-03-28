import { rm } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { generateValidatedAnalysis } from "@/lib/ai/provider";
import { sendTelegramMessage } from "@/lib/notifications/telegram";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_USAGE_AMOUNTS } from "@/lib/report/default-guidance";
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
  DoctorReviewInputDto,
  ProductSlotDto,
  ReportDetailDto,
  ReportListItemDto,
  ReportStatusDto,
  SyncedProfileDto
} from "@/lib/report/types";
import {
  extractStoredScanUrls,
  getSyncedProfileById,
  updateSupabaseUserProducts
} from "@/lib/supabase/profile-service";
import {
  createReportRequestSchema,
  doctorReviewUpdateSchema,
  reportStatusSchema
} from "@/lib/validators/report";
import type { AnalysisOutput } from "@/lib/validators/analysis";
import type { ReportDraft } from "@/lib/validators/draft";

function buildDraftFromAnalysis(analysis: AnalysisOutput): ReportDraft {
  const primaryConcerns = analysis.key_skin_concerns.primary;
  const secondaryConcerns = analysis.key_skin_concerns.secondary;
  const mainConcern = primaryConcerns[0] ?? secondaryConcerns[0] ?? "Skin support";

  return {
    analysis,
    ingredient_plan: {
      cleanser: {
        purpose: "Cleanse gently without stripping the barrier.",
        hero_ingredients: ["Glycerin"],
        supporting_ingredients: ["Panthenol"],
        notes: "Keep the cleanser mild and barrier-friendly."
      },
      sunscreen: {
        purpose: "Daily broad-spectrum protection to prevent worsening of concerns.",
        hero_ingredients: ["Broad-spectrum UV filters"],
        supporting_ingredients: ["Vitamin E"],
        notes: "Choose a finish the patient can wear daily."
      },
      moisturizer: {
        purpose: "Restore hydration and barrier comfort.",
        hero_ingredients: ["Ceramides"],
        supporting_ingredients: ["Hyaluronic Acid"],
        notes: "Match the texture to the skin type."
      },
      repair_serum: {
        purpose: `Target ${mainConcern.toLowerCase()} safely and consistently.`,
        hero_ingredients: ["Niacinamide"],
        supporting_ingredients: ["Azelaic Acid"],
        notes: "Introduce corrective actives gradually if sensitivity is suspected."
      }
    },
    routine_plan: {
      morning: [
        {
          step: "Cleanser",
          usage_amount: DEFAULT_USAGE_AMOUNTS.cleanser,
          why: "Remove overnight oil and residue gently."
        },
        {
          step: "Moisturizer",
          usage_amount: DEFAULT_USAGE_AMOUNTS.moisturizer,
          why: "Support hydration and comfort through the day."
        },
        {
          step: "Sunscreen",
          usage_amount: DEFAULT_USAGE_AMOUNTS.sunscreen,
          why: "Protect against UV-triggered worsening of skin concerns."
        }
      ],
      night: [
        {
          step: "Cleanser",
          usage_amount: DEFAULT_USAGE_AMOUNTS.cleanser,
          why: "Prepare the skin for treatment products."
        },
        {
          step: "Repair serum",
          usage_amount: DEFAULT_USAGE_AMOUNTS.serum,
          why: `Address ${mainConcern.toLowerCase()} with a targeted active.`
        },
        {
          step: "Moisturizer",
          usage_amount: DEFAULT_USAGE_AMOUNTS.moisturizer,
          why: "Reduce dryness and support tolerance."
        }
      ]
    },
    product_matching: {
      target_concerns: [...primaryConcerns, ...secondaryConcerns],
      avoid_ingredients: [],
      preferred_textures: analysis.primary_observations.oil_levels === "High" ? ["Gel", "Fluid"] : ["Lotion", "Cream"],
      notes: "Use higher suitability products that support the drafted ingredients."
    },
    doctor_handoff: {
      summary: "Review the suggested ingredient stack, routine frequency, and product fit before approval.",
      review_focus: ["Tolerance", "Practical adherence", "Contraindications"]
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


function buildApprovedProductsPayload(report: ReportDetailDto) {
  const products = [
    {
      slot: "cleanser",
      brand: report.doctorReview.cleanserBrand,
      company: report.doctorReview.cleanserCompany,
      product_name: report.doctorReview.cleanserProductName
    },
    {
      slot: "sunscreen",
      brand: report.doctorReview.sunscreenBrand,
      company: report.doctorReview.sunscreenCompany,
      product_name: report.doctorReview.sunscreenProductName
    },
    {
      slot: "moisturizer",
      brand: report.doctorReview.moisturizerBrand,
      company: report.doctorReview.moisturizerCompany,
      product_name: report.doctorReview.moisturizerProductName
    },
    {
      slot: "repair_serum",
      brand: report.doctorReview.repairSerumBrand,
      company: report.doctorReview.repairSerumCompany,
      product_name: report.doctorReview.repairSerumProductName
    }
  ];

  return products.flatMap((product) => {
    const brand = product.brand?.trim() || "";
    const company = product.company?.trim() || "";
    const productName = product.product_name?.trim() || "";

    if (!brand && !company && !productName) {
      return [];
    }

    return [
      {
        slot: product.slot,
        ...(brand ? { brand } : {}),
        ...(company ? { company } : {}),
        ...(productName ? { product_name: productName } : {})
      }
    ];
  });
}

function getSupabaseUserId(report: ReportDetailDto) {
  if (!report.syncedProfile) {
    return null;
  }

  const profileJson = report.syncedProfile.profileJson as Record<string, unknown>;
  const userId = profileJson.user_id ?? profileJson.quiz_user_id;

  return typeof userId === "string" && userId.trim().length > 0 ? userId : null;
}

async function syncApprovedProductsToSupabase(report: ReportDetailDto) {
  const userId = getSupabaseUserId(report);

  if (!userId) {
    return;
  }

  await updateSupabaseUserProducts({
    userId,
    products: buildApprovedProductsPayload(report)
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
    const draft = normalizeDraftScore(buildDraftFromAnalysis(input.analysisOverride));
    return {
      draft,
      rawResponseText: JSON.stringify(draft, null, 2),
      provider: "manual-analysis",
      promptText
    };
  }

  const analysisResult = await generateValidatedAnalysis(input);
  const draft = normalizeDraftScore(buildDraftFromAnalysis(analysisResult.analysis));

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

  const cleanserProduct = bestProductForSlot(productMatches, "cleanser");
  const sunscreenProduct = bestProductForSlot(productMatches, "sunscreen");
  const moisturizerProduct = bestProductForSlot(productMatches, "moisturizer");
  const repairSerumProduct = bestProductForSlot(productMatches, "repair_serum");

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
          cleanserBrand: cleanserProduct?.brandName ?? null,
          cleanserCompany: cleanserProduct?.brandName ?? null,
          cleanserProductName: cleanserProduct?.productName ?? null,
          sunscreenBrand: sunscreenProduct?.brandName ?? null,
          sunscreenCompany: sunscreenProduct?.brandName ?? null,
          sunscreenProductName: sunscreenProduct?.productName ?? null,
          moisturizerBrand: moisturizerProduct?.brandName ?? null,
          moisturizerCompany: moisturizerProduct?.brandName ?? null,
          moisturizerProductName: moisturizerProduct?.productName ?? null,
          repairSerumBrand: repairSerumProduct?.brandName ?? null,
          repairSerumCompany: repairSerumProduct?.brandName ?? null,
          repairSerumProductName: repairSerumProduct?.productName ?? null,
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
  const { analysisOverride, ...doctorReviewInput } = validatedInput;

  const existingReport = await prisma.report.findUnique({
    where: {
      id: reportId
    },
    include: reportInclude
  });

  if (!existingReport) {
    throw new Error("Report not found");
  }

  const rerankedMatches = analysisOverride
    ? rankProductsForDraft({
        patientSkinType: analysisOverride.skinType,
        quizSummaryJson: existingReport.assets?.quizSummaryJson ?? undefined,
        draft: normalizeDraftScore(buildDraftFromAnalysis(buildAnalysisFromDoctorOverride(analysisOverride))),
        catalog: await prisma.productCatalog.findMany()
      })
    : null;

  const report = await prisma.report.update({
    where: {
      id: reportId
    },
    data: {
      doctorReview: {
        update: {
          ...doctorReviewInput,
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

  return serializeReport(report);
}
