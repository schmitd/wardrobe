"use client";
import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { CALENDAR_SCOPES } from "@wardrobe/shared";
import { planningRequest } from "@/lib/planning-client";
import { Button } from "@/components/ui/button";
export default function GoogleCalendarConnect({
  enabled,
  onChange,
  selectedIds = [],
  beforeAuthorize,
}: {
  enabled: boolean;
  onChange: () => void;
  selectedIds?: string[];
  beforeAuthorize?: () => void;
}) {
  const { user } = useUser();
  const [calendars, setCalendars] = useState<
    { id: string; name: string; primary: boolean }[] | null
  >(null);
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const loaded = useRef(false);
  const mobile =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("returnTo") === "mobile";
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch {
      setMessage(
        "Calendar did not connect. Your week and draft are still here. Retry or continue without Calendar.",
      );
    } finally {
      setBusy(false);
    }
  };
  const load = async () => {
    const result = await planningRequest<{
      calendars: NonNullable<typeof calendars>;
      truncated: boolean;
    }>({ operation: "calendar_list" });
    setCalendars(result.calendars);
    setSelected(
      selectedIds.length
        ? selectedIds.filter((id) => result.calendars.some((c) => c.id === id))
        : result.calendars.filter((c) => c.primary).map((c) => c.id),
    );
    if (result.truncated) setMessage("Showing the first 100 calendars.");
  };
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    if (
      enabled ||
      new URLSearchParams(window.location.search).get("calendar") ===
        "connected"
    )
      void run(load);
  }, [enabled]);
  const authorize = () =>
    run(async () => {
      if (!user) return;
      beforeAuthorize?.();
      const existing = user.externalAccounts.find(
        (a) => a.provider === "google",
      );
      const redirectUrl = `${window.location.origin}/fits?view=plans&calendar=connected${mobile ? "&returnTo=mobile" : ""}`;
      const account = existing
        ? await existing.reauthorize({
            additionalScopes: CALENDAR_SCOPES,
            redirectUrl,
          })
        : await user.createExternalAccount({
            strategy: "oauth_google",
            additionalScopes: CALENDAR_SCOPES,
            redirectUrl,
          });
      const url = account.verification?.externalVerificationRedirectURL;
      if (url) window.location.assign(url.toString());
      else await load();
    });
  return (
    <section aria-label="Google Calendar connection" className="space-y-4">
      <p className="text-sm">
        Read-only access to calendars you choose. Wardrobe never adds or changes
        events.
      </p>
      {!calendars && !saved ? (
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={authorize}>
            {busy
              ? "Connecting…"
              : enabled
                ? "Reconnect Google"
                : "Continue with Google"}
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void run(load)}
          >
            Already connected? Choose calendars
          </Button>
        </div>
      ) : null}
      {calendars && (
        <fieldset data-private className="space-y-3 rounded-xl border p-4">
          <legend className="px-1 font-medium">Use these calendars</legend>
          {calendars.map((c) => (
            <label key={c.id} className="flex min-h-10 items-center gap-3">
              <input
                type="checkbox"
                disabled={busy}
                checked={selected.includes(c.id)}
                onChange={(e) =>
                  setSelected((ids) =>
                    e.target.checked
                      ? [...ids, c.id].slice(0, 10)
                      : ids.filter((id) => id !== c.id),
                  )
                }
              />
              {c.name}
            </label>
          ))}
          <Button
            disabled={busy || !selected.length}
            onClick={() =>
              void run(async () => {
                await planningRequest({
                  operation: "calendar_connect",
                  calendarIds: selected,
                });
                setCalendars(null);
                setSaved(true);
                onChange();
                setMessage("Calendar connected. Your week is ready.");
              })
            }
          >
            Use selected calendars
          </Button>
        </fieldset>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer py-2">How Calendar is used</summary>
        <p>
          Opening a week reads event titles and times for display. Requested
          outfit generation also uses locations. Attendees and event
          descriptions are not read. Calendar content never goes to product
          analytics. Disconnect deletes saved calendar-derived outfits,
          including planned and worn entries. You can also revoke permission in
          your Google Account.
        </p>
        {enabled && (
          <Button
            className="mt-3"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "Disconnect and delete calendar-derived outfits, including planned and worn entries? Other wardrobe data and Google sign-in stay intact.",
                )
              )
                void run(async () => {
                  await planningRequest({ operation: "calendar_disconnect" });
                  setCalendars(null);
                  setSaved(false);
                  onChange();
                });
            }}
          >
            Disconnect and delete
          </Button>
        )}
      </details>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
      {mobile && (
        <a
          className="inline-block rounded-full bg-[#735079] px-5 py-3 font-medium text-white"
          href="wardrobe://fits?view=plans"
        >
          {saved
            ? "Return to Wardrobe"
            : "Continue in Wardrobe without changes"}
        </a>
      )}
    </section>
  );
}
