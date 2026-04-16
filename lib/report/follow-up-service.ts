import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { reportInclude, serializeReport, type ReportRecord } from "@/lib/report/mappers";
import type { DoctorProductRowDto, ProductSlotDto, ReportDetailDto, SyncedProfileDto } from "@/lib/report/types";
import { syncSupabaseProfiles } from "@/lib/supabase/profile-service";

type FollowUpReportListItem = {
  id: string;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  pdfUrl: string | null;
  products: DoctorProductRowDto[];
};

export type FollowUpCustomerDto = {
  profile: Pick<SyncedProfileDto, "id" | "externalId" | "fullName" | "email" | "phone" | "age" | "sex" | "lastSyncedAt">;
  reports: FollowUpReportListItem[];
  latestProducts: FollowUpReportListItem["products"];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function productRowsFromJson(value: Prisma.JsonValue | null | undefined): DoctorProductRowDto[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (!isRecord(item)) {
      return [];
    }

    const id = typeof item.id === "string" && item.id.trim() ? item.id : `follow-up-product-${index + 1}`;
    const title = typeof item.title === "string" ? item.title : "Product";
    const slot = typeof item.slot === "string" ? (item.slot as ProductSlotDto) : null;
    const productCatalogId = typeof item.productCatalogId === "string" ? item.productCatalogId : null;
    const brand = typeof item.brand === "string" ? item.brand : null;
    const company = typeof item.company === "string" ? item.company : brand;
    const productName = typeof item.productName === "string" ? item.productName : null;

    return [{ id, title, slot, productCatalogId, brand, company, productName }];
  });
}

function rowsForSlot(rows: DoctorProductRowDto[], slot: ProductSlotDto) {
  return rows.find((row) => row.slot === slot) ?? null;
}

function buildLegacyProductFields(rows: DoctorProductRowDto[]) {
  const cleanser = rowsForSlot(rows, "cleanser");
  const sunscreen = rowsForSlot(rows, "sunscreen");
  const moisturizer = rowsForSlot(rows, "moisturizer");
  const repairSerum = rowsForSlot(rows, "repair_serum");

  return {
    cleanserBrand: cleanser?.brand ?? null,
    cleanserCompany: cleanser?.company ?? cleanser?.brand ?? null,
    cleanserProductName: cleanser?.productName ?? null,
    sunscreenBrand: sunscreen?.brand ?? null,
    sunscreenCompany: sunscreen?.company ?? sunscreen?.brand ?? null,
    sunscreenProductName: sunscreen?.productName ?? null,
    moisturizerBrand: moisturizer?.brand ?? null,
    moisturizerCompany: moisturizer?.company ?? moisturizer?.brand ?? null,
    moisturizerProductName: moisturizer?.productName ?? null,
    repairSerumBrand: repairSerum?.brand ?? null,
    repairSerumCompany: repairSerum?.company ?? repairSerum?.brand ?? null,
    repairSerumProductName: repairSerum?.productName ?? null
  };
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

export async function createFollowUpReport(
  syncedProfileId: string,
  productRowsOverride?: DoctorProductRowDto[]
): Promise<ReportDetailDto> {
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

  const productRows = productRowsOverride && productRowsOverride.length > 0
    ? productRowsOverride
    : productRowsFromJson(previousReport.doctorReview.productRows);
  const legacyProductFields = buildLegacyProductFields(productRows);

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
          ...legacyProductFields,
          productRows: productRows as Prisma.InputJsonValue,
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
