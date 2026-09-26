"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ReminderOpen } from "@wardrobe/shared";
import { reminderRequest } from "@/lib/reminder-client";
import { openCaptureMenu } from "@/lib/captureEvents";
import { Button } from "@/components/ui/button";
export default function ReminderPrompt({ id }: { id: string }) {
  const [value, setValue] = useState<ReminderOpen>(null),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void reminderRequest<ReminderOpen>({ operation: "open", id })
      .then((value) => {
        if (active) setValue(value);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <section className="rounded-xl border border-[#d8c9dc] bg-[#f2edf4] p-4">
      <p className="mb-3">
        {!loaded
          ? "Checking this reminder…"
          : !value
            ? "This reminder is no longer available for this account."
            : value.resolved
              ? "This outfit has already been recorded or reviewed."
              : value.expired
                ? "This reminder has passed. You can still review your outfit."
                : `Ready to record your fit for ${value.date}?`}
      </p>
      <div className="flex flex-wrap gap-2">
        {value && !value.expired && !value.resolved && (
          <Button
            onClick={() =>
              openCaptureMenu(
                value.planId
                  ? {
                      planId: value.planId,
                      expectedPlanRevision: value.planRevision ?? 0,
                    }
                  : undefined,
              )
            }
          >
            Record this fit
          </Button>
        )}
        {value?.planId && (
          <Button asChild variant="outline">
            <Link href={`/fits?view=plan&date=${value.date}`}>
              Review current plan
            </Link>
          </Button>
        )}
        <Button asChild variant="ghost">
          <Link href="/fits">Dismiss</Link>
        </Button>
      </div>
    </section>
  );
}
