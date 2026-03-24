import { NewReportForm } from "@/components/reports/new-report-form";
import { listSyncedProfiles } from "@/lib/supabase/profile-service";

export default async function NewReportPage() {
  const profiles = await listSyncedProfiles().catch(() => []);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-blue">
          New report
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          Intake, prompt, and draft workstation
        </h1>
        <p className="max-w-4xl text-sm text-slate-600">
          Pull profile data from Supabase or enter it manually, generate a fixed JSON prompt for
          ChatGPT, paste the returned draft JSON back here, and hand the case to the doctor review
          queue with product matches prefilled.
        </p>
      </div>
      <NewReportForm initialProfiles={profiles} />
    </div>
  );
}
