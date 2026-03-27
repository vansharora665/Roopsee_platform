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

function getQuizResultsTableName() {
  return process.env.SUPABASE_QUIZ_RESULTS_TABLE ?? "quiz_results";
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

function isMissingColumnError(message: string) {
  return /column .* does not exist|Could not find the .* column/i.test(message);
}

function getRowTimestamp(row: Record<string, unknown>) {
  const value = readString(row.updated_at) ?? readString(row.created_at);
  return value ? Date.parse(value) || 0 : 0;
}

function buildLatestRowMap(rows: Record<string, unknown>[], linkColumn: string) {
  const map = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    const key = readString(row[linkColumn]);

    if (!key) {
      continue;
    }

    const existing = map.get(key);

    if (!existing || getRowTimestamp(row) >= getRowTimestamp(existing)) {
      map.set(key, row);
    }
  }

  return map;
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

function buildQuizResultScanBundle(quizRow: Record<string, unknown>): OrderedScanBundle {
  const front = getScanFieldReferences(quizRow, ["image_url", "front", "front_url", "front_image_url"]);
  const left = getScanFieldReferences(quizRow, ["image_url_left", "left", "left_url", "left_image_url"]);
  const right = getScanFieldReferences(quizRow, ["image_url_right", "right", "right_url", "right_image_url"]);
  const orderedScanUrls = [...front, ...left, ...right];

  return {
    front,
    left,
    right,
    ordered_scan_urls: Array.from(new Set(orderedScanUrls)),
    raw: quizRow
  };
}

function getProfileLinkValue(row: Record<string, unknown>, column: string) {
  if (column === "email") {
    return readString(row.email);
  }

  if (column === "phone_no" || column === "phone") {
    return readString(row.phone_no) ?? readString(row.phone);
  }

  return readString(row.id);
}

async function fetchQuizResultMap(profileRows: Record<string, unknown>[]) {
  if (profileRows.length === 0) {
    return {
      map: new Map<string, Record<string, unknown>>(),
      linkColumn: null as string | null
    };
  }

  const supabase = getSupabaseAdminClient();
  const table = getQuizResultsTableName();
  const candidateColumns = Array.from(
    new Set(
      [
        process.env.SUPABASE_QUIZ_RESULTS_LINK_COLUMN,
        "user_id",
        "profile_id",
        "id",
        "email"
      ].filter((value): value is string => Boolean(value))
    )
  );

  let lastError: Error | null = null;

  for (const column of candidateColumns) {
    const identifiers = Array.from(
      new Set(
        profileRows
          .map((row) => getProfileLinkValue(row, column))
          .filter((value): value is string => Boolean(value))
      )
    );

    if (identifiers.length === 0) {
      continue;
    }

    const { data, error } = await supabase.from(table).select("*").in(column, identifiers);

    if (!error) {
      return {
        map: buildLatestRowMap((data ?? []) as Record<string, unknown>[], column),
        linkColumn: column
      };
    }

    if (!isMissingColumnError(error.message)) {
      throw new Error(`Supabase quiz_results fetch failed: ${error.message}`);
    }

    lastError = new Error(error.message);
  }

  if (lastError) {
    throw new Error(
      `Supabase quiz_results mapping failed. Tried link columns ${candidateColumns.join(", ")} but none worked.`
    );
  }

  return {
    map: new Map<string, Record<string, unknown>>(),
    linkColumn: null as string | null
  };
}

function mergeProfileRowWithQuizResult(
  profileRow: Record<string, unknown>,
  quizRow: Record<string, unknown> | undefined
) {
  if (!quizRow) {
    return profileRow;
  }

  const scanBundle = buildQuizResultScanBundle(quizRow);

  return {
    ...profileRow,
    gender: readString(quizRow.gender) ?? readString(profileRow.gender),
    sex: readString(quizRow.gender) ?? readString(profileRow.sex),
    answers: quizRow.answers ?? profileRow.answers,
    skin_quiz: quizRow.answers ?? profileRow.skin_quiz,
    image_url: scanBundle.front[0] ?? profileRow.image_url,
    image_url_left: scanBundle.left[0] ?? profileRow.image_url_left,
    image_url_right: scanBundle.right[0] ?? profileRow.image_url_right,
    scans: scanBundle,
    quiz_results: quizRow
  };
}

async function enrichProfileRowsWithQuizResults(rows: Record<string, unknown>[]) {
  const { map, linkColumn } = await fetchQuizResultMap(rows);

  return rows.map((row) => {
    const key = linkColumn ? getProfileLinkValue(row, linkColumn) : null;
    const quizRow = key ? map.get(key) : undefined;

    return mergeProfileRowWithQuizResult(row, quizRow);
  });
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

async function syncEnrichedProfileRows(rows: Record<string, unknown>[]) {
  const enrichedRows = await enrichProfileRowsWithQuizResults(rows);
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

export async function syncSupabaseProfileByEmail(email: string) {
  const rows = await fetchSupabaseProfileRowsByEmails([email]);
  const matchingRow = rows.find((row) => readString(row.email) === email);

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
  const looksLikeQuizResult = ["answers", "image_url", "image_url_left", "image_url_right", "gender"].some(
    (key) => key in row
  );

  if (looksLikeQuizResult) {
    const profileId = readString(row.user_id) ?? readString(row.profile_id) ?? readString(row.id);
    const email = readString(row.email);

    if (profileId) {
      const syncedProfile = await syncSupabaseProfileByExternalId(profileId);
      if (syncedProfile) {
        return syncedProfile;
      }
    }

    if (email) {
      const syncedProfile = await syncSupabaseProfileByEmail(email);
      if (syncedProfile) {
        return syncedProfile;
      }
    }

    throw new Error("Could not find matching users row for quiz_results webhook payload");
  }

  const [enrichedRow] = await enrichProfileRowsWithQuizResults([row]);
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
