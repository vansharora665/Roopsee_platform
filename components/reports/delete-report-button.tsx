"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function DeleteReportButton({
  reportId,
  patientName
}: {
  reportId: string;
  patientName: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete the report for ${patientName}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Could not delete report");
      }

      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not delete report");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="danger"
        className="whitespace-nowrap px-3 py-2"
        onClick={handleDelete}
        disabled={isDeleting}
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </Button>
      {error ? <p className="max-w-[220px] text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
