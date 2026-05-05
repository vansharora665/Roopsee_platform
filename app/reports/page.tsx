import Link from "next/link";

import { ReportsTable } from "@/components/reports/reports-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listReports } from "@/lib/report/report-service";
import type { ReportStatusDto } from "@/lib/report/types";

const statuses: Array<{ value: "all" | ReportStatusDto; label: string }> = [
  { value: "all", label: "All reports" },
  { value: "draft_generated", label: "Draft generated" },
  { value: "under_doctor_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "sent_to_user", label: "Sent to user" }
];

export default async function ReportsPage({
  searchParams
}: {
  searchParams: {
    status?: ReportStatusDto;
  };
}) {
  const selectedStatus = searchParams.status;
  const reports = await listReports(selectedStatus);

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-blue">
            Report dashboard
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Draft queue and doctor approvals
          </h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Review every intake draft created from Supabase or manual data, track doctor approvals,
            and generate the fixed patient PDF only after the doctor has signed off.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard">
            <Button variant="secondary">Business funnel</Button>
          </Link>
          <Link href="/notifications">
            <Button variant="secondary">Android notification</Button>
          </Link>
          <Link href="/follow-ups">
            <Button variant="secondary">Follow-ups</Button>
          </Link>
          <Link href="/reports/new">
            <Button>Create new intake</Button>
          </Link>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        {statuses.map((status) => {
          const active = (selectedStatus ?? "all") === status.value;

          return (
            <Link
              key={status.value}
              href={status.value === "all" ? "/reports" : `/reports?status=${status.value}`}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-brand-navy text-white"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {status.label}
            </Link>
          );
        })}
      </div>

      <ReportsTable reports={reports} />
    </div>
  );
}
