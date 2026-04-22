import Link from "next/link";

import { CreateFollowUpButton } from "@/components/follow-ups/create-follow-up-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listFollowUpCustomers } from "@/lib/report/follow-up-service";
import { listProductCatalog } from "@/lib/report/report-service";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const [customers, productCatalog] = await Promise.all([
    listFollowUpCustomers(),
    listProductCatalog()
  ]);

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
            Create a follow-up without AI. Pick from previous reports, edit the suggested products,
            add new products if needed, and generate a new editable report draft.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard">
            <Button variant="secondary">Funnel</Button>
          </Link>
          <Link href="/notifications">
            <Button variant="secondary">Notifications</Button>
          </Link>
          <Link href="/reports">
            <Button variant="secondary">Back to reports</Button>
          </Link>
        </div>
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
                  <p className="text-sm text-slate-500">Previous reports and editable product continuation only.</p>
                </div>
              </div>

              {!canCreate ? (
                <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  No previous Roopsee report exists yet. Create the first report from intake before
                  starting a follow-up.
                </div>
              ) : null}

              <div className="grid gap-4">
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Previous report</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Suggested products</th>
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
                            <div className="max-w-xl space-y-1">
                              {report.products.length > 0 ? report.products.map((product) => (
                                <p key={product.id} className="text-xs text-slate-600">
                                  <span className="font-semibold text-slate-900">{product.title}: </span>
                                  {[product.brand, product.productName].filter(Boolean).join(" - ") || "Product not set"}
                                </p>
                              )) : <span className="text-slate-400">No products</span>}
                            </div>
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

                <div className="rounded-2xl bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Edit products for follow-up
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Starts with the latest suggested products. Doctor can remove, change, or add products before creating the draft.
                  </p>
                  <div className="mt-4">
                    <CreateFollowUpButton
                      syncedProfileId={customer.profile.id}
                      disabled={!canCreate}
                      initialProductRows={customer.latestProducts}
                      productCatalog={productCatalog}
                    />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
