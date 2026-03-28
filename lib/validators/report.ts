import { z } from "zod";

import {
  analysisOutputSchema,
  hydrationSchema,
  oilLevelsSchema,
  overallSeveritySchema,
  textureSchema,
  toneSchema
} from "@/lib/validators/analysis";
import { reportDraftSchema } from "@/lib/validators/draft";

const requiredString = z.string().trim().min(1);
const optionalString = z.string().trim().optional().nullable();

const doctorAnalysisOverrideSchema = z.object({
  skinScore: z.number().min(0).max(10),
  skinType: requiredString,
  condition: requiredString,
  overallSeverity: overallSeveritySchema,
  primaryConcerns: z.array(requiredString).max(5),
  secondaryConcerns: z.array(requiredString).max(5),
  positiveFindings: z.array(requiredString).max(6),
  oilLevels: oilLevelsSchema,
  hydration: hydrationSchema,
  texture: textureSchema,
  tone: toneSchema
});

export const reportStatusSchema = z.enum([
  "draft_generated",
  "under_doctor_review",
  "approved",
  "sent_to_user"
]);

export const intakeSourceSchema = z.enum(["manual", "supabase"]);
export const promptInputModeSchema = z.enum(["manual_context", "scan_assisted"]);

export const routineItemSchema = z.object({
  step: requiredString,
  usageAmount: requiredString
});

export const createReportRequestSchema = z.object({
  patientInfo: z.object({
    name: requiredString,
    age: z.number().int().min(1).max(120),
    sex: requiredString,
    reportDate: requiredString,
    inputSources: z.array(requiredString).min(1)
  }),
  assets: z.object({
    image1Url: optionalString,
    image2Url: optionalString,
    image3Url: optionalString,
    questionnaireText: z.string().trim().default(""),
    profileContextText: z.string().trim().default(""),
    rawFindingsText: z.string().trim().default(""),
    visibleIssues: z.array(requiredString).default([]),
    negativeFindings: z.array(requiredString).default([]),
    profileHints: z.array(requiredString).default([]),
    scanContextJson: z.unknown().optional().nullable(),
    quizSummaryJson: z.unknown().optional().nullable()
  }),
  intakeSource: intakeSourceSchema.default("manual"),
  promptInputMode: promptInputModeSchema.default("manual_context"),
  includeProductCatalogInPrompt: z.boolean().default(false),
  syncedProfileId: z.string().trim().optional().nullable(),
  promptText: z.string().trim().optional().nullable(),
  reportDraftOverride: reportDraftSchema.optional().nullable(),
  analysisOverride: analysisOutputSchema.optional().nullable()
});

export const doctorReviewUpdateSchema = z.object({
  cleanserBrand: optionalString,
  cleanserCompany: optionalString,
  cleanserProductName: optionalString,
  sunscreenBrand: optionalString,
  sunscreenCompany: optionalString,
  sunscreenProductName: optionalString,
  moisturizerBrand: optionalString,
  moisturizerCompany: optionalString,
  moisturizerProductName: optionalString,
  repairSerumBrand: optionalString,
  repairSerumCompany: optionalString,
  repairSerumProductName: optionalString,
  morningRoutine: z.array(routineItemSchema).default([]),
  nightRoutine: z.array(routineItemSchema).default([]),
  doThis: z.array(requiredString).default([]),
  notThat: z.array(requiredString).default([]),
  expertTips: z.array(requiredString).default([]),
  doctorNotes: z.string().trim().optional().nullable(),
  analysisOverride: doctorAnalysisOverrideSchema.optional().nullable()
});

export const reportStatusUpdateSchema = z.object({
  status: reportStatusSchema
});

export const uploadAssetsResponseSchema = z.object({
  image1Url: optionalString,
  image2Url: optionalString,
  image3Url: optionalString
});

export const createReportResponseSchema = z.object({
  id: requiredString,
  status: reportStatusSchema,
  analysisOutput: analysisOutputSchema
});

export type CreateReportRequestInput = z.infer<typeof createReportRequestSchema>;
export type DoctorReviewUpdateInput = z.infer<typeof doctorReviewUpdateSchema>;
export type ReportStatusValue = z.infer<typeof reportStatusSchema>;
export type IntakeSourceValue = z.infer<typeof intakeSourceSchema>;
export type PromptInputModeValue = z.infer<typeof promptInputModeSchema>;
