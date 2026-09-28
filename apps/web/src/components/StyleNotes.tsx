"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { Pencil } from "lucide-react";
import posthog from "posthog-js";
import { api } from "@convex/_generated/api";
import {
  refreshStyleBioAction,
  updateProfileBioAction,
} from "@/app/actions/wardrobe";
import { Button } from "@/components/ui/button";
import TaskSheet from "@/components/TaskSheet";
import { Textarea } from "@/components/ui/textarea";
import { createTraceContext } from "@/lib/trace";
import { userFacingErrorMessage } from "@/lib/userFacingError";

export default function StyleNotes() {
  const { isLoaded, isSignedIn } = useUser();
  const profile = useQuery(
    api.profile.getProfile,
    isLoaded && isSignedIn ? {} : "skip",
  );
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const refreshAttempted = useRef(false);

  useEffect(() => {
    if (!isSignedIn || profile === undefined || refreshAttempted.current)
      return;
    refreshAttempted.current = true;
    void refreshStyleBioAction()
      .then((result) => {
        if (result.updated) setDraft(result.bio);
      })
      .catch((error) =>
        console.warn("style_bio.background_refresh.failed", error),
      );
  }, [isSignedIn, profile]);

  const notes = useMemo(() => draft ?? profile?.bio ?? "", [draft, profile]);
  const hasChanges = draft !== null && draft !== (profile?.bio ?? "");

  const save = async () => {
    setStatus("saving");
    setMessage("");
    try {
      await updateProfileBioAction({ bio: notes, ...createTraceContext() });
      setStatus("saved");
      setMessage("Style notes saved.");
      posthog.capture("profile_bio_saved", {
        character_count: notes.length,
        surface: "wardrobe",
      });
    } catch (error) {
      setStatus("error");
      setMessage(
        userFacingErrorMessage(error, "Could not save your style notes."),
      );
      posthog.captureException(error, {
        workflow: "profile_bio_save",
        surface: "wardrobe",
      });
    }
  };

  if (!isSignedIn) return null;

  return (
    <section
      id="style-notes"
      className="scroll-mt-24"
      aria-labelledby="style-notes-title"
    >
      <button
        type="button"
        className="flex min-h-20 w-full items-center justify-between gap-4 text-left"
        onClick={() => setOpen(true)}
      >
        <span className="min-w-0">
          <span
            id="style-notes-title"
            className="block text-base font-extrabold text-[#241426]"
          >
            Your style
          </span>
          <span
            data-private
            className="mt-1 line-clamp-2 h-11 text-sm leading-relaxed text-[#685e70]"
          >
            {profile?.bio || "Add style notes"}
          </span>
        </span>
        <Pencil className="size-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">Edit style notes</span>
      </button>
      <TaskSheet
        open={open}
        onOpenChange={(value) => {
          if (status !== "saving") setOpen(value);
        }}
        title="Your style"
        footer={
          <>
            <div
              className="task-sheet-status"
              role={status === "error" ? "alert" : "status"}
            >
              {message}
            </div>
            <Button
              onClick={save}
              disabled={status === "saving" || !hasChanges}
              className="rack-primary-action w-full"
            >
              {status === "saving" ? "Saving…" : "Save notes"}
            </Button>
          </>
        }
      >
        <Textarea
          data-private
          value={notes}
          onChange={(event) => {
            setDraft(event.target.value);
            setStatus("idle");
            setMessage("");
          }}
          aria-label="Style notes"
          placeholder="Relaxed through the shoulders, avoids dry-clean-only pieces, likes warm neutrals…"
          className="mt-3 min-h-28 resize-y rounded-none border border-[var(--rack-line)] bg-white p-4 text-sm font-medium leading-relaxed text-[#241426]"
        />
      </TaskSheet>
    </section>
  );
}
