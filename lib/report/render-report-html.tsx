import { renderToStaticMarkup } from "react-dom/server";

import { ReportDocument } from "@/components/reports/report-document";
import { reportTemplateStyles } from "@/lib/report/template-styles";
import type { ReportDetailDto } from "@/lib/report/types";

export function renderReportHtml(report: ReportDetailDto) {
  const body = renderToStaticMarkup(<ReportDocument report={report} />);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Roopsee Report ${report.id}</title>
    <style>${reportTemplateStyles}</style>
  </head>
  <body>${body}</body>
</html>`;
}
