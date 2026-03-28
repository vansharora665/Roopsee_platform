import { Card } from "@/components/ui/card";
import { formatSkinScore, getSkinScoreSummary } from "@/lib/report/score";
import type { ProductMatchDto, ReportDetailDto } from "@/lib/report/types";

function SummaryList({ items, emptyLabel = "None noted" }: { items: string[]; emptyLabel?: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function slotTitle(slot: ProductMatchDto["slot"]) {
  switch (slot) {
    case "cleanser":
      return "Cleanser / Facewash";
    case "sunscreen":
      return "Sunscreen";
    case "moisturizer":
      return "Moisturizer";
    default:
      return "Repair / Serum";
  }
}

export function AnalysisSummary({ report }: { report: ReportDetailDto }) {
  const routinePlan = report.analysisOutput.routinePlan;
  const ingredientPlan = report.analysisOutput.ingredientPlan;
  const productMatchesBySlot = ["cleanser", "sunscreen", "moisturizer", "repair_serum"].map((slot) => ({
    slot,
    matches: report.productMatches.filter((match) => match.slot === slot)
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
              Analysis snapshot
            </p>
            <h2 className="text-xl font-semibold text-slate-900">Structured skin analysis</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Skin score</p>
              <p className="text-3xl font-bold text-brand-navy">{formatSkinScore(report.analysisOutput.skinScore)}/10</p>
              <p className="text-sm font-medium text-slate-600">{getSkinScoreSummary(report.analysisOutput.skinScore)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Overall profile</p>
              <p className="text-lg font-semibold text-slate-900">{report.analysisOutput.skinType}</p>
              <p className="text-sm text-slate-600">{report.analysisOutput.condition}</p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                Severity: {report.analysisOutput.overallSeverity}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
                Primary concerns
              </h3>
              <SummaryList items={report.analysisOutput.primaryConcerns} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
                Secondary concerns
              </h3>
              <SummaryList items={report.analysisOutput.secondaryConcerns} />
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
              Positive findings
            </h3>
            <SummaryList items={report.analysisOutput.positiveFindings} />
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
              Editable analysis context
            </p>
            <h2 className="text-xl font-semibold text-slate-900">Doctor-adjustable predicted fields</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Oil levels", report.analysisOutput.oilLevels],
              ["Hydration", report.analysisOutput.hydration],
              ["Texture", report.analysisOutput.texture],
              ["Tone", report.analysisOutput.tone],
              ["Intake source", report.intakeSource],
              ["Prompt mode", report.promptInputMode.replaceAll("_", " ")]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="font-semibold capitalize text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
              Prompt and handoff notes
            </h3>
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
              {report.analysisOutput.doctorHandoff?.summary || "No doctor handoff summary captured in the draft."}
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
              Ingredient strategy
            </p>
            <h2 className="text-xl font-semibold text-slate-900">AI draft product blueprint</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {ingredientPlan
              ? (["cleanser", "sunscreen", "moisturizer", "repair_serum"] as const).map((slot) => (
                  <div key={slot} className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      {slotTitle(slot)}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">{ingredientPlan[slot].purpose}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Hero ingredients
                    </p>
                    <p className="text-sm text-slate-800">{ingredientPlan[slot].hero_ingredients.join(", ")}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Notes
                    </p>
                    <p className="text-sm text-slate-700">{ingredientPlan[slot].notes || "No additional note"}</p>
                  </div>
                ))
              : <p className="text-sm text-slate-500">No ingredient plan captured yet.</p>}
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
              Routine draft
            </p>
            <h2 className="text-xl font-semibold text-slate-900">Morning and night plan</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {routinePlan
              ? ([
                  ["Morning", routinePlan.morning],
                  ["Night", routinePlan.night]
                ] as const).map(([label, items]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{label}</h3>
                    <div className="mt-3 space-y-3">
                      {items.map((item) => (
                        <div key={label + item.step} className="rounded-2xl bg-slate-50 p-3">
                          <p className="font-semibold text-slate-900">{item.step}</p>
                          <p className="text-sm text-slate-600">Usage: {item.usage_amount}</p>
                          <p className="mt-1 text-sm text-slate-700">{item.why}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              : <p className="text-sm text-slate-500">No routine draft captured yet.</p>}
          </div>
        </Card>
      </div>

      <Card className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-blue">
            Product matcher
          </p>
          <h2 className="text-xl font-semibold text-slate-900">Top suggested products from the catalog</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-4">
          {productMatchesBySlot.map(({ slot, matches }) => (
            <div key={slot} className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                {slotTitle(slot as ProductMatchDto["slot"])}
              </h3>
              <div className="mt-3 space-y-3">
                {matches.length > 0 ? matches.map((match) => (
                  <div key={match.id} className="rounded-2xl bg-slate-50 p-3">
                    <p className="font-semibold text-slate-900">
                      #{match.rank} {match.product.brandName} {match.product.productName}
                    </p>
                    <p className="text-sm text-slate-600">Match score: {match.matchScore.toFixed(1)}</p>
                    <p className="mt-2 text-sm text-slate-700">
                      {(match.reason.matchedHeroIngredients as string[] | undefined)?.join(", ") || "Ingredient fit pending"}
                    </p>
                  </div>
                )) : <p className="text-sm text-slate-500">No suggestions yet.</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
