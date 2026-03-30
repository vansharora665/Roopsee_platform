import { summarizeQuizAnswers } from "@/lib/quiz/summary";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function extractAgeFromAnswers(value: unknown): number | null {
  if (!value) {
    return null;
  }

  if (typeof value === "number" || typeof value === "string") {
    const parsed = toNumber(value);
    return parsed && parsed >= 1 && parsed <= 120 ? parsed : null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nestedAge = extractAgeFromAnswers(item);
      if (nestedAge !== null) {
        return nestedAge;
      }
    }

    return null;
  }

  if (isRecord(value)) {
    for (const key of ["age", "age_years", "years", "dob", "date_of_birth", "birth_date", "year_of_birth"]) {
      if (!(key in value)) {
        continue;
      }

      const nestedAge = extractAgeFromAnswers(value[key]);
      if (nestedAge !== null) {
        return nestedAge;
      }
    }

    for (const nestedValue of Object.values(value)) {
      const nestedAge = extractAgeFromAnswers(nestedValue);
      if (nestedAge !== null) {
        return nestedAge;
      }
    }
  }

  return null;
}

function extractAge(row: Record<string, unknown>): number | null {
  const directAge = toNumber(row.age ?? row.age_years);
  if (directAge && directAge >= 1 && directAge <= 120) {
    return directAge;
  }

  const quizAge = extractAgeFromAnswers(row.answers);
  if (quizAge && quizAge >= 1 && quizAge <= 120) {
    return quizAge;
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

function normalizeGenderValue(value: unknown) {
  const normalized = toStringValue(value);

  if (!normalized) {
    return null;
  }

  const compact = normalized.trim().toLowerCase();

  switch (compact) {
    case "male":
    case "m":
      return "Male";
    case "female":
    case "f":
      return "Female";
    case "non-binary":
    case "non binary":
    case "nonbinary":
      return "Non-binary";
    case "prefer not to say":
      return "Prefer not to say";
    default:
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
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

export function extractScanStrings(input: unknown): string[] {
  if (!input) {
    return [];
  }

  if (typeof input === "string") {
    return input.trim() ? [input.trim()] : [];
  }

  if (Array.isArray(input)) {
    return input.flatMap((item) => extractScanStrings(item));
  }

  if (isRecord(input)) {
    return [input.front, input.left, input.right].flatMap((item) => extractScanStrings(item));
  }

  return [];
}

function buildProfileSummary(args: {
  quizSummaryJson: string[];
  skinType: string | null;
  skinConcerns: string[];
}) {
  const sections = [...args.quizSummaryJson];

  if (args.skinType) {
    sections.unshift(`Skin type: ${args.skinType}`);
  }

  if (args.skinConcerns.length > 0) {
    sections.unshift(`Skin concerns: ${args.skinConcerns.join(", ")}`);
  }

  return sections.join("\n");
}

function buildScanJson(row: Record<string, unknown>) {
  const front = toStringValue(row.image_url);
  const left = toStringValue(row.image_url_left);
  const right = toStringValue(row.image_url_right);

  if (!front && !left && !right) {
    return null;
  }

  return {
    front,
    left,
    right,
    ordered_scan_urls: [front, left, right].filter((value): value is string => Boolean(value))
  };
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
  const fullName = toStringValue(row.name);
  const email = toStringValue(row.email);
  const phone = toStringValue(row.phone_no);
  const age = extractAge(row);
  const sex = normalizeGenderValue(row.gender);
  const skinType = toStringValue(row.skin_type);
  const skinConcerns = stringArray(row.skin_concerns);
  const quizJson = row.answers ?? null;
  const quizSummaryJson = summarizeQuizAnswers(quizJson);
  const scansJson = buildScanJson(row);
  const externalId =
    toStringValue(row.quiz_result_id) ??
    toStringValue(row.user_id) ??
    toStringValue(row.id) ??
    crypto.randomUUID();

  return {
    externalId,
    sourceTable,
    fullName,
    email,
    phone,
    age,
    sex,
    profileJson: {
      ...row,
      gender: sex,
      answers: quizJson,
      scans: scansJson,
      skin_type: skinType,
      skin_concerns: skinConcerns
    },
    quizJson,
    quizSummaryJson,
    scansJson,
    profileSummary: buildProfileSummary({
      quizSummaryJson,
      skinType,
      skinConcerns
    }),
    sourceCreatedAt: toStringValue(row.completed_at)
      ? new Date(String(row.completed_at))
      : toStringValue(row.created_at)
        ? new Date(String(row.created_at))
        : null,
    sourceUpdatedAt: toStringValue(row.completed_at)
      ? new Date(String(row.completed_at))
      : toStringValue(row.updated_at)
        ? new Date(String(row.updated_at))
        : null,
    scanReferences: Array.from(new Set(extractScanStrings(scansJson)))
  };
}
