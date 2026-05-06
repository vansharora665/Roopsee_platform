import { readFile } from "fs/promises";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { SyncedProfileDto } from "@/lib/report/types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  extractScanStrings,
  normalizeSupabaseProfileRow
} from "@/lib/supabase/profile-normalizer";

function getProfilesTableName() {
  return process.env.SUPABASE_PROFILES_TABLE ?? "master_user_quiz";
}

function getUpdatedAtColumn() {
  return process.env.SUPABASE_PROFILES_UPDATED_AT_COLUMN ?? "completed_at";
}

function getProductsTableName() {
  return process.env.SUPABASE_PRODUCTS_TABLE ?? "products";
}

function getUsersTableName() {
  return process.env.SUPABASE_USERS_TABLE ?? "users";
}

function getUsersMatchColumn() {
  return process.env.SUPABASE_USERS_MATCH_COLUMN ?? "id";
}

function getQuizResultsTableName() {
  return process.env.SUPABASE_REPORTS_TABLE ?? "quiz_results";
}

function getQuizResultsMatchColumn() {
  return process.env.SUPABASE_REPORTS_MATCH_COLUMN ?? "id";
}

function getReportsBucketName() {
  return process.env.SUPABASE_REPORTS_BUCKET ?? "reports";
}

function getQuizResultsMatchColumns() {
  return Array.from(
    new Set(
      [getQuizResultsMatchColumn(), "id", "quiz_result_id", "quizResultId"].filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      )
    )
  );
}

async function purgeProfilesFromOtherSources() {
  await prisma.syncedProfile.deleteMany({
    where: {
      OR: [
        { sourceTable: null },
        { sourceTable: { not: getProfilesTableName() } }
      ]
    }
  });
}

function readString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stringifyDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function stringArrayFromUnknown(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

type ApprovedProductExport = {
  id: number | null;
  mrp: number | null;
  qty: string | null;
  image_url: string | null;
  brand_name: string;
  product_name: string;
  product_type: string | null;
  claimed_skin_type: string;
  claimed_skin_concerns: string;
  protocol_condition?: string | null;
  twin_products?: unknown;
};

function serializeSyncedProfile(record: {
  id: string;
  externalId: string;
  sourceTable: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  age: number | null;
  sex: string | null;
  profileSummary: string | null;
  profileJson: unknown;
  quizJson: unknown;
  quizSummaryJson: unknown;
  scansJson: unknown;
  scanUrls: unknown;
  sourceCreatedAt: Date | null;
  sourceUpdatedAt: Date | null;
  lastSyncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): SyncedProfileDto {
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
    profileJson:
      typeof record.profileJson === "object" && record.profileJson
        ? (record.profileJson as Record<string, unknown>)
        : {},
    quizJson: record.quizJson ?? null,
    quizSummaryJson: record.quizSummaryJson ?? null,
    scansJson: record.scansJson ?? null,
    scanUrls: stringArrayFromUnknown(record.scanUrls),
    sourceCreatedAt: stringifyDate(record.sourceCreatedAt),
    sourceUpdatedAt: stringifyDate(record.sourceUpdatedAt),
    lastSyncedAt: record.lastSyncedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

async function upsertNormalizedProfile(row: Record<string, unknown>) {
  const normalized = normalizeSupabaseProfileRow(row, getProfilesTableName());
  const scanUrls = Array.from(new Set(normalized.scanReferences));

  return prisma.syncedProfile.upsert({
    where: {
      externalId: normalized.externalId
    },
    update: {
      sourceTable: normalized.sourceTable,
      fullName: normalized.fullName,
      email: normalized.email,
      phone: normalized.phone,
      age: normalized.age,
      sex: normalized.sex,
      profileJson: normalized.profileJson as Prisma.InputJsonValue,
      quizJson: normalized.quizJson ? (normalized.quizJson as Prisma.InputJsonValue) : undefined,
      quizSummaryJson: normalized.quizSummaryJson as Prisma.InputJsonValue,
      scansJson: normalized.scansJson ? (normalized.scansJson as Prisma.InputJsonValue) : undefined,
      scanUrls: scanUrls as Prisma.InputJsonValue,
      profileSummary: normalized.profileSummary,
      sourceCreatedAt: normalized.sourceCreatedAt,
      sourceUpdatedAt: normalized.sourceUpdatedAt,
      lastSyncedAt: new Date()
    },
    create: {
      externalId: normalized.externalId,
      sourceTable: normalized.sourceTable,
      fullName: normalized.fullName,
      email: normalized.email,
      phone: normalized.phone,
      age: normalized.age,
      sex: normalized.sex,
      profileJson: normalized.profileJson as Prisma.InputJsonValue,
      quizJson: normalized.quizJson ? (normalized.quizJson as Prisma.InputJsonValue) : undefined,
      quizSummaryJson: normalized.quizSummaryJson as Prisma.InputJsonValue,
      scansJson: normalized.scansJson ? (normalized.scansJson as Prisma.InputJsonValue) : undefined,
      scanUrls: scanUrls as Prisma.InputJsonValue,
      profileSummary: normalized.profileSummary,
      sourceCreatedAt: normalized.sourceCreatedAt,
      sourceUpdatedAt: normalized.sourceUpdatedAt,
      lastSyncedAt: new Date()
    }
  });
}

async function fetchSupabaseProfileRowsByIds(profileIds: string[]) {
  if (profileIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const table = getProfilesTableName();
  const { data, error } = await supabase.from(table).select("*").in("quiz_result_id", profileIds);

  if (error) {
    throw new Error(`Supabase profile lookup failed: ${error.message}`);
  }

  return (data ?? []) as Record<string, unknown>[];
}

async function fetchSupabaseProfileRowsByEmails(emails: string[]) {
  if (emails.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const table = getProfilesTableName();
  const { data, error } = await supabase.from(table).select("*").in("email", emails);

  if (error) {
    throw new Error(`Supabase profile lookup failed: ${error.message}`);
  }

  return (data ?? []) as Record<string, unknown>[];
}

async function syncProfileRows(rows: Record<string, unknown>[]) {
  const synced = [];

  for (const row of rows) {
    synced.push(await upsertNormalizedProfile(row));
  }

  return synced.map(serializeSyncedProfile);
}

export async function syncSupabaseProfileByExternalId(externalId: string) {
  const rows = await fetchSupabaseProfileRowsByIds([externalId]);
  const matchingRow = rows.find((row) => readString(row.quiz_result_id) === externalId || readString(row.user_id) === externalId || readString(row.id) === externalId);

  if (!matchingRow) {
    return null;
  }

  const [profile] = await syncProfileRows([matchingRow]);
  return profile ?? null;
}

export async function syncSupabaseProfileByEmail(email: string) {
  const rows = await fetchSupabaseProfileRowsByEmails([email]);
  const matchingRow = rows.find((row) => readString(row.email) === email);

  if (!matchingRow) {
    return null;
  }

  const [profile] = await syncProfileRows([matchingRow]);
  return profile ?? null;
}

export async function syncSupabaseProfilesByEmails(emails: string[]) {
  const normalizedEmails = Array.from(
    new Set(
      emails
        .map((email) => readString(email)?.toLowerCase())
        .filter((value): value is string => Boolean(value))
    )
  );

  if (normalizedEmails.length === 0) {
    return [];
  }

  const rows = await fetchSupabaseProfileRowsByEmails(normalizedEmails);
  return syncProfileRows(rows);
}

export async function syncSupabaseProfiles(limit = 50) {
  const supabase = getSupabaseAdminClient();
  const table = getProfilesTableName();
  const updatedAtColumn = getUpdatedAtColumn();
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .order(updatedAtColumn, { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Supabase sync failed: ${error.message}`);
  }

  await purgeProfilesFromOtherSources();

  const rawRows = (data ?? []) as Record<string, unknown>[];
  return syncProfileRows(rawRows);
}

export async function listSyncedProfiles() {
  const records = await prisma.syncedProfile.findMany({
    where: {
      sourceTable: getProfilesTableName()
    },
    orderBy: [{ lastSyncedAt: "desc" }, { updatedAt: "desc" }],
    take: 100
  });

  return records.map(serializeSyncedProfile);
}

export async function getSyncedProfileById(id: string) {
  const record = await prisma.syncedProfile.findFirst({
    where: {
      id,
      sourceTable: getProfilesTableName()
    }
  });

  return record ? serializeSyncedProfile(record) : null;
}

export async function ingestSupabaseWebhookRow(row: Record<string, unknown>) {
  const record = await upsertNormalizedProfile(row);
  return serializeSyncedProfile(record);
}

export function extractStoredScanUrls(
  profile: Pick<SyncedProfileDto, "scanUrls" | "scansJson"> | null | undefined
) {
  if (!profile) {
    return [];
  }

  return profile.scanUrls.length > 0
    ? profile.scanUrls
    : Array.from(new Set(extractScanStrings(profile.scansJson)));
}

export async function listSupabaseProductMetadata() {
  const supabase = getSupabaseAdminClient();
  const table = getProductsTableName();
  const { data, error } = await supabase
    .from(table)
    .select("id,brand_name,product_name,image_url")
    .limit(500);

  if (error) {
    throw new Error(`Supabase products metadata lookup failed: ${error.message}`);
  }

  return (data ?? []) as Array<{
    id: number | null;
    brand_name: string | null;
    product_name: string | null;
    image_url: string | null;
  }>;
}

export async function updateSupabaseUserProducts(args: {
  userId: string | null;
  userEmail?: string | null;
  products: ApprovedProductExport[];
}) {
  const supabase = getSupabaseAdminClient();
  const table = getUsersTableName();
  const attempts = [
    args.userId ? { column: getUsersMatchColumn(), value: args.userId } : null,
    args.userEmail ? { column: "email", value: args.userEmail } : null
  ].filter((attempt): attempt is { column: string; value: string } => Boolean(attempt?.value));

  let lastError: string | null = null;

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from(table)
      .update({ products: args.products })
      .eq(attempt.column, attempt.value)
      .select(attempt.column)
      .maybeSingle();

    if (error) {
      lastError = `${attempt.column}: ${error.message}`;
      continue;
    }

    if (data) {
      return;
    }
  }

  if (lastError) {
    throw new Error(`Supabase products update failed: ${lastError}`);
  }

  throw new Error(
    `Supabase products update failed: no users row matched ${attempts.map((attempt) => `${attempt.column}=${attempt.value}`).join(", ") || "provided identifiers"}`
  );
}


export async function uploadPublicReportPdf(args: {
  reportId: string;
  pdfPath: string;
  pdfFileName: string;
}) {
  const supabase = getSupabaseAdminClient();
  const bucket = getReportsBucketName();

  const createBucketResult = await supabase.storage.createBucket(bucket, {
    public: true,
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf"]
  });

  if (createBucketResult.error && !/already exists|duplicate/i.test(createBucketResult.error.message)) {
    throw new Error(`Supabase reports bucket setup failed: ${createBucketResult.error.message}`);
  }

  if (createBucketResult.error) {
    const updateBucketResult = await supabase.storage.updateBucket(bucket, {
      public: true,
      fileSizeLimit: 20 * 1024 * 1024,
      allowedMimeTypes: ["application/pdf"]
    });

    if (updateBucketResult.error) {
      throw new Error(`Supabase reports bucket update failed: ${updateBucketResult.error.message}`);
    }
  }

  const fileBuffer = await readFile(args.pdfPath);
  const objectPath = `reports/${args.reportId}/${args.pdfFileName}`;
  const uploadResult = await supabase.storage
    .from(bucket)
    .upload(objectPath, fileBuffer, {
      contentType: "application/pdf",
      upsert: true
    });

  if (uploadResult.error) {
    throw new Error(`Supabase report upload failed: ${uploadResult.error.message}`);
  }

  const publicUrlResult = supabase.storage.from(bucket).getPublicUrl(objectPath);
  const publicUrl = publicUrlResult.data.publicUrl;

  if (!publicUrl) {
    throw new Error("Supabase report upload failed: public URL was not returned");
  }

  return {
    bucket,
    objectPath,
    publicUrl
  };
}

export async function updateSupabaseQuizResultReport(args: {
  quizResultId: string;
  reportUrl: string;
}) {
  const supabase = getSupabaseAdminClient();
  const table = getQuizResultsTableName();

  let lastError: string | null = null;

  for (const matchColumn of getQuizResultsMatchColumns()) {
    const { data, error } = await supabase
      .from(table)
      .update({ reports: args.reportUrl })
      .eq(matchColumn, args.quizResultId)
      .select(matchColumn)
      .maybeSingle();

    if (error) {
      lastError = `${matchColumn}: ${error.message}`;
      continue;
    }

    if (data) {
      return;
    }
  }

  if (lastError) {
    throw new Error(`Supabase quiz_results update failed: ${lastError}`);
  }

  throw new Error(
    `Supabase quiz_results update failed: no row matched ${args.quizResultId} in columns ${getQuizResultsMatchColumns().join(", ")}`
  );
}

export async function updateSupabaseQuizResultFields(args: {
  quizResultId: string;
  fields: {
    do_this?: unknown;
    not_that?: unknown;
    morning_routine?: unknown;
    night_routine?: unknown;
    over_all_skin_profile?: unknown;
    key_skin_concerns?: unknown;
    positive_findings?: unknown;
    primary_observations?: unknown;
    doctor_notes?: string | null;
  };
}) {
  const supabase = getSupabaseAdminClient();
  const table = getQuizResultsTableName();

  let lastError: string | null = null;

  for (const matchColumn of getQuizResultsMatchColumns()) {
    const { data, error } = await supabase
      .from(table)
      .update(args.fields)
      .eq(matchColumn, args.quizResultId)
      .select(matchColumn)
      .maybeSingle();

    if (error) {
      lastError = `${matchColumn}: ${error.message}`;
      continue;
    }

    if (data) {
      return;
    }
  }

  if (lastError) {
    throw new Error(`Supabase quiz_results field update failed: ${lastError}`);
  }

  throw new Error(
    `Supabase quiz_results field update failed: no row matched ${args.quizResultId} in columns ${getQuizResultsMatchColumns().join(", ")}`
  );
}
