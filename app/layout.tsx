import type { Metadata } from "next";
import Link from "next/link";

import "@/app/globals.css";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Roopsee",
  description: "Dermatologist-style skin analysis report workflow"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
              <div>
                <Link href="/reports" className="text-2xl font-bold tracking-tight text-brand-navy">
                  Roopsee
                </Link>
                <p className="text-sm text-slate-500">
                  Dermatologist workflow MVP for structured skin analysis reports
                </p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <nav className="flex flex-wrap justify-end gap-2 text-sm font-semibold">
                  <Link className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-slate-200" href="/dashboard">
                    Funnel
                  </Link>
                  <Link className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-slate-200" href="/notifications">
                    Android notification
                  </Link>
                  <Link className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-slate-200" href="/reports">
                    Reports
                  </Link>
                  <Link className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-slate-200" href="/follow-ups">
                    Follow-ups
                  </Link>
                </nav>
                <div className="text-right text-sm text-slate-600">
                  <p className="font-medium text-slate-900">
                    {currentUser?.name ?? "Demo doctor session"}
                  </p>
                  <p>{currentUser?.email ?? "doctor@roopsee.local"}</p>
                </div>
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
