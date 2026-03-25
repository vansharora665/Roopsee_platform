import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { renderReportHtml } from "@/lib/report/render-report-html";
import type { ReportDetailDto } from "@/lib/report/types";
import { getGeneratedReportsDir } from "@/lib/storage/files";

export async function generateReportPdf(report: ReportDetailDto) {
  if (!["approved", "sent_to_user"].includes(report.status)) {
    throw new Error("Report must be approved before generating the final PDF");
  }

  const outputDir = getGeneratedReportsDir();
  await mkdir(outputDir, { recursive: true });

  const fileBase = `${report.id}-${Date.now()}`;
  const htmlFileName = `${fileBase}.html`;
  const pdfFileName = `${fileBase}.pdf`;
  const htmlPath = path.join(outputDir, htmlFileName);
  const pdfPath = path.join(outputDir, pdfFileName);
  const html = renderReportHtml(report);

  await writeFile(htmlPath, html, "utf8");

  const puppeteer = await import("puppeteer");
  const chromiumArgs = process.getuid?.() === 0 ? ["--no-sandbox", "--disable-setuid-sandbox"] : [];
  const browser = await puppeteer.default.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: chromiumArgs
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 794,
      height: 1122,
      deviceScaleFactor: 1
    });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("print");
    await page.pdf({
      path: pdfPath,
      width: "210mm",
      height: "297mm",
      printBackground: true,
      scale: 1,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0"
      }
    });
  } finally {
    await browser.close();
  }

  return {
    pdfUrl: `/generated/reports/${pdfFileName}`,
    htmlSnapshotPath: htmlPath
  };
}
