import { prisma } from "@/lib/db/prisma";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type SupabaseRow = Record<string, unknown>;

export type FunnelCustomerRow = {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  userId: string | null;
  quizResultId: string | null;
  signedIn: boolean;
  quizSubmitted: boolean;
  scansUploaded: boolean;
  draftGenerated: boolean;
  reportApproved: boolean;
  pdfGenerated: boolean;
  ordered: boolean;
  latestReportId: string | null;
  latestReportStatus: string | null;
  latestPdfUrl: string | null;
  lastActivityAt: string | null;
};

export type BusinessDashboardData = {
  summary: {
    signedIn: number;
    quizSubmitted: number;
    scansUploaded: number;
    draftGenerated: number;
    reportApproved: number;
    pdfGenerated: number;
    ordered: number;
  };
  customers: FunnelCustomerRow[];
  warnings: string[];
};

function dashboardUsersTable() {
  return process.env.SUPABASE_DASHBOARD_USERS_TABLE?.trim()
    || process.env.SUPABASE_USERS_TABLE?.trim()
    || "users";
}

function dashboardMasterTable() {
  return process.env.SUPABASE_DASHBOARD_MASTER_TABLE?.trim()
    || "master_user_quiz";
}

function dashboardQuizResultsTable() {
  return process.env.SUPABASE_DASHBOARD_QUIZ_RESULTS_TABLE?.trim()
    || process.env.SUPABASE_REPORTS_TABLE?.trim()
    || "quiz_results";
}

function dashboardOrdersTable() {
  return process.env.SUPABASE_DASHBOARD_ORDERS_TABLE?.trim()
    || process.env.SUPABASE_ORDERS_TABLE?.trim()
    || "orders";
}

function readString(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function readDateLike(value: unknown) {
  const raw = readString(value);
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function keyCandidates(row: SupabaseRow) {
  return Array.from(
    new Set(
      [
        readString(row.id),
        readString(row.user_id),
        readString(row.quiz_user_id),
        readString(row.quiz_result_id),
        readString(row.email),
        readString(row.phone_no),
        readString(row.phone)
      ].filter((value): value is string => Boolean(value))
    )
  );
}

function primaryKey(row: SupabaseRow) {
  return (
    readString(row.user_id)
    || readString(row.quiz_user_id)
    || readString(row.id)
    || readString(row.email)
    || readString(row.phone_no)
    || readString(row.phone)
    || null
  );
}

function extractQuizResultId(row: SupabaseRow) {
  return readString(row.quiz_result_id) || readString(row.id);
}

function extractUserId(row: SupabaseRow) {
  return readString(row.user_id) || readString(row.quiz_user_id) || readString(row.id);
}

function extractUserQuizCompletedAt(row: SupabaseRow) {
  if (!isRecord(row.skin_quiz)) {
    return null;
  }

  return readDateLike(row.skin_quiz.completed_at);
}

function hasUserQuiz(row: SupabaseRow) {
  return isRecord(row.skin_quiz) && (Boolean(row.skin_quiz.answers) || Boolean(row.skin_quiz.completed_at));
}

function hasScans(row: SupabaseRow) {
  return Boolean(readString(row.image_url) || readString(row.image_url_left) || readString(row.image_url_right));
}

function hasQuizResultReport(row: SupabaseRow) {
  return Boolean(readString(row.reports));
}

function latestDate(values: Array<string | null | undefined>) {
  const timestamps = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());

  return timestamps[0]?.toISOString() ?? null;
}

async function readSupabaseTable(table: string, limit = 1000) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from(table).select("*").limit(limit);

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return (data ?? []) as SupabaseRow[];
}

type LocalReportSnapshot = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  pdfUrl: string | null;
  keys: string[];
};

function uniqueCount(values: Array<string | null | undefined>) {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

export async function getBusinessDashboardData(): Promise<BusinessDashboardData> {
  const warnings: string[] = [];
  const [userRows, masterRows, quizResultRows, orderRows, localReportsRaw] = await Promise.all([
    readSupabaseTable(dashboardUsersTable()).catch((error: Error) => {
      warnings.push(error.message);
      return [] as SupabaseRow[];
    }),
    readSupabaseTable(dashboardMasterTable()).catch((error: Error) => {
      warnings.push(error.message);
      return [] as SupabaseRow[];
    }),
    readSupabaseTable(dashboardQuizResultsTable()).catch((error: Error) => {
      warnings.push(error.message);
      return [] as SupabaseRow[];
    }),
    readSupabaseTable(dashboardOrdersTable()).catch((error: Error) => {
      warnings.push(error.message);
      return [] as SupabaseRow[];
    }),
    prisma.report.findMany({
      include: {
        patientInfo: true,
        syncedProfile: true,
        generatedFile: true
      },
      orderBy: {
        createdAt: "desc"
      }
    })
  ]);

  const userRowsFiltered = userRows.filter((row) => {
    const role = readString(row.role);
    return !role || role.toLowerCase() === "user";
  });

  const localReports: LocalReportSnapshot[] = localReportsRaw.map((report) => {
    const profileJson = isRecord(report.syncedProfile?.profileJson)
      ? (report.syncedProfile?.profileJson as Record<string, unknown>)
      : {};

    const keys = Array.from(
      new Set(
        [
          report.syncedProfile?.externalId,
          report.syncedProfile?.email,
          report.patientInfo?.name,
          readString(profileJson.user_id),
          readString(profileJson.quiz_user_id),
          readString(profileJson.quiz_result_id),
          readString(profileJson.email)
        ].filter((value): value is string => Boolean(value))
      )
    );

    return {
      id: report.id,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      pdfUrl: report.generatedFile?.pdfUrl ?? null,
      keys
    };
  });

  const reportsByKey = new Map<string, LocalReportSnapshot[]>();
  for (const report of localReports) {
    for (const key of report.keys) {
      const existing = reportsByKey.get(key) ?? [];
      existing.push(report);
      reportsByKey.set(key, existing);
    }
  }

  const quizResultsByKey = new Map<string, SupabaseRow>();
  for (const row of quizResultRows) {
    for (const key of keyCandidates(row)) {
      quizResultsByKey.set(key, row);
    }
  }

  const ordersByKey = new Map<string, SupabaseRow[]>();
  for (const row of orderRows) {
    for (const key of keyCandidates(row)) {
      const existing = ordersByKey.get(key) ?? [];
      existing.push(row);
      ordersByKey.set(key, existing);
    }
  }

  const customers = new Map<string, FunnelCustomerRow>();

  function mergeCustomer(seedKey: string, partial: Partial<FunnelCustomerRow>) {
    const existing = customers.get(seedKey);
    const next: FunnelCustomerRow = {
      key: seedKey,
      name: partial.name ?? existing?.name ?? "Unnamed customer",
      email: partial.email ?? existing?.email ?? null,
      phone: partial.phone ?? existing?.phone ?? null,
      userId: partial.userId ?? existing?.userId ?? null,
      quizResultId: partial.quizResultId ?? existing?.quizResultId ?? null,
      signedIn: Boolean(partial.signedIn || existing?.signedIn),
      quizSubmitted: Boolean(partial.quizSubmitted || existing?.quizSubmitted),
      scansUploaded: Boolean(partial.scansUploaded || existing?.scansUploaded),
      draftGenerated: Boolean(partial.draftGenerated || existing?.draftGenerated),
      reportApproved: Boolean(partial.reportApproved || existing?.reportApproved),
      pdfGenerated: Boolean(partial.pdfGenerated || existing?.pdfGenerated),
      ordered: Boolean(partial.ordered || existing?.ordered),
      latestReportId: partial.latestReportId ?? existing?.latestReportId ?? null,
      latestReportStatus: partial.latestReportStatus ?? existing?.latestReportStatus ?? null,
      latestPdfUrl: partial.latestPdfUrl ?? existing?.latestPdfUrl ?? null,
      lastActivityAt: latestDate([partial.lastActivityAt, existing?.lastActivityAt])
    };

    customers.set(seedKey, next);
  }

  function relatedKeyList(row: SupabaseRow) {
    return Array.from(new Set([...keyCandidates(row), extractUserId(row), extractQuizResultId(row)].filter((value): value is string => Boolean(value))));
  }

  function attachSupabaseRow(row: SupabaseRow, source: "users" | "master" | "quiz_results" | "orders") {
    const keys = relatedKeyList(row);
    const seedKey = primaryKey(row);
    if (!seedKey) {
      return;
    }

    const linkedReports = keys.flatMap((key) => reportsByKey.get(key) ?? []);
    const latestReport = linkedReports.sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] ?? null;
    const linkedQuizResult = keys.map((key) => quizResultsByKey.get(key)).find(Boolean) ?? null;
    const linkedOrders = keys.flatMap((key) => ordersByKey.get(key) ?? []);

    mergeCustomer(seedKey, {
      name: readString(row.name) ?? readString(row.full_name) ?? undefined,
      email: readString(row.email),
      phone: readString(row.phone_no) ?? readString(row.phone),
      userId: extractUserId(row),
      quizResultId: extractQuizResultId(row),
      signedIn: source === "users",
      quizSubmitted:
        source === "master"
        || source === "quiz_results"
        || (source === "users" && hasUserQuiz(row))
        || Boolean(linkedQuizResult),
      scansUploaded:
        hasScans(row)
        || Boolean(linkedQuizResult && hasScans(linkedQuizResult)),
      draftGenerated: linkedReports.length > 0,
      reportApproved: linkedReports.some((report) => report.status === "approved" || report.status === "sent_to_user"),
      pdfGenerated:
        linkedReports.some((report) => Boolean(report.pdfUrl))
        || Boolean(linkedQuizResult && hasQuizResultReport(linkedQuizResult)),
      ordered: source === "orders" || linkedOrders.length > 0,
      latestReportId: latestReport?.id ?? null,
      latestReportStatus: latestReport?.status ?? null,
      latestPdfUrl: latestReport?.pdfUrl ?? (linkedQuizResult ? readString(linkedQuizResult.reports) : null) ?? null,
      lastActivityAt: latestDate([
        latestReport?.updatedAt,
        readDateLike(row.updated_at),
        readDateLike(row.created_at),
        readDateLike(row.completed_at),
        source === "users" ? extractUserQuizCompletedAt(row) : null,
        linkedQuizResult ? readDateLike(linkedQuizResult.completed_at) : null,
        linkedOrders[0] ? readDateLike(linkedOrders[0].created_at) : null
      ])
    });
  }

  for (const row of userRowsFiltered) {
    attachSupabaseRow(row, "users");
  }

  for (const row of masterRows) {
    attachSupabaseRow(row, "master");
  }

  for (const row of quizResultRows) {
    attachSupabaseRow(row, "quiz_results");
  }

  for (const row of orderRows) {
    attachSupabaseRow(row, "orders");
  }

  for (const report of localReports) {
    const key = report.keys[0];
    if (!key) {
      continue;
    }

    mergeCustomer(key, {
      draftGenerated: true,
      reportApproved: report.status === "approved" || report.status === "sent_to_user",
      pdfGenerated: Boolean(report.pdfUrl),
      latestReportId: report.id,
      latestReportStatus: report.status,
      latestPdfUrl: report.pdfUrl,
      lastActivityAt: report.updatedAt
    });
  }

  const customerRows = Array.from(customers.values()).sort((left, right) => {
    const leftTime = left.lastActivityAt ? new Date(left.lastActivityAt).getTime() : 0;
    const rightTime = right.lastActivityAt ? new Date(right.lastActivityAt).getTime() : 0;
    return rightTime - leftTime;
  });

  return {
    summary: {
      signedIn: uniqueCount(userRowsFiltered.map((row) => extractUserId(row) || readString(row.email))),
      quizSubmitted: uniqueCount([
        ...masterRows.map((row) => extractQuizResultId(row) || extractUserId(row) || readString(row.email)),
        ...quizResultRows.map((row) => extractQuizResultId(row) || extractUserId(row) || readString(row.email)),
        ...userRowsFiltered.filter(hasUserQuiz).map((row) => extractUserId(row) || readString(row.email))
      ]),
      scansUploaded: uniqueCount([
        ...masterRows.filter(hasScans).map((row) => extractQuizResultId(row) || extractUserId(row) || readString(row.email)),
        ...quizResultRows.filter(hasScans).map((row) => extractQuizResultId(row) || extractUserId(row) || readString(row.email))
      ]),
      draftGenerated: uniqueCount(localReports.map((report) => report.keys[0])),
      reportApproved: uniqueCount(
        localReports
          .filter((report) => report.status === "approved" || report.status === "sent_to_user")
          .map((report) => report.keys[0])
      ),
      pdfGenerated: uniqueCount([
        ...localReports.filter((report) => Boolean(report.pdfUrl)).map((report) => report.keys[0]),
        ...quizResultRows.filter(hasQuizResultReport).map((row) => extractQuizResultId(row) || extractUserId(row) || readString(row.email))
      ]),
      ordered: uniqueCount(orderRows.map((row) => extractUserId(row) || readString(row.email)))
    },
    customers: customerRows,
    warnings
  };
}
