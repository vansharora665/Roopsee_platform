import { summarizeQuizAnswers } from "@/lib/quiz/summary";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function asRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  return null;
}

function toStringValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function stringArray(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/[\n,;/]+/g)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => stringArray(item));
  }

  return [];
}

function looksLikeScanReference(value: string) {
  return (
    /^https?:\/\//i.test(value) ||
    /\.(png|jpe?g|webp|heic)$/i.test(value) ||
    value.includes("/") ||
    value.includes("storage")
  );
}

export function extractScanStrings(input: unknown): string[] {
  if (!input) {
    return [];
  }

  if (typeof input === "string") {
    return looksLikeScanReference(input) ? [input] : [];
  }

  if (Array.isArray(input)) {
    return input.flatMap((item) => extractScanStrings(item));
  }

  if (isRecord(input)) {
    return Object.entries(input).flatMap(([key, value]) => {
      if (
        ["url", "path", "image", "images", "scan", "scans", "photo", "photos"].some((token) =>
          key.toLowerCase().includes(token)
        )
      ) {
        return extractScanStrings(value);
      }

      return extractScanStrings(value);
    });
  }

  return [];
}

function buildProfileSummary(args: {
  quizSummaryJson: string[];
  skinType: string | null;
  skinConcerns: string[];
  phone: string | null;
  email: string | null;
}) {
  const sections = [...args.quizSummaryJson];

  if (args.skinType) {
    sections.unshift(`Skin type: ${args.skinType}`);
  }

  if (args.skinConcerns.length > 0) {
    sections.unshift(`Skin concerns: ${args.skinConcerns.join(", ")}`);
  }

  if (args.phone) {
    sections.push(`Phone: ${args.phone}`);
  }

  if (args.email) {
    sections.push(`Email: ${args.email}`);
  }

  return sections.join("\n");
}

export type NormalizedSupabaseProfile = {
  externalId: string;
  sourceTable: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  age: number | null;
  sex: string | null;
  profileJson: Record<string, unknown>;
  quizJson: unknown;
  quizSummaryJson: string[];
  scansJson: unknown;
  profileSummary: string;
  sourceCreatedAt: Date | null;
  sourceUpdatedAt: Date | null;
  scanReferences: string[];
};

export function normalizeSupabaseProfileRow(
  row: Record<string, unknown>,
  sourceTable: string
): NormalizedSupabaseProfile {
  const nestedProfile = asRecord(firstDefined(row.profile, row.profile_data, row.user_data, row.metadata));
  const skinQuiz = asRecord(firstDefined(row.skin_quiz, nestedProfile.skin_quiz));
  const skinQuizAnswers = firstDefined(skinQuiz.answers, skinQuiz.answer_map, skinQuiz.responses, skinQuiz);
  const skinType = toStringValue(firstDefined(row.skin_type, nestedProfile.skin_type, skinQuiz.skin_type));
  const skinConcerns = stringArray(firstDefined(row.skin_concerns, nestedProfile.skin_concerns, skinQuiz.skin_concerns));
  const quizJson = firstDefined(
    row.quiz_answers,
    row.quiz_json,
    row.questionnaire_json,
    row.quizAnswers,
    skinQuizAnswers,
    row.skin_quiz,
    nestedProfile.quiz_answers,
    nestedProfile.quiz_json
  );
  const scansJson = firstDefined(
    row.scans,
    row.scan_urls,
    row.images,
    row.image_urls,
    row.scan_assets,
    row.photos,
    nestedProfile.scans,
    nestedProfile.images
  );
  const externalId =
    toStringValue(firstDefined(row.id, row.user_id, row.profile_id, nestedProfile.id, nestedProfile.user_id)) ??
    crypto.randomUUID();
  const fullName = toStringValue(
    firstDefined(row.name, row.full_name, row.patient_name, nestedProfile.name, nestedProfile.full_name)
  );
  const email = toStringValue(firstDefined(row.email, nestedProfile.email));
  const phone = toStringValue(
    firstDefined(row.phone_no, row.phone, row.mobile, nestedProfile.phone_no, nestedProfile.phone, nestedProfile.mobile)
  );
  const age = toNumber(firstDefined(row.age, nestedProfile.age, skinQuiz.age));
  const sex = toStringValue(
    firstDefined(row.sex, row.gender, skinQuiz.gender, nestedProfile.sex, nestedProfile.gender)
  );
  const quizSummaryJson = summarizeQuizAnswers(quizJson);

  return {
    externalId,
    sourceTable,
    fullName,
    email,
    phone,
    age,
    sex,
    profileJson: {
      ...nestedProfile,
      ...row,
      skin_type: skinType,
      skin_concerns: skinConcerns,
      phone_no: phone
    },
    quizJson,
    quizSummaryJson,
    scansJson,
    profileSummary: buildProfileSummary({
      quizSummaryJson,
      skinType,
      skinConcerns,
      phone,
      email
    }),
    sourceCreatedAt: toStringValue(firstDefined(row.created_at, nestedProfile.created_at))
      ? new Date(String(firstDefined(row.created_at, nestedProfile.created_at)))
      : null,
    sourceUpdatedAt: toStringValue(firstDefined(row.updated_at, nestedProfile.updated_at))
      ? new Date(String(firstDefined(row.updated_at, nestedProfile.updated_at)))
      : null,
    scanReferences: Array.from(new Set(extractScanStrings(scansJson)))
  };
}
