import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getBusinessDashboardData } from "@/lib/business/dashboard-service";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const funnelSteps = [
  { key: "signedIn", label: "Signed in" },
  { key: "quizSubmitted", label: "Quiz submitted" },
  { key: "scansUploaded", label: "Scans uploaded" },
  { key: "draftGenerated", label: "Draft generated" },
  { key: "reportApproved", label: "Approved" },
  { key: "pdfGenerated", label: "PDF ready" },
  { key: "ordered", label: "Ordered" }
] as const;

function YesNo({ value }: { value: boolean }) {
  return (
    <span className={value ? "font-semibold text-emerald-700" : "text-slate-300"}>
      {value ? "Yes" : "No"}
    </span>
  );
}

export default async function BusinessDashboardPage() {
  const dashboard = await getBusinessDashboardData();
  const total = Math.max(dashboard.summary.signedIn, 1);

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-blue">
            Business funnel
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Customers, scans, reports, and orders
          </h1>
          <p className="max-w-3xl text-sm text-slate-600">
            This view combines Supabase customers, master quiz/scans, Roopsee reports, public PDFs,
            and orders so the team can quickly see where each customer is in the funnel.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/follow-ups">
            <Button variant="secondary">Follow-ups</Button>
          </Link>
          <Link href="/reports/new">
            <Button>Create report</Button>
          </Link>
        </div>
      </Card>

      {dashboard.warnings.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900">
          <p className="font-semibold">Some Supabase tables could not be read:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {dashboard.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        {funnelSteps.map((step) => {
          const value = dashboard.summary[step.key];
          const percentage = Math.round((value / total) * 100);

          return (
            <Card key={step.key} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {step.label}
              </p>
              <div className="text-3xl font-semibold text-slate-900">{value}</div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-brand-blue" style={{ width: `${Math.min(percentage, 100)}%` }} />
              </div>
              <p className="text-xs text-slate-500">{percentage}% of sign-ins</p>
            </Card>
          );
        })}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-xl font-semibold text-slate-900">Customer funnel table</h2>
          <p className="text-sm text-slate-500">
            Sorted by latest local or Supabase activity. Open a report when it exists, or use the
            follow-up page for repeat visits.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Quiz</th>
                <th className="px-4 py-3 font-semibold">Scans</th>
                <th className="px-4 py-3 font-semibold">Draft</th>
                <th className="px-4 py-3 font-semibold">Approved</th>
                <th className="px-4 py-3 font-semibold">PDF</th>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Latest report</th>
                <th className="px-4 py-3 font-semibold">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {dashboard.customers.map((customer) => (
                <tr key={customer.key}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-semibold text-slate-900">{customer.name}</div>
                    <div className="text-xs text-slate-500">
                      {[customer.email, customer.phone].filter(Boolean).join(" · ") || "No contact"}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top"><YesNo value={customer.quizSubmitted} /></td>
                  <td className="px-4 py-3 align-top"><YesNo value={customer.scansUploaded} /></td>
                  <td className="px-4 py-3 align-top"><YesNo value={customer.draftGenerated} /></td>
                  <td className="px-4 py-3 align-top"><YesNo value={customer.reportApproved} /></td>
                  <td className="px-4 py-3 align-top">
                    {customer.latestPdfUrl ? (
                      <a className="font-semibold text-brand-blue" href={customer.latestPdfUrl} target="_blank">
                        Open
                      </a>
                    ) : (
                      <YesNo value={false} />
                    )}
                  </td>
                  <td className="px-4 py-3 align-top"><YesNo value={customer.ordered} /></td>
                  <td className="px-4 py-3 align-top">
                    {customer.latestReportId ? (
                      <div className="space-y-2">
                        <Badge>{customer.latestReportStatus?.replaceAll("_", " ") ?? "report"}</Badge>
                        <div>
                          <Link href={`/reports/${customer.latestReportId}`} className="font-semibold text-brand-navy">
                            Open report
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">No local report</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-slate-600">
                    {customer.lastActivityAt ? formatDate(customer.lastActivityAt, "dd MMM yyyy, p") : "Not tracked"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
