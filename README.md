# Roopsee Platform

Roopsee is a production-oriented MVP for dermatologist-style skin analysis reports built on Next.js, TypeScript, Prisma, PostgreSQL, Tailwind, Zod, and React Hook Form.

## Final workflow in this version

1. User data, quiz answers, and scan references are stored in Supabase.
2. The platform can sync those profiles into its own `SyncedProfile` table either by manual pull or by a webhook.
3. A staff member opens `/reports/new`, selects a Supabase profile or enters data manually, and generates a fixed ChatGPT prompt on-platform.
4. The operator pastes the ChatGPT JSON draft back into the platform.
5. The backend validates the JSON with Zod, stores the draft, and runs the product matcher against the product catalog.
6. The doctor reviews only doctor-owned fields, adjusts products/routines/tips, approves the case, and generates the final PDF.
7. User delivery and Telegram are intentionally left for the next phase.

## What changed from the earlier MVP

- Added `SyncedProfile`, `PromptSession`, `ProductCatalog`, and `ProductMatch` Prisma models.
- Added a Supabase sync layer with list, sync, and webhook ingestion routes.
- Added a prompt generation route so the platform produces the exact copy-ready prompt.
- Added a full draft JSON contract that includes analysis, ingredient plan, routine plan, product matching hints, and doctor handoff notes.
- Added a product matching engine that picks the top catalog suggestions per slot before the doctor reviews the case.
- Updated the intake UI so it works as an operator workstation instead of a simple form.

## Key routes

User and operator flows:

- `/reports`
- `/reports/new`
- `/reports/[id]`
- `/reports/[id]/preview`

API routes:

- `GET /api/reports`
- `POST /api/reports`
- `POST /api/reports/prompt`
- `POST /api/uploads`
- `GET /api/supabase/profiles`
- `POST /api/supabase/profiles`
- `GET /api/supabase/profiles/[id]`
- `POST /api/supabase/webhook`
- `PATCH /api/reports/[id]/doctor-review`
- `POST /api/reports/[id]/status`
- `POST /api/reports/[id]/approve`
- `POST /api/reports/[id]/generate-pdf`
- `POST /api/reports/[id]/send`

## Environment variables

Copy `.env.example` to `.env`.

Required for the app:

- `DATABASE_URL`

Optional AI provider settings:

- `AI_PROVIDER=auto|mock|openai|gemini`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

Required for Supabase integration:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional Supabase tuning:

- `SUPABASE_PROFILES_TABLE` default `profiles`
- `SUPABASE_PROFILES_UPDATED_AT_COLUMN` default `updated_at`
- `SUPABASE_STORAGE_BUCKET` for turning storage paths into usable public URLs

Optional product import helper:

- `PRODUCT_CATALOG_WORKBOOK_PATH`

Other useful values:

- `APP_URL`
- `DEMO_USER_EMAIL`

## Deployment for your team

The app is now prepared for a shared Node deployment with:

- a Dockerfile for container deploys
- a health endpoint at `/api/health`
- persistent file storage via `FILE_STORAGE_ROOT`
- optional basic auth via `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD`

### Recommended production path

Use a provider that runs a long-lived Node container and supports a persistent disk. For this codebase, Railway or Render is a better fit than pure serverless hosting because the app:

- writes uploaded scans to disk
- writes generated PDF and HTML files to disk
- runs Puppeteer for PDF generation

### Railway steps

1. Push this repo to GitHub.
2. Create a new Railway project from the GitHub repo.
3. Add a PostgreSQL service in the same Railway project.
4. Add a volume to the web service and mount it at `/data`.
5. Deploy using the included `Dockerfile`.
6. Set these environment variables on the web service:

       DATABASE_URL=<Railway Postgres connection string>
       NEXT_PUBLIC_SUPABASE_URL=<your Supabase URL>
       SUPABASE_SERVICE_ROLE_KEY=<your Supabase service role key>
       SUPABASE_PROFILES_TABLE=users
       SUPABASE_PROFILES_UPDATED_AT_COLUMN=updated_at
       SUPABASE_SCANS_TABLE=skin_scans
       SUPABASE_STORAGE_BUCKET=skin-scans
       APP_URL=<your Railway public URL>
       FILE_STORAGE_ROOT=/data
       PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
       BASIC_AUTH_USERNAME=<team username>
       BASIC_AUTH_PASSWORD=<team password>
       DEMO_USER_EMAIL=doctor@roopsee.local

7. After the first deploy, run these one-time commands against the production app environment:

       npm run db:push
       npm run db:seed

8. Import the real product catalog into the production database. The easiest way is to run this from your own machine while `DATABASE_URL` points to the production database:

       npm run catalog:import -- "/absolute/path/to/Final Dr.Monika database.xlsx"

9. Share the deployed URL and the basic-auth credentials with your team.

### Important note about permissions

Right now this platform uses a placeholder internal user model, not real role-based login. That means everyone who can access the deployed URL can do everything in the app. The optional basic auth protects access at the app level, but it does not create per-user permissions yet.

## Local setup

1. Install dependencies.
2. Push the Prisma schema.
3. Seed demo data.
4. Import your real product workbook if needed.
5. Start the app.

Commands:

    npm install
    npm run db:generate
    npm run db:push
    npm run db:seed
    npm run catalog:import -- "/absolute/path/to/Final Dr.Monika database.xlsx"
    npm run dev

If you do not import the workbook immediately, the seed script still creates a small demo catalog so the matcher works.

## Supabase setup

### Manual sync

Use the button on `/reports/new` to pull the latest rows from Supabase into the local `SyncedProfile` table.

### Real-time sync

Point a Supabase webhook at:

    POST {APP_URL}/api/supabase/webhook

The route accepts either a raw row payload or the common Supabase `record` / `new` wrapper shape.

### Expected profile data shape

The normalizer is defensive because your exact schema can vary. It looks for common fields such as:

- `name`, `full_name`, `patient_name`
- `age`
- `sex`, `gender`
- `quiz_answers`, `quiz_json`, `questionnaire_json`, `skin_quiz`
- `scans`, `scan_urls`, `images`, `image_urls`, `photos`

If your schema uses different names, update `lib/supabase/profile-normalizer.ts`.

## Prompt and draft workflow

The platform now supports the exact operator flow you described:

1. Select or sync a profile.
2. Review or edit the intake details.
3. Click `Generate prompt`.
4. Copy the prompt into ChatGPT.
5. Upload the 3 images in ChatGPT if using `scan_assisted` mode.
6. Paste the JSON response into the `Draft JSON` area.
7. Create the report draft.

The doctor never edits raw JSON later. The JSON is validated once on import, then the doctor only works with doctor-owned fields in the review UI.

## Product matching

The matcher uses:

- drafted hero ingredients
- target concerns
- preferred textures
- avoid ingredients
- claimed product skin type / concern fit
- overall suitability score
- sensitivity and pregnancy signals from quiz data

The top matches are stored in `ProductMatch` and shown on the report detail page before the doctor finalizes the case.

## Seed data

`npm run db:seed` now creates:

- demo admin and doctor users
- a demo synced Supabase profile
- a small demo product catalog
- one approved report
- one draft report

## What is still intentionally left for later

- Telegram notifications
- final user delivery automation
- syncing approved product selections back to the main website or Supabase
- production authentication and RBAC
- cloud object storage for uploads and generated PDFs

## Important implementation rules enforced

- GPT does not generate the final layout or prose PDF.
- Doctor-owned fields stay separate from model-owned fields.
- Draft JSON is validated before persistence.
- The final renderer depends on stored data only.
- Product matching is deterministic and does not depend on GPT.
