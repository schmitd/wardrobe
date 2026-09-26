"use client";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  defaultReminders,
  type ReminderPreferences,
  type ReminderSettings as Settings,
} from "@wardrobe/shared";
import { reminderRequest } from "@/lib/reminder-client";
import { Button } from "@/components/ui/button";
const deviceKey = "wardrobe-reminder-device";
const ownerKey = "wardrobe-reminder-owner";
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
function deviceId() {
  let id = localStorage.getItem(deviceKey);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(deviceKey, id);
  }
  return id;
}
async function subscribe(key: string, userId: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    throw new Error(
      "This browser cannot receive reminders. On iPhone, install Wardrobe on your Home Screen first.",
    );
  const permission = Notification.permission === "denied" ? "denied" : await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "Notifications are off. You can change this in browser settings.",
    );
  const registration = await navigator.serviceWorker.register(
    "/fit-reminders-sw.js",
  );
  await navigator.serviceWorker.ready;
  const bytes = Uint8Array.from(
    atob(key.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes,
    }));
  const data = subscription.toJSON();
  await reminderRequest({
    operation: "register",
    installationId: deviceId(),
    transport: "web",
    endpoint: subscription.endpoint,
    p256dh: data.keys?.p256dh,
    auth: data.keys?.auth,
    label: "This browser",
    timezone: zone(),
    select: true,
  });
  localStorage.setItem(ownerKey, userId);
}
export function WebReminderLifecycle() {
  const { isLoaded, isSignedIn, user } = useUser();
  useEffect(() => {
    if (!isLoaded || !("serviceWorker" in navigator)) return;
    let active = true;
    const refresh = async () => {
      const registeredOwner = localStorage.getItem(ownerKey);
      if (!registeredOwner) return;
      const registration = await navigator.serviceWorker.getRegistration(
        "/fit-reminders-sw.js",
      );
      const subscription = await registration?.pushManager.getSubscription();
      if (!active) return;
      if (!isSignedIn || registeredOwner !== user?.id) {
        await subscription?.unsubscribe();
        localStorage.removeItem(ownerKey);
        return;
      }
      if (Notification.permission !== "granted" || !subscription) {
        await reminderRequest({
          operation: "revoke",
          installationId: deviceId(),
        });
        localStorage.removeItem(ownerKey);
        return;
      }
      const data = subscription.toJSON();
      await reminderRequest({
        operation: "register",
        installationId: deviceId(),
        transport: "web",
        endpoint: subscription.endpoint,
        p256dh: data.keys?.p256dh,
        auth: data.keys?.auth,
        label: "This browser",
        timezone: zone(),
        select: false,
      });
    };
    const visible = () => {
      if (document.visibilityState === "visible")
        void refresh().catch(() => undefined);
    };
    void refresh().catch(() => undefined);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", visible);
    };
  }, [isLoaded, isSignedIn, user?.id]);
  return null;
}
export default function ReminderSettings() {
  const { user } = useUser();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [prefs, setPrefs] = useState<ReminderPreferences>(
    defaultReminders(zone()),
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const value = await reminderRequest<Settings>({ operation: "settings" });
    setSettings(value);
    setPrefs(value.preferences ?? defaultReminders(zone()));
  }, []);
  useEffect(() => {
    void load().catch(() =>
      setMessage("Could not load reminders. Please try again."),
    );
  }, [load]);
  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
      await load();
      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update reminders.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rack-panel space-y-4 rounded-2xl bg-white p-5">
      <h1 className="text-2xl font-bold">Fit reminders</h1>
      <p className="text-sm">
        A small nudge to record what you wore. Opening a reminder never marks an
        outfit as worn.
      </p>
      {settings && !settings.live && (
        <p role="status" className="rounded-lg bg-[#f2edf4] p-3 text-sm">
          Reminders are in preview. You can save your choices; notifications
          will start after delivery is enabled.
        </p>
      )}
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={prefs.daily}
          onChange={(e) => setPrefs({ ...prefs, daily: e.target.checked })}
        />
        Noon check-in when I have no outfit plan
      </label>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={prefs.planned}
          onChange={(e) => setPrefs({ ...prefs, planned: e.target.checked })}
        />
        Remind me when a planned outfit starts
      </label>
      <p className="text-sm text-[#56345c]">
        Plans without a time get a noon reminder. Linking a calendar event
        allows Wardrobe to check that event in the background while reminders
        are on.
      </p>
      <label className="flex items-center gap-3">
        Maximum per day
        <select
          className="rounded border p-2"
          value={prefs.dailyCap}
          onChange={(e) =>
            setPrefs({ ...prefs, dailyCap: Number(e.target.value) })
          }
        >
          <option value={1}>1 reminder</option>
          <option value={2}>2 reminders</option>
        </select>
      </label>
      <p className="text-sm">
        At least 3 hours apart. Quiet from 9 pm to 9 am. Timezone:{" "}
        {prefs.timezone}.
      </p>
      <Button
        disabled={!settings || busy}
        onClick={() =>
          void run(
            () =>
              reminderRequest({
                operation: "preferences",
                ...prefs,
                timezone: zone(),
                primaryInstallationId: settings?.primaryInstallationId,
              }),
            "Reminder preferences saved.",
          )
        }
      >
        Save preferences{prefs.timezone !== zone() ? ` · use ${zone()}` : ""}
      </Button>
      <h2 className="font-bold">One selected device</h2>
      <p className="text-sm">
        Choose your phone or this browser. Selecting another device replaces the
        current destination.
      </p>
      {settings?.installations.map((device) => (
        <Button
          key={device.id}
          variant="outline"
          disabled={busy || device.id === settings.primaryInstallationId}
          onClick={() =>
            void run(
              () =>
                reminderRequest({
                  operation: "preferences",
                  ...prefs,
                  primaryInstallationId: device.id,
                }),
              "Selected device updated.",
            )
          }
        >
          {device.label}
          {device.id === settings.primaryInstallationId ? " · selected" : ""}
        </Button>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={busy || !settings?.webPublicKey}
          onClick={() =>
            user &&
            settings?.webPublicKey &&
            void run(
              () => subscribe(settings.webPublicKey!, user.id),
              "This browser is selected.",
            )
          }
        >
          Use this browser
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await reminderRequest({
                operation: "revoke",
                installationId: deviceId(),
              });
              const registration =
                await navigator.serviceWorker?.getRegistration(
                  "/fit-reminders-sw.js",
                );
              await (
                await registration?.pushManager.getSubscription()
              )?.unsubscribe();
              localStorage.removeItem(ownerKey);
            }, "This browser will no longer receive reminders.")
          }
        >
          Remove this browser
        </Button>
      </div>
      {settings && !settings.webPublicKey && (
        <p className="text-sm">
          Browser delivery is not configured yet. Select a registered phone to
          use native reminders.
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
