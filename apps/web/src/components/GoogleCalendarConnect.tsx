"use client";
import { useUser } from "@clerk/nextjs";
import { useState } from "react";
import { CALENDAR_SCOPES } from "@wardrobe/shared";
import { planningRequest } from "@/lib/planning-client";
import { Button } from "@/components/ui/button";

export default function GoogleCalendarConnect({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
  const { user } = useUser();
  const [calendars, setCalendars] = useState<
    { id: string; name: string; primary: boolean }[] | null
  >(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch {
      setMessage(
        "Calendar connection could not be completed. Reconnect with Google and allow both permissions.",
      );
    } finally {
      setBusy(false);
    }
  };
  const authorize = () =>
    run(async () => {
      if (!user) return;
      const existing = user.externalAccounts.find(
        (a) => a.provider === "google",
      );
      const redirectUrl = `${window.location.origin}/fits?view=plans&calendar=connected`;
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
      else
        setMessage("Google is connected. Choose “Select calendars” to finish.");
    });
  return (
    <section
      className="space-y-3 border p-4"
      aria-label="Google Calendar connection"
    >
      <h3 className="font-bold">
        Google Calendar {enabled ? "· Connected" : "· Optional"}
      </h3>
      <p className="text-sm">
        Read-only access to selected calendars. Events are read only when you
        request an outfit for a date. Event titles, times and locations may
        inform the AI recommendation; attendee lists and descriptions are not
        read. Disconnect deletes saved calendar-derived recommendations,
        including planned and worn entries. You can also revoke Google
        permission in your Google Account.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={authorize}
        >
          {enabled ? "Reauthorize Google" : "Connect Google Calendar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const result = await planningRequest<{
                calendars: { id: string; name: string; primary: boolean }[];
                truncated: boolean;
              }>({ operation: "calendar_list" });
              setCalendars(result.calendars);
              setSelected(
                result.calendars.filter((c) => c.primary).map((c) => c.id),
              );
              if (result.truncated)
                setMessage("Showing the first 100 calendars.");
            })
          }
        >
          Select calendars
        </Button>
        {enabled && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "Disconnect and delete all calendar-derived recommendations, including planned and worn entries? Other wardrobe data and Google sign-in stay intact.",
                )
              )
                void run(async () => {
                  await planningRequest({ operation: "calendar_disconnect" });
                  setCalendars(null);
                  onChange();
                });
            }}
          >
            Disconnect and delete
          </Button>
        )}
      </div>
      {calendars && (
        <fieldset data-private className="space-y-2">
          <legend>Calendars to use (up to 10)</legend>
          {calendars.map((c) => (
            <label key={c.id} className="flex gap-2">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={(e) =>
                  setSelected((current) =>
                    e.target.checked
                      ? [...current, c.id].slice(0, 10)
                      : current.filter((id) => id !== c.id),
                  )
                }
              />
              {c.name}
            </label>
          ))}
          <Button
            type="button"
            disabled={busy || !selected.length}
            onClick={() =>
              run(async () => {
                await planningRequest({
                  operation: "calendar_connect",
                  calendarIds: selected,
                });
                setCalendars(null);
                onChange();
                setMessage(
                  "Calendar connection saved. You can return to the iPhone or Android app.",
                );
              })
            }
          >
            Use selected calendars
          </Button>
        </fieldset>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
