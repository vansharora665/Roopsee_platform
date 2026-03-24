import type { AnalysisOutput } from "@/lib/validators/analysis";
import type {
  DoctorHandoff,
  IngredientPlan,
  ProductMatchingPlan,
  ReportDraft,
  RoutinePlan
} from "@/lib/validators/draft";
import type {
  CreateReportRequestInput,
  DoctorReviewUpdateInput,
  IntakeSourceValue,
  PromptInputModeValue,
  ReportStatusValue
} from "@/lib/validators/report";

export type AnalysisOutputDto = AnalysisOutput;
export type CreateReportInputDto = CreateReportRequestInput;
export type DoctorReviewInputDto = DoctorReviewUpdateInput;
export type ReportStatusDto = ReportStatusValue;
export type IntakeSourceDto = IntakeSourceValue;
export type PromptInputModeDto = PromptInputModeValue;
export type ProductSlotDto = "cleanser" | "sunscreen" | "moisturizer" | "repair_serum";

export type RoutineItem = {
  step: string;
  usageAmount: string;
};

export type SyncedProfileDto = {
  id: string;
  externalId: string;
  sourceTable: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  age: number | null;
  sex: string | null;
  profileSummary: string | null;
  profileJson: Record<string, unknown>;
  quizJson: unknown;
  quizSummaryJson: unknown;
  scansJson: unknown;
  scanUrls: string[];
  sourceCreatedAt: string | null;
  sourceUpdatedAt: string | null;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PromptSessionDto = {
  id: string;
  status: "pending" | "imported" | "completed";
  promptText: string;
  promptContext: unknown;
  responseRawText: string | null;
  responseJson: unknown;
  createdAt: string;
  updatedAt: string;
};

export type ProductCatalogDto = {
  id: string;
  brandName: string;
  productName: string;
  category: string | null;
  productType: string | null;
  claimedSkinTypes: string[];
  claimedSkinConcerns: string[];
  heroIngredients: string[];
  otherKeyIngredients: string[];
  potentialIrritants: string[];
  textureFinish: string | null;
  overallSuitabilityScore: number | null;
  productUrl: string | null;
};

export type ProductMatchDto = {
  id: string;
  slot: ProductSlotDto;
  rank: number;
  matchScore: number;
  reason: Record<string, unknown>;
  product: ProductCatalogDto;
};

export type ReportDetailDto = {
  id: string;
  status: ReportStatusDto;
  intakeSource: IntakeSourceDto;
  promptInputMode: PromptInputModeDto;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  sentAt: string | null;
  approvedBy: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  syncedProfile: SyncedProfileDto | null;
  patientInfo: {
    name: string;
    age: number;
    sex: string;
    reportDate: string;
    inputSources: string[];
  };
  assets: {
    image1Url: string | null;
    image2Url: string | null;
    image3Url: string | null;
    questionnaireText: string;
    rawFindingsText: string;
    visibleIssues: string[];
    negativeFindings: string[];
    profileHints: string[];
    scanContextJson: unknown;
    quizSummaryJson: unknown;
  };
  analysisOutput: {
    skinScore: number;
    skinScoreLabel: string;
    skinType: string;
    condition: string;
    overallSeverity: string;
    primaryConcerns: string[];
    secondaryConcerns: string[];
    positiveFindings: string[];
    oilLevels: string;
    hydration: string;
    texture: string;
    tone: string;
    ingredientPlan: IngredientPlan | null;
    routinePlan: RoutinePlan | null;
    productMatchingNotes: ProductMatchingPlan | null;
    doctorHandoff: DoctorHandoff | null;
    rawModelJson: AnalysisOutput;
  };
  promptSession: PromptSessionDto | null;
  productMatches: ProductMatchDto[];
  doctorReview: {
    cleanserBrand: string | null;
    cleanserCompany: string | null;
    cleanserProductName: string | null;
    sunscreenBrand: string | null;
    sunscreenCompany: string | null;
    sunscreenProductName: string | null;
    moisturizerBrand: string | null;
    moisturizerCompany: string | null;
    moisturizerProductName: string | null;
    repairSerumBrand: string | null;
    repairSerumCompany: string | null;
    repairSerumProductName: string | null;
    morningRoutine: RoutineItem[];
    nightRoutine: RoutineItem[];
    doThis: string[];
    notThat: string[];
    expertTips: string[];
    doctorNotes: string | null;
    reviewedBy: {
      id: string;
      name: string;
      email: string;
      role: string;
    } | null;
  };
  generatedFile: {
    pdfUrl: string | null;
    htmlSnapshotPath: string | null;
  } | null;
};

export type ReportListItemDto = Pick<
  ReportDetailDto,
  | "id"
  | "status"
  | "intakeSource"
  | "promptInputMode"
  | "createdAt"
  | "updatedAt"
  | "approvedAt"
  | "sentAt"
  | "generatedFile"
> & {
  patientInfo: ReportDetailDto["patientInfo"];
  syncedProfile: Pick<SyncedProfileDto, "id" | "externalId" | "sourceTable"> | null;
  analysisOutput: Pick<
    ReportDetailDto["analysisOutput"],
    "skinScore" | "skinScoreLabel" | "skinType" | "overallSeverity"
  >;
};

export type BuildPromptResultDto = {
  promptText: string;
  resolvedInput: CreateReportInputDto;
};

export type ReportDraftDto = ReportDraft;
