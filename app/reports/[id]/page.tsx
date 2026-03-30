import Link from "next/link";
import { notFound } from "next/navigation";

import { DoctorReviewForm } from "@/components/doctor/doctor-review-form";
import { AnalysisSummary } from "@/components/reports/analysis-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getReportById, listProductCatalog } from "@/lib/report/report-service";
import { formatDate } from "@/lib/utils";

export default async function ReportDetailPage({
  params
}: {
  params: {
    id: string;
  };
}) {
  let report: Awaited<ReturnType<typeof getReportById>>;
  let productCatalog: Awaited<ReturnType<typeof listProductCatalog>>;

  try {
    [report, productCatalog] = await Promise.all([
      getReportById(params.id),
      listProductCatalog()
    ]);
  } catch (error) {
    if (error instanceof Error && error.message === "Report not found") {
      notFound();
    }

    throw error;
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Link href="/reports" className="text-sm font-medium text-brand-blue">
            Back to reports
          </Link>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
            {report.patientInfo.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <Badge status={report.status}>{report.status.replaceAll("_", " ")}</Badge>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
              {report.intakeSource}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
              {report.promptInputMode.replaceAll("_", " ")}
            </span>
            <span className="text-sm text-slate-500">Report ID: {report.id}</span>
          </div>
          <p className="text-sm text-slate-600">
            Created {formatDate(report.createdAt)}. Updated {formatDate(report.updatedAt)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/reports/${report.id}/preview`} target="_blank">
            <Button variant="secondary">Open preview</Button>
          </Link>
          {report.generatedFile?.pdfUrl ? (
            <Link href={report.generatedFile.pdfUrl} target="_blank">
              <Button variant="secondary">Download generated PDF</Button>
            </Link>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="space-y-2 xl:col-span-1">
          <p className="text-sm text-slate-500">Report date</p>
          <p className="text-lg font-semibold text-slate-900">
            {formatDate(report.patientInfo.reportDate)}
          </p>
        </Card>
        <Card className="space-y-2 xl:col-span-1">
          <p className="text-sm text-slate-500">Approved at</p>
          <p className="text-lg font-semibold text-slate-900">
            {report.approvedAt ? formatDate(report.approvedAt) : "Not approved yet"}
          </p>
        </Card>
        <Card className="space-y-2 xl:col-span-1">
          <p className="text-sm text-slate-500">Synced profile</p>
          <p className="text-lg font-semibold text-slate-900">
            {report.syncedProfile?.externalId ?? "Manual case"}
          </p>
        </Card>
        <Card className="space-y-2 xl:col-span-1">
          <p className="text-sm text-slate-500">Prompt session</p>
          <p className="text-lg font-semibold text-slate-900">
            {report.promptSession ? "Stored" : "Not captured"}
          </p>
        </Card>
      </div>

      <AnalysisSummary report={report} />
      <DoctorReviewForm report={report} productCatalog={productCatalog} />
    </div>
  );
}
