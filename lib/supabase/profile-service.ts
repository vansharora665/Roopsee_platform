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
  return process.env.SUPABASE_PROFILES_UPDATED_AT_COLUMN ?? "updated_at";
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
  slot: string;
  brand?: string;
  company?: string;
  product_name?: string;
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
  const { data, error } = await supabase.from(table).select("*").in("id", profileIds);

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
  const matchingRow = rows.find((row) => readString(row.id) === externalId);

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

  const rawRows = (data ?? []) as Record<string, unknown>[];
  return syncProfileRows(rawRows);
}

export async function listSyncedProfiles() {
  const records = await prisma.syncedProfile.findMany({
    orderBy: [{ lastSyncedAt: "desc" }, { updatedAt: "desc" }],
    take: 100
  });

  return records.map(serializeSyncedProfile);
}

export async function getSyncedProfileById(id: string) {
  const record = await prisma.syncedProfile.findUnique({
    where: {
      id
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

export async function updateSupabaseUserProducts(args: {
  externalId: string;
  products: ApprovedProductExport[];
}) {
  const supabase = getSupabaseAdminClient();
  const table = getProfilesTableName();

  const { error } = await supabase
    .from(table)
    .update({ products: args.products })
    .eq("id", args.externalId);

  if (error) {
    throw new Error(`Supabase products update failed: ${error.message}`);
  }
}
