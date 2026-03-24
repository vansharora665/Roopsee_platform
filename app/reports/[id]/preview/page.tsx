import Link from "next/link";
import { notFound } from "next/navigation";

import { ReportDocument } from "@/components/reports/report-document";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getReportById } from "@/lib/report/report-service";
import { reportTemplateStyles } from "@/lib/report/template-styles";

export default async function ReportPreviewPage({
  params
}: {
  params: {
    id: string;
  };
}) {
  let report;

  try {
    report = await getReportById(params.id);
  } catch (error) {
    if (error instanceof Error && error.message === "Report not found") {
      notFound();
    }

    throw error;
  }

  return (
    <div className="space-y-6">
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-blue">
            Final report preview
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">Doctor-style fixed layout</h1>
        </div>
        <div className="flex gap-3">
          <Link href={`/reports/${report.id}`}>
            <Button variant="secondary">Back to report</Button>
          </Link>
          {report.generatedFile?.pdfUrl ? (
            <Link href={report.generatedFile.pdfUrl} target="_blank">
              <Button variant="secondary">Download PDF</Button>
            </Link>
          ) : null}
        </div>
      </Card>

      <Card className="overflow-x-auto bg-slate-100 p-4">
        <style dangerouslySetInnerHTML={{ __html: reportTemplateStyles }} />
        <ReportDocument report={report} />
      </Card>
    </div>
  );
}
