import { formatDate } from "@/lib/utils";
import { getActiveScorePoint, getSkinScoreSummary } from "@/lib/report/score";
import type { DoctorProductRowDto, ReportDetailDto, RoutineItem } from "@/lib/report/types";

function Placeholder({ text }: { text: string }) {
  return <span className="placeholder">{text}</span>;
}

function productRowParts(row: DoctorProductRowDto) {
  return Array.from(new Set([row.brand, row.company, row.productName].filter(Boolean)));
}

function displayProductRowTitle(row: DoctorProductRowDto) {
  if (row.title?.trim()) {
    return row.title.trim();
  }

  switch (row.slot) {
    case "cleanser": {
      const combined = productRowParts(row).join(" ").toLowerCase();
      if (combined.includes("facewash") || combined.includes("face wash")) {
        return "Facewash";
      }
      if (combined.includes("cleanser")) {
        return "Cleanser";
      }
      return "Cleanser / Facewash";
    }
    case "sunscreen":
      return "Sunscreen";
    case "moisturizer":
      return "Moisturizer";
    case "repair_serum":
      return "Repair / Serum";
    default:
      return "";
  }
}

function renderProductRow(row: DoctorProductRowDto) {
  const parts = productRowParts(row);
  const label = displayProductRowTitle(row);

  return (
    <div className="product-item">
      {label ? <strong>{label}</strong> : null}
      {label ? " " : null}
      {parts.length > 0 ? parts.join(" - ") : <Placeholder text="To be completed by doctor" />}
    </div>
  );
}

function renderRoutine(items: RoutineItem[]) {
  if (!items.length) {
    return <Placeholder text="Doctor has not added this routine yet." />;
  }

  return (
    <ol className="routine-list">
      {items.map((item, index) => (
        <li key={`${item.step}-${index}`}>
          <strong>{item.step}</strong> - {item.usageAmount}
        </li>
      ))}
    </ol>
  );
}

function renderStringList(items: string[], emptyText: string) {
  if (!items.length) {
    return <Placeholder text={emptyText} />;
  }

  return (
    <ul className="meta-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function renderVerifiedStamp(report: ReportDetailDto) {
  if (!["approved", "sent_to_user"].includes(report.status)) {
    return null;
  }

  return (
    <div className="verified-stamp">
      <div className="verified-stamp-title">Doctor Verified</div>
      <div className="verified-stamp-subtitle">
        {report.approvedBy?.name ? `Approved by ${report.approvedBy.name}` : "Approved report"}
      </div>
      <div className="verified-stamp-date">
        {report.approvedAt ? formatDate(report.approvedAt) : formatDate(report.updatedAt)}
      </div>
    </div>
  );
}

export function ReportDocument({ report }: { report: ReportDetailDto }) {
  const activeScorePoint = getActiveScorePoint(report.analysisOutput.skinScore);

  return (
    <div className="report-root">
      <section className="report-page">
        <div className="title-wrap">
          <h1 className="title">Skin Analysis Report</h1>
        </div>

        <div className="top-grid">
          <div className="pill">
            <div className="pill-label">Name</div>
            <div className="pill-value">{report.patientInfo.name}</div>
          </div>
          <div className="pill">
            <div className="pill-label">Sex</div>
            <div className="pill-value">{report.patientInfo.sex}</div>
          </div>
          <div className="pill">
            <div className="pill-label">Age</div>
            <div className="pill-value">{report.patientInfo.age} years</div>
          </div>
          <div className="pill">
            <div className="pill-label">Date</div>
            <div className="pill-value">{formatDate(report.patientInfo.reportDate)}</div>
          </div>
          <div className="pill" style={{ gridColumn: "2 / 4" }}>
            <div className="pill-label">Input Sources</div>
            <div className="pill-value">{report.patientInfo.inputSources.join(" + ")}</div>
          </div>
        </div>

        <div className="images">
          {[report.assets.image1Url, report.assets.image2Url, report.assets.image3Url].map(
            (image, index) => (
              <div className="image-slot" key={image ?? `placeholder-${index}`}>
                {image ? (
                  <img src={image} alt={`Facial input ${index + 1}`} />
                ) : (
                  <div className="image-placeholder">Facial Image {index + 1}</div>
                )}
              </div>
            )
          )}
        </div>

        <div className="score-wrap">
          <div className="score-label">{getSkinScoreSummary(report.analysisOutput.skinScore)}</div>
          <div className="score-line">
            {Array.from({ length: 10 }, (_, index) => {
              const value = index + 1;

              return (
                <div
                  className={`score-point ${value === activeScorePoint ? "active" : ""}`}
                  key={value}
                >
                  <span>{value}</span>
                </div>
              );
            })}
          </div>
          <div className="score-bands">
            <div className="severe">Severe</div>
            <div className="concerning">Concerning</div>
            <div className="moderate">Moderate</div>
            <div className="good">Good</div>
            <div className="excellent">Excellent</div>
          </div>
        </div>

        <div className="panel-grid">
          <div className="section-box">
            <div className="section-header blue">Overall Skin Profile</div>
            <div className="section-content">
              <p>
                <strong>Skin Type:</strong> {report.analysisOutput.skinType}
              </p>
              <p>
                <strong>Condition:</strong> {report.analysisOutput.condition}
              </p>
              <p>
                <strong>Overall Severity:</strong> {report.analysisOutput.overallSeverity}
              </p>
            </div>
          </div>

          <div className="section-box">
            <div className="section-header coral">Key Skin Concerns</div>
            <div className="section-content">
              <div className="columns">
                <div>
                  <p>
                    <strong>Primary:</strong>
                  </p>
                  {renderStringList(report.analysisOutput.primaryConcerns, "No primary concerns")}
                </div>
                <div>
                  <p>
                    <strong>Secondary:</strong>
                  </p>
                  {renderStringList(report.analysisOutput.secondaryConcerns, "No secondary concerns")}
                </div>
              </div>
            </div>
          </div>

          <div className="section-box">
            <div className="section-header green">Positive Findings</div>
            <div className="section-content">
              {renderStringList(report.analysisOutput.positiveFindings, "No positive findings")}
            </div>
          </div>

          <div className="section-box">
            <div className="section-header coral">Primary Observations</div>
            <div className="section-content">
              <ul className="meta-list">
                <li>
                  <strong>Oil levels:</strong> {report.analysisOutput.oilLevels}
                </li>
                <li>
                  <strong>Hydration:</strong> {report.analysisOutput.hydration}
                </li>
                <li>
                  <strong>Texture:</strong> {report.analysisOutput.texture}
                </li>
                <li>
                  <strong>Tone:</strong> {report.analysisOutput.tone}
                </li>
              </ul>
            </div>
          </div>

          <div className="section-box full">
            <div className="section-header blue">Recommended Products</div>
            <div className="section-content">
              {report.doctorReview.productRows.filter((row) => row.title || row.brand || row.company || row.productName || row.productCatalogId).length > 0
                ? report.doctorReview.productRows
                    .filter((row) => row.title || row.brand || row.company || row.productName || row.productCatalogId)
                    .map((row) => <div key={row.id}>{renderProductRow(row)}</div>)
                : <Placeholder text="To be completed by doctor" />}
            </div>
          </div>
        </div>
      </section>

      <section className="report-page">
        <h1 className="title">Daily Skin Care Regime</h1>

        <div className="routine-grid">
          <div className="routine-card">
            <h3>Morning (AM)</h3>
            {renderRoutine(report.doctorReview.morningRoutine)}
          </div>
          <div className="routine-card">
            <h3>Night (PM)</h3>
            {renderRoutine(report.doctorReview.nightRoutine)}
          </div>
        </div>

        <div className="panel-grid" style={{ marginTop: "18px" }}>
          <div className="section-box">
            <div className="section-header green">Do This</div>
            <div className="section-content">
              {renderStringList(report.doctorReview.doThis, "Doctor guidance will appear here.")}
            </div>
          </div>

          <div className="section-box">
            <div className="section-header coral">Not That</div>
            <div className="section-content">
              {renderStringList(report.doctorReview.notThat, "Contraindications will appear here.")}
            </div>
          </div>

          <div className="section-box full">
            <div className="section-header blue">Doctor Notes</div>
            <div className="section-content">
              {report.doctorReview.doctorNotes ? (
                <p>{report.doctorReview.doctorNotes}</p>
              ) : (
                <Placeholder text="No additional doctor notes added." />
              )}
            </div>
          </div>
        </div>

        <div className="bottom-approval-row">{renderVerifiedStamp(report)}</div>

        <div className="footer">
          <div>
            <strong>Roopsee Skin Health</strong>
            <div>support@roopsee.local</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div>Customer care: +91 00000 00000</div>
            <div>For educational and cosmetic guidance only</div>
          </div>
        </div>
      </section>
    </div>
  );
}
