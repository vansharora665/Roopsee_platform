"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function CreateFollowUpButton({
  syncedProfileId,
  disabled
}: {
  syncedProfileId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function createFollowUp() {
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/follow-ups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ syncedProfileId })
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error ?? "Could not create follow-up report");
        return;
      }

      router.push(`/reports/${payload.data.id}`);
    });
  }

  return (
    <div className="space-y-2">
      <Button onClick={createFollowUp} disabled={disabled || isPending}>
        {isPending ? "Creating follow-up..." : "Create follow-up"}
      </Button>
      {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}
