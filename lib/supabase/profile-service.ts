import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { SyncedProfileDto } from "@/lib/report/types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  extractScanStrings,
  normalizeSupabaseProfileRow
} from "@/lib/supabase/profile-normalizer";

function getProfilesTableName() {
  return process.env.SUPABASE_PROFILES_TABLE ?? "users";
}

function getScansTableName() {
  return process.env.SUPABASE_SCANS_TABLE ?? "skin_scans";
}

function getUpdatedAtColumn() {
  return process.env.SUPABASE_PROFILES_UPDATED_AT_COLUMN ?? "updated_at";
}

function getStorageBucketName() {
  return process.env.SUPABASE_STORAGE_BUCKET ?? process.env.SUPABASE_SCANS_BUCKET ?? "skin-scans";
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function stringifyDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function stringArrayFromUnknown(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function readString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}


type OrderedScanBundle = {
  front: string[];
  left: string[];
  right: string[];
  ordered_scan_urls: string[];
  raw: Record<string, unknown>;
};

type ApprovedProductExport = {
  slot: string;
  brand?: string;
  company?: string;
  product_name?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}


function getScanOrderScore(value: string) {
  const lower = value.toLowerCase();

  if (lower.includes("front")) {
    return 0;
  }

  if (lower.includes("left")) {
    return 1;
  }

  if (lower.includes("right")) {
    return 2;
  }

  return 99;
}

function orderScanReferences(references: string[]) {
  return [...references].sort((left, right) => {
    const scoreDelta = getScanOrderScore(left) - getScanOrderScore(right);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return left.localeCompare(right);
  });
}

function normalizeStoragePath(value: string, bucket: string | null) {
  const trimmed = value.replace(/^\/+/, "");

  if (!bucket) {
    return trimmed;
  }

  if (trimmed.startsWith(`${bucket}/`)) {
    return trimmed.slice(bucket.length + 1);
  }

  return trimmed;
}

async function resolveScanUrls(references: string[]) {
  if (references.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const bucket = getStorageBucketName();

  return Array.from(
    new Set(
      references
        .map((reference) => reference.trim())
        .filter(Boolean)
        .map((reference) => {
          if (isHttpUrl(reference)) {
            return reference;
          }

          if (!bucket) {
            return reference;
          }

          const publicUrl = supabase.storage
            .from(bucket)
            .getPublicUrl(normalizeStoragePath(reference, bucket)).data.publicUrl;

          return publicUrl || reference;
        })
    )
  );
}

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

function getScanFieldReferences(row: Record<string, unknown>, fieldNames: string[]) {
  return Array.from(
    new Set(
      fieldNames.flatMap((fieldName) => {
        const value = row[fieldName];
        return value === undefined ? [] : extractScanStrings(value);
      })
    )
  );
}

function buildOrderedScanBundle(scanRow: Record<string, unknown>): OrderedScanBundle {
  const front = getScanFieldReferences(scanRow, ["front", "front_url", "front_image", "front_image_url"]);
  const left = getScanFieldReferences(scanRow, ["left", "left_url", "left_image", "left_image_url"]);
  const right = getScanFieldReferences(scanRow, ["right", "right_url", "right_image", "right_image_url"]);
  const orderedScanUrls = Array.from(new Set(orderScanReferences([...front, ...left, ...right])));

  return {
    front,
    left,
    right,
    ordered_scan_urls: orderedScanUrls,
    raw: scanRow
  };
}

function getScanRowTimestamp(row: Record<string, unknown>) {
  const value = readString(row.updated_at) ?? readString(row.created_at);
  return value ? Date.parse(value) || 0 : 0;
}

function buildScanRowMap(rows: Record<string, unknown>[], linkColumn: string) {
  const map = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    const key = readString(row[linkColumn]);

    if (!key) {
      continue;
    }

    const existing = map.get(key);

    if (!existing || getScanRowTimestamp(row) >= getScanRowTimestamp(existing)) {
      map.set(key, row);
    }
  }

  return map;
}

function isMissingColumnError(message: string) {
  return /column .* does not exist|Could not find the .* column/i.test(message);
}

async function fetchScanRowMap(profileIds: string[]) {
  if (profileIds.length === 0) {
    return new Map<string, Record<string, unknown>>();
  }

  const supabase = getSupabaseAdminClient();
  const table = getScansTableName();
  const candidateColumns = Array.from(
    new Set([process.env.SUPABASE_SCANS_LINK_COLUMN, "user_id", "id"].filter((value): value is string => Boolean(value)))
  );

  let lastError: Error | null = null;

  for (const column of candidateColumns) {
    const { data, error } = await supabase.from(table).select("*").in(column, profileIds);

    if (!error) {
      return buildScanRowMap((data ?? []) as Record<string, unknown>[], column);
    }

    if (!isMissingColumnError(error.message)) {
      throw new Error(`Supabase skin_scans fetch failed: ${error.message}`);
    }

    lastError = new Error(error.message);
  }

  if (lastError) {
    throw new Error(
      `Supabase skin_scans mapping failed. Tried link columns ${candidateColumns.join(", ")} but none worked.`
    );
  }

  return new Map<string, Record<string, unknown>>();
}

async function fetchBucketScanBundle(profileId: string): Promise<OrderedScanBundle | null> {
  const bucket = getStorageBucketName();

  if (!bucket) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).list(profileId, {
    limit: 20,
    sortBy: { column: "name", order: "asc" }
  });

  if (error) {
    throw new Error(`Supabase storage scan lookup failed: ${error.message}`);
  }

  const filePaths = (data ?? [])
    .map((item) => readString(item.name))
    .filter((value): value is string => Boolean(value))
    .filter((value) => /\.(png|jpe?g|webp|heic)$/i.test(value))
    .map((value) => `${profileId}/${value}`);

  if (filePaths.length === 0) {
    return null;
  }

  const front = filePaths.filter((value) => value.toLowerCase().includes("front"));
  const left = filePaths.filter((value) => value.toLowerCase().includes("left"));
  const right = filePaths.filter((value) => value.toLowerCase().includes("right"));
  const orderedScanUrls = Array.from(new Set(orderScanReferences([...front, ...left, ...right, ...filePaths])));

  return {
    front,
    left,
    right,
    ordered_scan_urls: orderedScanUrls,
    raw: {
      source: "supabase-storage",
      bucket,
      folder: profileId,
      files: filePaths
    }
  };
}

function mergeProfileRowWithScans(
  profileRow: Record<string, unknown>,
  scanRow: Record<string, unknown> | undefined,
  bucketScanBundle?: OrderedScanBundle | null
) {
  const scanBundle = scanRow ? buildOrderedScanBundle(scanRow) : bucketScanBundle ?? null;

  if (!scanBundle) {
    return profileRow;
  }

  return {
    ...profileRow,
    scans: scanBundle,
    skin_scans: scanRow ?? scanBundle.raw
  };
}

async function enrichProfileRowsWithScans(rows: Record<string, unknown>[]) {
  const profileIds = rows
    .map((row) => readString(row.id))
    .filter((value): value is string => Boolean(value));
  const scanRowMap = await fetchScanRowMap(profileIds);

  return Promise.all(
    rows.map(async (row) => {
      const profileId = readString(row.id);
      const scanRow = profileId ? scanRowMap.get(profileId) : undefined;
      const bucketScanBundle = profileId ? await fetchBucketScanBundle(profileId) : null;

      return mergeProfileRowWithScans(row, scanRow, bucketScanBundle);
    })
  );
}

async function upsertNormalizedProfile(row: Record<string, unknown>) {
  const normalized = normalizeSupabaseProfileRow(row, getProfilesTableName());
  const scanUrls = await resolveScanUrls(normalized.scanReferences);

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

async function syncEnrichedProfileRows(rows: Record<string, unknown>[]) {
  const enrichedRows = await enrichProfileRowsWithScans(rows);
  const synced = [];

  for (const row of enrichedRows) {
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

  const [profile] = await syncEnrichedProfileRows([matchingRow]);
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
  return syncEnrichedProfileRows(rawRows);
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
  const [enrichedRow] = await enrichProfileRowsWithScans([row]);
  const record = await upsertNormalizedProfile(enrichedRow ?? row);
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
  sourceTable?: string | null;
  products: ApprovedProductExport[];
}) {
  const supabase = getSupabaseAdminClient();
  const table = args.sourceTable?.trim() || getProfilesTableName();

  const { error } = await supabase
    .from(table)
    .update({ products: args.products })
    .eq("id", args.externalId);

  if (error) {
    throw new Error(`Supabase products update failed: ${error.message}`);
  }
}
