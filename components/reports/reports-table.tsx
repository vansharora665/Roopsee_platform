import Link from "next/link";

import { DeleteReportButton } from "@/components/reports/delete-report-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { formatSkinScore } from "@/lib/report/score";
import type { ReportListItemDto } from "@/lib/report/types";

export function ReportsTable({ reports }: { reports: ReportListItemDto[] }) {
  if (reports.length === 0) {
    return (
      <Card className="text-center">
        <h3 className="text-lg font-semibold text-slate-900">No reports found</h3>
        <p className="mt-2 text-sm text-slate-600">
          Create a new intake draft to start the prompt, doctor review, and PDF workflow.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-5 py-4 font-semibold">Patient</th>
              <th className="px-5 py-4 font-semibold">Source</th>
              <th className="px-5 py-4 font-semibold">Status</th>
              <th className="px-5 py-4 font-semibold">Skin score</th>
              <th className="px-5 py-4 font-semibold">Profile</th>
              <th className="px-5 py-4 font-semibold">Date</th>
              <th className="px-5 py-4 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {reports.map((report) => (
              <tr key={report.id}>
                <td className="px-5 py-4 align-top">
                  <div className="font-semibold text-slate-900">{report.patientInfo.name}</div>
                  <div className="text-slate-500">
                    {report.patientInfo.sex}, {report.patientInfo.age} years
                  </div>
                </td>
                <td className="px-5 py-4 align-top">
                  <div className="font-semibold capitalize text-slate-900">{report.intakeSource}</div>
                  <div className="text-slate-500">{report.promptInputMode.replaceAll("_", " ")}</div>
                </td>
                <td className="px-5 py-4 align-top">
                  <Badge status={report.status}>{report.status.replaceAll("_", " ")}</Badge>
                </td>
                <td className="px-5 py-4 align-top">
                  <div className="font-semibold text-slate-900">{formatSkinScore(report.analysisOutput.skinScore)}/10</div>
                  <div className="text-slate-500">{report.analysisOutput.skinScoreLabel}</div>
                </td>
                <td className="px-5 py-4 align-top">
                  <div className="font-medium text-slate-900">{report.analysisOutput.skinType}</div>
                  <div className="text-slate-500">{report.analysisOutput.overallSeverity}</div>
                </td>
                <td className="px-5 py-4 align-top">
                  <div>{formatDate(report.patientInfo.reportDate)}</div>
                  <div className="text-slate-500">Created {formatDate(report.createdAt)}</div>
                </td>
                <td className="px-5 py-4 align-top">
                  <div className="flex flex-wrap items-start gap-2">
                    <Link href={`/reports/${report.id}`}>
                      <Button variant="secondary" className="whitespace-nowrap">
                        Open report
                      </Button>
                    </Link>
                    <DeleteReportButton reportId={report.id} patientName={report.patientInfo.name} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
