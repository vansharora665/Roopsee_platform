import type { Prisma } from "@prisma/client";

import type {
  DoctorHandoff,
  IngredientPlan,
  ProductMatchingPlan,
  RoutinePlan
} from "@/lib/validators/draft";
import type { AnalysisOutput } from "@/lib/validators/analysis";
import type {
  ProductMatchDto,
  ReportDetailDto,
  ReportListItemDto,
  RoutineItem,
  SyncedProfileDto
} from "@/lib/report/types";

export const reportInclude = {
  patientInfo: true,
  assets: true,
  analysisOutput: true,
  generatedFile: true,
  syncedProfile: true,
  promptSession: true,
  approvedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  },
  productMatches: {
    include: {
      product: true
    },
    orderBy: [{ slot: "asc" }, { rank: "asc" }]
  },
  doctorReview: {
    include: {
      reviewedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true
        }
      }
    }
  }
} satisfies Prisma.ReportInclude;

export type ReportRecord = Prisma.ReportGetPayload<{
  include: typeof reportInclude;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringArrayFromJson(value: Prisma.JsonValue | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function routineArrayFromJson(value: Prisma.JsonValue | null | undefined): RoutineItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    if (typeof item.step === "string" && typeof item.usageAmount === "string") {
      return [
        {
          step: item.step,
          usageAmount: item.usageAmount
        }
      ];
    }

    return [];
  });
}

function objectOrNull<T>(value: Prisma.JsonValue | null | undefined) {
  return isRecord(value) ? (value as T) : null;
}

function serializeSyncedProfile(
  record: ReportRecord["syncedProfile"]
): SyncedProfileDto | null {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    externalId: record.externalId,
    sourceTable: record.sourceTable,
    fullName: record.fullName,
    email: record.email,
    phone: record.phone,
    age: record.age,
    sex: record.sex,
    profileSummary: record.profileSummary,
    profileJson: isRecord(record.profileJson) ? (record.profileJson as Record<string, unknown>) : {},
    quizJson: record.quizJson ?? null,
    quizSummaryJson: record.quizSummaryJson ?? null,
    scansJson: record.scansJson ?? null,
    scanUrls: stringArrayFromJson(record.scanUrls),
    sourceCreatedAt: record.sourceCreatedAt?.toISOString() ?? null,
    sourceUpdatedAt: record.sourceUpdatedAt?.toISOString() ?? null,
    lastSyncedAt: record.lastSyncedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function serializeProductMatches(matches: ReportRecord["productMatches"]): ProductMatchDto[] {
  return matches.map((match) => ({
    id: match.id,
    slot: match.slot,
    rank: match.rank,
    matchScore: match.matchScore,
    reason: isRecord(match.reasonJson) ? (match.reasonJson as Record<string, unknown>) : {},
    product: {
      id: match.product.id,
      brandName: match.product.brandName,
      productName: match.product.productName,
      category: match.product.category,
      productType: match.product.productType,
      claimedSkinTypes: stringArrayFromJson(match.product.claimedSkinTypes),
      claimedSkinConcerns: stringArrayFromJson(match.product.claimedSkinConcerns),
      heroIngredients: stringArrayFromJson(match.product.heroIngredients),
      otherKeyIngredients: stringArrayFromJson(match.product.otherKeyIngredients),
      potentialIrritants: stringArrayFromJson(match.product.potentialIrritants),
      textureFinish: match.product.textureFinish,
      overallSuitabilityScore: match.product.overallSuitabilityScore,
      productUrl: match.product.productUrl
    }
  }));
}

export function serializeReport(record: ReportRecord): ReportDetailDto {
  if (!record.patientInfo || !record.assets || !record.analysisOutput || !record.doctorReview) {
    throw new Error("Report is missing required sections");
  }

  return {
    id: record.id,
    status: record.status,
    intakeSource: record.intakeSource,
    promptInputMode: record.promptInputMode,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    approvedAt: record.approvedAt?.toISOString() ?? null,
    sentAt: record.sentAt?.toISOString() ?? null,
    approvedBy: record.approvedBy
      ? {
          ...record.approvedBy,
          role: record.approvedBy.role
        }
      : null,
    syncedProfile: serializeSyncedProfile(record.syncedProfile),
    patientInfo: {
      name: record.patientInfo.name,
      age: record.patientInfo.age,
      sex: record.patientInfo.sex,
      reportDate: record.patientInfo.reportDate.toISOString(),
      inputSources: stringArrayFromJson(record.patientInfo.inputSources)
    },
    assets: {
      image1Url: record.assets.image1Url ?? null,
      image2Url: record.assets.image2Url ?? null,
      image3Url: record.assets.image3Url ?? null,
      questionnaireText: record.assets.questionnaireText ?? "",
      rawFindingsText: record.assets.rawFindingsText ?? "",
      visibleIssues: stringArrayFromJson(record.assets.visibleIssues),
      negativeFindings: stringArrayFromJson(record.assets.negativeFindings),
      profileHints: stringArrayFromJson(record.assets.profileHints),
      scanContextJson: record.assets.scanContextJson ?? null,
      quizSummaryJson: record.assets.quizSummaryJson ?? null
    },
    analysisOutput: {
      skinScore: record.analysisOutput.skinScore,
      skinScoreLabel: record.analysisOutput.skinScoreLabel,
      skinType: record.analysisOutput.skinType,
      condition: record.analysisOutput.condition,
      overallSeverity: record.analysisOutput.overallSeverity,
      primaryConcerns: stringArrayFromJson(record.analysisOutput.primaryConcerns),
      secondaryConcerns: stringArrayFromJson(record.analysisOutput.secondaryConcerns),
      positiveFindings: stringArrayFromJson(record.analysisOutput.positiveFindings),
      oilLevels: record.analysisOutput.oilLevels,
      hydration: record.analysisOutput.hydration,
      texture: record.analysisOutput.texture,
      tone: record.analysisOutput.tone,
      ingredientPlan: objectOrNull<IngredientPlan>(record.analysisOutput.ingredientPlan),
      routinePlan: objectOrNull<RoutinePlan>(record.analysisOutput.routinePlan),
      productMatchingNotes: objectOrNull<ProductMatchingPlan>(
        record.analysisOutput.productMatchingNotes
      ),
      doctorHandoff: objectOrNull<DoctorHandoff>(record.analysisOutput.doctorHandoffJson),
      rawModelJson: record.analysisOutput.rawModelJson as AnalysisOutput
    },
    promptSession: record.promptSession
      ? {
          id: record.promptSession.id,
          status: record.promptSession.status,
          promptText: record.promptSession.promptText,
          promptContext: record.promptSession.promptContext ?? null,
          responseRawText: record.promptSession.responseRawText ?? null,
          responseJson: record.promptSession.responseJson ?? null,
          createdAt: record.promptSession.createdAt.toISOString(),
          updatedAt: record.promptSession.updatedAt.toISOString()
        }
      : null,
    productMatches: serializeProductMatches(record.productMatches),
    doctorReview: {
      cleanserBrand: record.doctorReview.cleanserBrand ?? null,
      cleanserCompany: record.doctorReview.cleanserCompany ?? null,
      cleanserProductName: record.doctorReview.cleanserProductName ?? null,
      sunscreenBrand: record.doctorReview.sunscreenBrand ?? null,
      sunscreenCompany: record.doctorReview.sunscreenCompany ?? null,
      sunscreenProductName: record.doctorReview.sunscreenProductName ?? null,
      moisturizerBrand: record.doctorReview.moisturizerBrand ?? null,
      moisturizerCompany: record.doctorReview.moisturizerCompany ?? null,
      moisturizerProductName: record.doctorReview.moisturizerProductName ?? null,
      repairSerumBrand: record.doctorReview.repairSerumBrand ?? null,
      repairSerumCompany: record.doctorReview.repairSerumCompany ?? null,
      repairSerumProductName: record.doctorReview.repairSerumProductName ?? null,
      morningRoutine: routineArrayFromJson(record.doctorReview.morningRoutine),
      nightRoutine: routineArrayFromJson(record.doctorReview.nightRoutine),
      doThis: stringArrayFromJson(record.doctorReview.doThis),
      notThat: stringArrayFromJson(record.doctorReview.notThat),
      expertTips: stringArrayFromJson(record.doctorReview.expertTips),
      doctorNotes: record.doctorReview.doctorNotes ?? null,
      reviewedBy: record.doctorReview.reviewedByUser
        ? {
            ...record.doctorReview.reviewedByUser,
            role: record.doctorReview.reviewedByUser.role
          }
        : null
    },
    generatedFile: record.generatedFile
      ? {
          pdfUrl: record.generatedFile.pdfUrl ?? null,
          htmlSnapshotPath: record.generatedFile.htmlSnapshotPath ?? null
        }
      : null
  };
}

export function toReportListItem(record: ReportRecord): ReportListItemDto {
  const report = serializeReport(record);

  return {
    id: report.id,
    status: report.status,
    intakeSource: report.intakeSource,
    promptInputMode: report.promptInputMode,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    approvedAt: report.approvedAt,
    sentAt: report.sentAt,
    generatedFile: report.generatedFile,
    patientInfo: report.patientInfo,
    syncedProfile: report.syncedProfile
      ? {
          id: report.syncedProfile.id,
          externalId: report.syncedProfile.externalId,
          sourceTable: report.syncedProfile.sourceTable
        }
      : null,
    analysisOutput: {
      skinScore: report.analysisOutput.skinScore,
      skinScoreLabel: report.analysisOutput.skinScoreLabel,
      skinType: report.analysisOutput.skinType,
      overallSeverity: report.analysisOutput.overallSeverity
    }
  };
}
