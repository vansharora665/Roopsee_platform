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

function tableName(envName: string, fallback: string) {
  return process.env[envName]?.trim() || fallback;
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

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString();
}

function recordKey(row: SupabaseRow) {
  return (
    readString(row.user_id) ||
    readString(row.quiz_user_id) ||
    readString(row.id) ||
    readString(row.email) ||
    readString(row.phone_no) ||
    null
  );
}

function quizResultId(row: SupabaseRow) {
  return readString(row.quiz_result_id) || readString(row.id);
}

function hasScan(row: SupabaseRow) {
  return Boolean(readString(row.image_url) || readString(row.image_url_left) || readString(row.image_url_right));
}

function hasReportUrl(row: SupabaseRow) {
  return Boolean(readString(row.reports));
}

function latestDate(values: Array<string | null | undefined>) {
  const dated = values
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  return dated[0]?.toISOString() ?? null;
}

async function readSupabaseTable(table: string, limit = 1000) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from(table).select("*").limit(limit);

  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }

  return (data ?? []) as SupabaseRow[];
}

export async function getBusinessDashboardData(): Promise<BusinessDashboardData> {
  const warnings: string[] = [];
  const masterTable = tableName("SUPABASE_PROFILES_TABLE", "master_user_quiz");
  const usersTable = tableName("SUPABASE_USERS_TABLE", "users");
  const quizResultsTable = tableName("SUPABASE_REPORTS_TABLE", "quiz_results");
  const ordersTable = tableName("SUPABASE_ORDERS_TABLE", "orders");

  const [masterRows, userRows, quizResultRows, orderRows, reports] = await Promise.all([
    readSupabaseTable(masterTable).catch((error: Error) => {
      warnings.push(error.message);
      return [] as SupabaseRow[];
    }),
    readSupabaseTable(usersTable).catch((error: Error) => {
      warnings.push(error.message);
      return [] as SupabaseRow[];
    }),
    readSupabaseTable(quizResultsTable).catch((error: Error) => {
      warnings.push(error.message);
      return [] as SupabaseRow[];
    }),
    readSupabaseTable(ordersTable).catch((error: Error) => {
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

  const quizRowsById = new Map<string, SupabaseRow>();
  for (const row of quizResultRows) {
    const key = recordKey(row);
    const resultId = quizResultId(row);

    if (key) {
      quizRowsById.set(key, row);
    }

    if (resultId) {
      quizRowsById.set(resultId, row);
    }
  }

  const userRowsByKey = new Map<string, SupabaseRow>();
  for (const row of userRows) {
    const key = recordKey(row);
    const email = readString(row.email);

    if (key) {
      userRowsByKey.set(key, row);
    }

    if (email) {
      userRowsByKey.set(email, row);
    }
  }

  const ordersByKey = new Set<string>();
  for (const row of orderRows) {
    for (const value of [recordKey(row), readString(row.user_id), readString(row.userId), readString(row.email)]) {
      if (value) {
        ordersByKey.add(value);
      }
    }
  }

  const localReportsByKey = new Map<string, typeof reports>();
  for (const report of reports) {
    const keys = [
      report.syncedProfile?.externalId,
      report.syncedProfile?.email,
      report.patientInfo?.name
    ].filter((value): value is string => Boolean(value));

    for (const key of keys) {
      const existing = localReportsByKey.get(key) ?? [];
      existing.push(report);
      localReportsByKey.set(key, existing);
    }
  }

  const customerRows = new Map<string, FunnelCustomerRow>();

  function upsertCustomer(row: SupabaseRow, source: "master" | "user") {
    const key = recordKey(row) || readString(row.email) || readString(row.name);
    if (!key) {
      return;
    }

    const email = readString(row.email);
    const userId = readString(row.user_id) || readString(row.quiz_user_id) || (source === "user" ? readString(row.id) : null);
    const resultId = quizResultId(row);
    const linkedQuizRow = resultId ? quizRowsById.get(resultId) : userId ? quizRowsById.get(userId) : null;
    const localReports = [
      ...(localReportsByKey.get(resultId ?? "") ?? []),
      ...(localReportsByKey.get(userId ?? "") ?? []),
      ...(localReportsByKey.get(email ?? "") ?? [])
    ];
    const latestReport = localReports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
    const existing = customerRows.get(key);

    customerRows.set(key, {
      key,
      name: readString(row.name) || readString(row.full_name) || existing?.name || "Unnamed customer",
      email: email ?? existing?.email ?? null,
      phone: readString(row.phone_no) ?? readString(row.phone) ?? existing?.phone ?? null,
      userId: userId ?? existing?.userId ?? null,
      quizResultId: resultId ?? existing?.quizResultId ?? null,
      signedIn: existing?.signedIn || source === "user" || Boolean(userId || email),
      quizSubmitted: existing?.quizSubmitted || source === "master" || Boolean(row.answers || linkedQuizRow),
      scansUploaded: existing?.scansUploaded || hasScan(row),
      draftGenerated: existing?.draftGenerated || localReports.length > 0,
      reportApproved: existing?.reportApproved || localReports.some((report) => report.status === "approved" || report.status === "sent_to_user"),
      pdfGenerated: existing?.pdfGenerated || localReports.some((report) => Boolean(report.generatedFile?.pdfUrl)) || Boolean(linkedQuizRow && hasReportUrl(linkedQuizRow)),
      ordered: existing?.ordered || [key, userId, email].some((value) => Boolean(value && ordersByKey.has(value))),
      latestReportId: latestReport?.id ?? existing?.latestReportId ?? null,
      latestReportStatus: latestReport?.status ?? existing?.latestReportStatus ?? null,
      latestPdfUrl: latestReport?.generatedFile?.pdfUrl ?? (linkedQuizRow ? readString(linkedQuizRow.reports) : null) ?? existing?.latestPdfUrl ?? null,
      lastActivityAt: latestDate([
        latestReport?.updatedAt.toISOString(),
        readDateLike(row.updated_at),
        readDateLike(row.completed_at),
        existing?.lastActivityAt
      ])
    });
  }

  for (const row of userRows) {
    upsertCustomer(row, "user");
  }

  for (const row of masterRows) {
    upsertCustomer(row, "master");
  }

  const customers = Array.from(customerRows.values()).sort((a, b) => {
    const aDate = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const bDate = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    return bDate - aDate;
  });

  return {
    summary: {
      signedIn: customers.filter((customer) => customer.signedIn).length,
      quizSubmitted: customers.filter((customer) => customer.quizSubmitted).length,
      scansUploaded: customers.filter((customer) => customer.scansUploaded).length,
      draftGenerated: customers.filter((customer) => customer.draftGenerated).length,
      reportApproved: customers.filter((customer) => customer.reportApproved).length,
      pdfGenerated: customers.filter((customer) => customer.pdfGenerated).length,
      ordered: customers.filter((customer) => customer.ordered).length
    },
    customers,
    warnings
  };
}
