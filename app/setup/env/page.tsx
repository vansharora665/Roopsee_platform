import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const exampleEnvLines = [
  'DATABASE_URL="postgresql://your_local_db_user@localhost:5432/roopsee?schema=public"',
  '',
  '# AI provider settings',
  'AI_PROVIDER="auto"',
  'OPENAI_API_KEY=""',
  'OPENAI_MODEL="gpt-4.1-mini"',
  'GEMINI_API_KEY=""',
  'GEMINI_MODEL="gemini-2.5-flash"',
  '',
  '# Supabase settings for your project',
  'NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"',
  'SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"',
  'SUPABASE_PROFILES_TABLE="users"',
  'SUPABASE_PROFILES_UPDATED_AT_COLUMN="updated_at"',
  'SUPABASE_SCANS_TABLE="skin_scans"',
  'SUPABASE_STORAGE_BUCKET="skin-scans"',
  '',
  '# Optional helpers',
  'PRODUCT_CATALOG_WORKBOOK_PATH="/Users/vansharora665/Downloads/Final Dr.Monika database.xlsx"',
  'APP_URL="http://localhost:3000"',
  'DEMO_USER_EMAIL="doctor@roopsee.local"'
].join("\n");

async function readCurrentEnv() {
  try {
    const filePath = path.join(process.cwd(), ".env");
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

export default async function EnvSetupPage() {
  const currentEnv = await readCurrentEnv();

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-blue">
              Env setup
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Supabase and local config guide
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              This page reads your current local <code>.env</code> file from the project root when it
              exists, and also shows the readable example format below it.
            </p>
          </div>
          <Link href="/reports/new">
            <Button variant="secondary">Back to intake</Button>
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Current <code>.env</code></h2>
          <p className="text-sm text-slate-600">
            This is the local file the app is using right now. If it is empty, create <code>.env</code>
            from the example shown beside it.
          </p>
          <pre className="overflow-x-auto rounded-3xl bg-slate-950 p-5 text-sm text-slate-100">
            <code>{currentEnv ?? "No .env file found yet in the project root."}</code>
          </pre>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Readable example</h2>
          <p className="text-sm text-slate-600">
            Use this as the template if you want to create or replace the file quickly.
          </p>
          <pre className="overflow-x-auto rounded-3xl bg-slate-950 p-5 text-sm text-slate-100">
            <code>{exampleEnvLines}</code>
          </pre>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Your Supabase users mapping</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li><code>users.name</code> becomes the profile name in the intake form.</li>
            <li><code>users.email</code> and <code>users.phone_no</code> are stored in the synced profile.</li>
            <li><code>users.skin_type</code> and <code>users.skin_concerns</code> are folded into the profile summary.</li>
            <li><code>users.skin_quiz</code> is treated as the quiz JSON source.</li>
            <li><code>users.updated_at</code> is used to pull the newest users first.</li>
            <li><code>skin_scans</code> is matched to <code>users.id</code> and front, left, right scans are used for the three report images.</li>
          </ul>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900">Values to paste into <code>.env</code></h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li><code>NEXT_PUBLIC_SUPABASE_URL</code>: your Supabase project URL.</li>
            <li><code>SUPABASE_SERVICE_ROLE_KEY</code>: server-side service role key from Supabase settings.</li>
            <li><code>SUPABASE_PROFILES_TABLE="users"</code>: keeps sync pointed at the table from your screenshot.</li>
            <li><code>SUPABASE_PROFILES_UPDATED_AT_COLUMN="updated_at"</code>: sorts newest rows first.</li>
            <li><code>SUPABASE_SCANS_TABLE="skin_scans"</code>: pulls the 3 face scans linked to the user.</li>
            <li><code>SUPABASE_STORAGE_BUCKET="skin-scans"</code>: the public bucket that contains <code>&lt;user-id&gt;/front|left|right</code> scan files.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
