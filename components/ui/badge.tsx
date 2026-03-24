import { cn } from "@/lib/utils";

const variants = {
  draft_generated: "bg-amber-100 text-amber-900",
  under_doctor_review: "bg-sky-100 text-sky-900",
  approved: "bg-emerald-100 text-emerald-900",
  sent_to_user: "bg-violet-100 text-violet-900"
} as const;

export function Badge({
  children,
  status
}: {
  children: React.ReactNode;
  status?: keyof typeof variants;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize",
        status ? variants[status] : "bg-slate-100 text-slate-700"
      )}
    >
      {children}
    </span>
  );
}
