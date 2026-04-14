import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { reportInclude, serializeReport, type ReportRecord } from "@/lib/report/mappers";
import type { ReportDetailDto, SyncedProfileDto } from "@/lib/report/types";
import { syncSupabaseProfiles } from "@/lib/supabase/profile-service";

type FollowUpReportListItem = {
  id: string;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  pdfUrl: string | null;
  products: Array<{
    title: string;
    brand: string | null;
    productName: string | null;
  }>;
};

export type FollowUpCustomerDto = {
  profile: Pick<SyncedProfileDto, "id" | "externalId" | "fullName" | "email" | "phone" | "age" | "sex" | "lastSyncedAt">;
  reports: FollowUpReportListItem[];
  latestProducts: FollowUpReportListItem["products"];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function productRowsFromJson(value: Prisma.JsonValue | null | undefined): FollowUpReportListItem["products"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const title = typeof item.title === "string" ? item.title : "Product";
    const brand = typeof item.brand === "string" ? item.brand : null;
    const productName = typeof item.productName === "string" ? item.productName : null;

    return [{ title, brand, productName }];
  });
}

export async function listFollowUpCustomers(): Promise<FollowUpCustomerDto[]> {
  await syncSupabaseProfiles(200).catch(() => []);

  const profiles = await prisma.syncedProfile.findMany({
    include: {
      reports: {
        include: {
          doctorReview: true,
          generatedFile: true
        },
        orderBy: {
          createdAt: "desc"
        }
      }
    },
    orderBy: [{ lastSyncedAt: "desc" }, { updatedAt: "desc" }],
    take: 200
  });

  return profiles.map((profile) => {
    const reports = profile.reports.map((report) => ({
      id: report.id,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      approvedAt: report.approvedAt?.toISOString() ?? null,
      pdfUrl: report.generatedFile?.pdfUrl ?? null,
      products: productRowsFromJson(report.doctorReview?.productRows)
    }));

    const latestReportWithProducts = reports.find((report) => report.products.length > 0);

    return {
      profile: {
        id: profile.id,
        externalId: profile.externalId,
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone,
        age: profile.age,
        sex: profile.sex,
        lastSyncedAt: profile.lastSyncedAt.toISOString()
      },
      reports,
      latestProducts: latestReportWithProducts?.products ?? []
    };
  });
}

export async function createFollowUpReport(syncedProfileId: string): Promise<ReportDetailDto> {
  const previousReport = await prisma.report.findFirst({
    where: {
      syncedProfileId,
      patientInfo: {
        isNot: null
      },
      analysisOutput: {
        isNot: null
      },
      doctorReview: {
        isNot: null
      }
    },
    include: reportInclude,
    orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }]
  });

  if (!previousReport?.patientInfo || !previousReport.assets || !previousReport.analysisOutput || !previousReport.doctorReview) {
    throw new Error("No previous report is available for this follow-up");
  }

  const created = await prisma.report.create({
    data: {
      status: "draft_generated",
      intakeSource: "supabase",
      promptInputMode: "manual_context",
      syncedProfileId,
      patientInfo: {
        create: {
          name: previousReport.patientInfo.name,
          age: previousReport.patientInfo.age,
          sex: previousReport.patientInfo.sex,
          reportDate: new Date(),
          inputSources: ["Follow-up consultation", "Previous Roopsee report"]
        }
      },
      assets: {
        create: {
          image1Url: previousReport.assets.image1Url,
          image2Url: previousReport.assets.image2Url,
          image3Url: previousReport.assets.image3Url,
          questionnaireText: previousReport.assets.questionnaireText,
          rawFindingsText: "Follow-up report created from the previous approved prescription. No AI recommendation was run.",
          visibleIssues: (previousReport.assets.visibleIssues ?? []) as Prisma.InputJsonValue,
          negativeFindings: (previousReport.assets.negativeFindings ?? []) as Prisma.InputJsonValue,
          profileHints: (previousReport.assets.profileHints ?? []) as Prisma.InputJsonValue,
          scanContextJson: previousReport.assets.scanContextJson
            ? (previousReport.assets.scanContextJson as Prisma.InputJsonValue)
            : undefined,
          quizSummaryJson: previousReport.assets.quizSummaryJson
            ? (previousReport.assets.quizSummaryJson as Prisma.InputJsonValue)
            : undefined
        }
      },
      analysisOutput: {
        create: {
          skinScore: previousReport.analysisOutput.skinScore,
          skinScoreLabel: previousReport.analysisOutput.skinScoreLabel,
          skinType: previousReport.analysisOutput.skinType,
          condition: previousReport.analysisOutput.condition,
          overallSeverity: previousReport.analysisOutput.overallSeverity,
          primaryConcerns: previousReport.analysisOutput.primaryConcerns as Prisma.InputJsonValue,
          secondaryConcerns: previousReport.analysisOutput.secondaryConcerns as Prisma.InputJsonValue,
          positiveFindings: previousReport.analysisOutput.positiveFindings as Prisma.InputJsonValue,
          oilLevels: previousReport.analysisOutput.oilLevels,
          hydration: previousReport.analysisOutput.hydration,
          texture: previousReport.analysisOutput.texture,
          tone: previousReport.analysisOutput.tone,
          ingredientPlan: previousReport.analysisOutput.ingredientPlan
            ? (previousReport.analysisOutput.ingredientPlan as Prisma.InputJsonValue)
            : undefined,
          routinePlan: previousReport.analysisOutput.routinePlan
            ? (previousReport.analysisOutput.routinePlan as Prisma.InputJsonValue)
            : undefined,
          productMatchingNotes: previousReport.analysisOutput.productMatchingNotes
            ? (previousReport.analysisOutput.productMatchingNotes as Prisma.InputJsonValue)
            : undefined,
          doctorHandoffJson: previousReport.analysisOutput.doctorHandoffJson
            ? (previousReport.analysisOutput.doctorHandoffJson as Prisma.InputJsonValue)
            : undefined,
          rawModelJson: previousReport.analysisOutput.rawModelJson as Prisma.InputJsonValue
        }
      },
      promptSession: {
        create: {
          status: "completed",
          promptText: "Follow-up report. No AI prompt was run.",
          promptContext: {
            followUp: true,
            previousReportId: previousReport.id
          },
          responseRawText: null,
          responseJson: {
            followUp: true,
            previousReportId: previousReport.id
          }
        }
      },
      doctorReview: {
        create: {
          cleanserBrand: previousReport.doctorReview.cleanserBrand,
          cleanserCompany: previousReport.doctorReview.cleanserCompany,
          cleanserProductName: previousReport.doctorReview.cleanserProductName,
          sunscreenBrand: previousReport.doctorReview.sunscreenBrand,
          sunscreenCompany: previousReport.doctorReview.sunscreenCompany,
          sunscreenProductName: previousReport.doctorReview.sunscreenProductName,
          moisturizerBrand: previousReport.doctorReview.moisturizerBrand,
          moisturizerCompany: previousReport.doctorReview.moisturizerCompany,
          moisturizerProductName: previousReport.doctorReview.moisturizerProductName,
          repairSerumBrand: previousReport.doctorReview.repairSerumBrand,
          repairSerumCompany: previousReport.doctorReview.repairSerumCompany,
          repairSerumProductName: previousReport.doctorReview.repairSerumProductName,
          productRows: (previousReport.doctorReview.productRows ?? []) as Prisma.InputJsonValue,
          morningRoutine: (previousReport.doctorReview.morningRoutine ?? []) as Prisma.InputJsonValue,
          nightRoutine: (previousReport.doctorReview.nightRoutine ?? []) as Prisma.InputJsonValue,
          doThis: (previousReport.doctorReview.doThis ?? []) as Prisma.InputJsonValue,
          notThat: (previousReport.doctorReview.notThat ?? []) as Prisma.InputJsonValue,
          expertTips: (previousReport.doctorReview.expertTips ?? []) as Prisma.InputJsonValue,
          doctorNotes: previousReport.doctorReview.doctorNotes
            ? `Follow-up note copied from previous report: ${previousReport.doctorReview.doctorNotes}`
            : "Follow-up draft. Review and edit product continuation before approval."
        }
      },
      generatedFile: {
        create: {
          pdfUrl: null,
          htmlSnapshotPath: null
        }
      }
    },
    include: reportInclude
  });

  return serializeReport(created as ReportRecord);
}
