import { formatDate } from "@/lib/utils";
import { reportTemplateStyles } from "@/lib/report/template-styles";
import { getActiveScorePoint, getSkinScoreSummary } from "@/lib/report/score";
import type { ReportDetailDto, RoutineItem } from "@/lib/report/types";

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderPlaceholder(text: string) {
  return `<span class="placeholder">${escapeHtml(text)}</span>`;
}

function renderProductLine(
  label: string,
  brand?: string | null,
  company?: string | null,
  product?: string | null
) {
  const parts = [brand, company, product].filter(Boolean).map((part) => escapeHtml(part));
  const value = parts.length > 0 ? parts.join(" - ") : renderPlaceholder("To be completed by doctor");

  return `<div class="product-item"><strong>${escapeHtml(label)}</strong> ${value}</div>`;
}

function renderRoutine(items: RoutineItem[]) {
  if (!items.length) {
    return renderPlaceholder("Doctor has not added this routine yet.");
  }

  return `<ol class="routine-list">${items
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.step)}</strong> - ${escapeHtml(item.usageAmount)}</li>`
    )
    .join("")}</ol>`;
}

function renderStringList(items: string[], emptyText: string) {
  if (!items.length) {
    return renderPlaceholder(emptyText);
  }

  return `<ul class="meta-list">${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

function renderImageSlot(image: string | null | undefined, index: number) {
  if (image) {
    return `<div class="image-slot"><img src="${escapeHtml(image)}" alt="Facial input ${index + 1}" /></div>`;
  }

  return `<div class="image-slot"><div class="image-placeholder">Facial Image ${index + 1}</div></div>`;
}

function renderScoreLine(score: number) {
  const activeScorePoint = getActiveScorePoint(score);

  return Array.from({ length: 10 }, (_, index) => {
    const value = index + 1;
    const classes = value === activeScorePoint ? "score-point active" : "score-point";

    return `<div class="${classes}"><span>${value}</span></div>`;
  }).join("");
}

function renderVerifiedStamp(report: ReportDetailDto) {
  if (!["approved", "sent_to_user"].includes(report.status)) {
    return "";
  }

  const approver = report.approvedBy?.name ? `Approved by ${escapeHtml(report.approvedBy.name)}` : "Approved report";
  const approvedDate = escapeHtml(report.approvedAt ? formatDate(report.approvedAt) : formatDate(report.updatedAt));

  return `
    <div class="verified-stamp">
      <div class="verified-stamp-title">Doctor Verified</div>
      <div class="verified-stamp-subtitle">${approver}</div>
      <div class="verified-stamp-date">${approvedDate}</div>
    </div>
  `;
}

export function renderReportHtml(report: ReportDetailDto) {
  const inputSources = report.patientInfo.inputSources.length
    ? report.patientInfo.inputSources.map((item) => escapeHtml(item)).join(" + ")
    : "Not provided";

  const body = `
    <div class="report-root">
      <section class="report-page">
        <div class="title-wrap">
          <h1 class="title">Skin Analysis Report</h1>
          ${renderVerifiedStamp(report)}
        </div>

        <div class="top-grid">
          <div class="pill">
            <div class="pill-label">Name</div>
            <div class="pill-value">${escapeHtml(report.patientInfo.name)}</div>
          </div>
          <div class="pill">
            <div class="pill-label">Sex</div>
            <div class="pill-value">${escapeHtml(report.patientInfo.sex)}</div>
          </div>
          <div class="pill">
            <div class="pill-label">Age</div>
            <div class="pill-value">${escapeHtml(report.patientInfo.age)} years</div>
          </div>
          <div class="pill">
            <div class="pill-label">Date</div>
            <div class="pill-value">${escapeHtml(formatDate(report.patientInfo.reportDate))}</div>
          </div>
          <div class="pill" style="grid-column: 2 / 4">
            <div class="pill-label">Input Sources</div>
            <div class="pill-value">${inputSources}</div>
          </div>
        </div>

        <div class="images">
          ${[report.assets.image1Url, report.assets.image2Url, report.assets.image3Url]
            .map((image, index) => renderImageSlot(image, index))
            .join("")}
        </div>

        <div class="score-wrap">
          <div class="score-label">${escapeHtml(getSkinScoreSummary(report.analysisOutput.skinScore))}</div>
          <div class="score-line">${renderScoreLine(report.analysisOutput.skinScore)}</div>
          <div class="score-bands">
            <div class="severe">Severe</div>
            <div class="concerning">Concerning</div>
            <div class="moderate">Moderate</div>
            <div class="good">Good</div>
            <div class="excellent">Excellent</div>
          </div>
        </div>

        <div class="panel-grid">
          <div class="section-box">
            <div class="section-header blue">Overall Skin Profile</div>
            <div class="section-content">
              <p><strong>Skin Type:</strong> ${escapeHtml(report.analysisOutput.skinType)}</p>
              <p><strong>Condition:</strong> ${escapeHtml(report.analysisOutput.condition)}</p>
              <p><strong>Overall Severity:</strong> ${escapeHtml(report.analysisOutput.overallSeverity)}</p>
            </div>
          </div>

          <div class="section-box">
            <div class="section-header coral">Key Skin Concerns</div>
            <div class="section-content">
              <div class="columns">
                <div>
                  <p><strong>Primary:</strong></p>
                  ${renderStringList(report.analysisOutput.primaryConcerns, "No primary concerns")}
                </div>
                <div>
                  <p><strong>Secondary:</strong></p>
                  ${renderStringList(report.analysisOutput.secondaryConcerns, "No secondary concerns")}
                </div>
              </div>
            </div>
          </div>

          <div class="section-box">
            <div class="section-header green">Positive Findings</div>
            <div class="section-content">
              ${renderStringList(report.analysisOutput.positiveFindings, "No positive findings")}
            </div>
          </div>

          <div class="section-box">
            <div class="section-header coral">Primary Observations</div>
            <div class="section-content">
              <ul class="meta-list">
                <li><strong>Oil levels:</strong> ${escapeHtml(report.analysisOutput.oilLevels)}</li>
                <li><strong>Hydration:</strong> ${escapeHtml(report.analysisOutput.hydration)}</li>
                <li><strong>Texture:</strong> ${escapeHtml(report.analysisOutput.texture)}</li>
                <li><strong>Tone:</strong> ${escapeHtml(report.analysisOutput.tone)}</li>
              </ul>
            </div>
          </div>

          <div class="section-box full">
            <div class="section-header blue">Recommended Products</div>
            <div class="section-content">
              ${renderProductLine(
                "Cleanser",
                report.doctorReview.cleanserBrand,
                report.doctorReview.cleanserCompany,
                report.doctorReview.cleanserProductName
              )}
              ${renderProductLine(
                "Sunscreen",
                report.doctorReview.sunscreenBrand,
                report.doctorReview.sunscreenCompany,
                report.doctorReview.sunscreenProductName
              )}
              ${renderProductLine(
                "Moisturizer",
                report.doctorReview.moisturizerBrand,
                report.doctorReview.moisturizerCompany,
                report.doctorReview.moisturizerProductName
              )}
              ${renderProductLine(
                "Repair/Serum",
                report.doctorReview.repairSerumBrand,
                report.doctorReview.repairSerumCompany,
                report.doctorReview.repairSerumProductName
              )}
            </div>
          </div>
        </div>
      </section>

      <section class="report-page">
        <h1 class="title">Daily Skin Care Regime</h1>

        <div class="routine-grid">
          <div class="routine-card">
            <h3>Morning (AM)</h3>
            ${renderRoutine(report.doctorReview.morningRoutine)}
          </div>
          <div class="routine-card">
            <h3>Night (PM)</h3>
            ${renderRoutine(report.doctorReview.nightRoutine)}
          </div>
        </div>

        <div class="panel-grid" style="margin-top: 18px">
          <div class="section-box full">
            <div class="section-header blue">Expert Tips</div>
            <div class="section-content">
              ${renderStringList(report.doctorReview.expertTips, "Doctor has not added expert tips yet.")}
            </div>
          </div>

          <div class="section-box">
            <div class="section-header green">Do This</div>
            <div class="section-content">
              ${renderStringList(report.doctorReview.doThis, "Doctor guidance will appear here.")}
            </div>
          </div>

          <div class="section-box">
            <div class="section-header coral">Not That</div>
            <div class="section-content">
              ${renderStringList(report.doctorReview.notThat, "Contraindications will appear here.")}
            </div>
          </div>

          <div class="section-box full">
            <div class="section-header blue">Doctor Notes</div>
            <div class="section-content">
              ${report.doctorReview.doctorNotes ? `<p>${escapeHtml(report.doctorReview.doctorNotes)}</p>` : renderPlaceholder("No additional doctor notes added.")}
            </div>
          </div>
        </div>

        <div class="footer">
          <div>
            <strong>Roopsee Skin Health</strong>
            <div>support@roopsee.local</div>
          </div>
          <div style="text-align: right">
            <div>Customer care: +91 00000 00000</div>
            <div>For educational and cosmetic guidance only</div>
          </div>
        </div>
      </section>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Roopsee Report ${escapeHtml(report.id)}</title>
    <style>${reportTemplateStyles}</style>
  </head>
  <body>${body}</body>
</html>`;
}
