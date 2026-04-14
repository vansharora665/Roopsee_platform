import Link from "next/link";

import { CreateFollowUpButton } from "@/components/follow-ups/create-follow-up-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listFollowUpCustomers } from "@/lib/report/follow-up-service";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const customers = await listFollowUpCustomers();

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-blue">
            Follow-up reports
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            Previous products and repeat review
          </h1>
          <p className="max-w-3xl text-sm text-slate-600">
            Create a follow-up without AI. The new draft copies the last report&apos;s analysis,
            routine, and suggested products so the doctor can only adjust what changed.
          </p>
        </div>
        <Link href="/reports">
          <Button variant="secondary">Back to reports</Button>
        </Link>
      </Card>

      <div className="grid gap-5">
        {customers.map((customer) => {
          const canCreate = customer.reports.length > 0;

          return (
            <Card key={customer.profile.id} className="space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {customer.profile.fullName ?? "Unnamed customer"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {[customer.profile.email, customer.profile.phone].filter(Boolean).join(" · ") || "No contact stored"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {customer.profile.sex ?? "Sex not set"}
                    {customer.profile.age ? ` · ${customer.profile.age} years` : ""} · synced{" "}
                    {formatDate(customer.profile.lastSyncedAt, "dd MMM yyyy, p")}
                  </p>
                </div>
                <CreateFollowUpButton syncedProfileId={customer.profile.id} disabled={!canCreate} />
              </div>

              {!canCreate ? (
                <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  No previous Roopsee report exists yet. Create the first report from intake before
                  starting a follow-up.
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Last suggested products
                  </h3>
                  <div className="mt-3 space-y-2">
                    {customer.latestProducts.length > 0 ? (
                      customer.latestProducts.map((product, index) => (
                        <div key={`${product.title}-${index}`} className="rounded-xl bg-white p-3 text-sm">
                          <span className="font-semibold text-slate-900">{product.title}: </span>
                          <span className="text-slate-700">
                            {[product.brand, product.productName].filter(Boolean).join(" - ") || "Product not set"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No product rows found in the last report.</p>
                    )}
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Previous report</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">PDF</th>
                        <th className="px-4 py-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {customer.reports.map((report) => (
                        <tr key={report.id}>
                          <td className="px-4 py-3">{formatDate(report.createdAt, "dd MMM yyyy")}</td>
                          <td className="px-4 py-3">
                            <Badge status={report.status as Parameters<typeof Badge>[0]["status"]}>
                              {report.status.replaceAll("_", " ")}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {report.pdfUrl ? (
                              <a className="font-semibold text-brand-blue" href={report.pdfUrl} target="_blank">
                                Open PDF
                              </a>
                            ) : (
                              <span className="text-slate-400">Not generated</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/reports/${report.id}`} className="font-semibold text-brand-navy">
                              Open
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
