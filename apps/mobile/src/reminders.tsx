import { useAuth } from "@clerk/expo";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, Platform, Switch, Text, View } from "react-native";
import {
  defaultReminders,
  type ReminderPreferences,
  type ReminderSettings,
} from "@wardrobe/shared";
import { reminderRequest } from "@/api";
import { Panel } from "@/screen";
import { PlannerButton } from "@/planner-ui";
import { colors } from "@/theme";
const installationKey = "wardrobe-reminder-installation";
const ownerKey = "wardrobe-reminder-owner";
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
type GetToken = () => Promise<string | null>;
let deviceOperation = Promise.resolve();
function withDevice<T>(action: () => Promise<T>): Promise<T> {
  const result = deviceOperation.then(action);
  deviceOperation = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
async function clearLocalRegistration() {
  await SecureStore.deleteItemAsync(ownerKey);
  await Notifications.unregisterForNotificationsAsync().catch(() => undefined);
  await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
}
export const revokePhone = (getToken: GetToken) =>
  withDevice(() => revokePhoneNow(getToken));
const registerPhone = (getToken: GetToken, userId: string, select: boolean) =>
  withDevice(() => registerPhoneNow(getToken, userId, select));
async function installationId() {
  let id = await SecureStore.getItemAsync(installationKey);
  if (!id) {
    id = `phone_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await SecureStore.setItemAsync(installationKey, id);
  }
  return id;
}
async function revokePhoneNow(getToken: GetToken) {
  const id = await SecureStore.getItemAsync(installationKey);
  try {
    if (id)
      await reminderRequest(getToken, {
        operation: "revoke",
        installationId: id,
      });
  } finally {
    await clearLocalRegistration();
  }
}
async function registerPhoneNow(
  getToken: GetToken,
  userId: string,
  select: boolean,
) {
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("fit-reminders", {
      name: "Fit reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  let permission = await Notifications.getPermissionsAsync();
  if (select && permission.status !== "granted" && permission.canAskAgain)
    permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") {
    await revokePhoneNow(getToken);
    if (select)
      throw new Error(
        "Notifications are off. Allow them in phone settings to receive reminders.",
      );
    return;
  }
  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId)
    throw new Error("Reminders need an installed Wardrobe build.");
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const token = await Promise.race([
    Notifications.getExpoPushTokenAsync({ projectId }),
    new Promise<never>((_, reject) => {
      deadline = setTimeout(
        () =>
          reject(
            new Error(
              "Could not register this phone. Check your connection and try again.",
            ),
          ),
        15_000,
      );
    }),
  ]).finally(() => clearTimeout(deadline));
  await reminderRequest(getToken, {
    operation: "register",
    installationId: await installationId(),
    transport: "expo",
    endpoint: token.data,
    label: Platform.OS === "ios" ? "My iPhone or iPad" : "My Android phone",
    timezone: zone(),
    select,
  });
  await SecureStore.setItemAsync(ownerKey, userId);
}
export function ReminderObserver() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth({
    treatPendingAsSignedOut: false,
  });
  const router = useRouter();
  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    const refresh = () =>
      withDevice(async () => {
        const registeredOwner = await SecureStore.getItemAsync(ownerKey);
        if (!active || !registeredOwner) return;
        if (!isSignedIn || !userId || registeredOwner !== userId) {
          await clearLocalRegistration();
          return;
        }
        await registerPhoneNow(getToken, userId, false);
      });
    void refresh().catch(() => undefined);
    if (!isSignedIn || !userId)
      return () => {
        active = false;
      };
    const open = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data;
      if (
        !active ||
        data?.version !== 1 ||
        typeof data.reminderId !== "string" ||
        !/^[a-zA-Z0-9_-]{10,100}$/.test(data.reminderId)
      )
        return;
      router.push({ pathname: "/reminder", params: { id: data.reminderId } });
      void Notifications.clearLastNotificationResponseAsync();
    };
    void Notifications.getLastNotificationResponseAsync()
      .then(open)
      .catch(() => undefined);
    const responses =
      Notifications.addNotificationResponseReceivedListener(open);
    const token = Notifications.addPushTokenListener(() => {
      void refresh().catch(() => undefined);
    });
    const resume = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh().catch(() => undefined);
    });
    return () => {
      active = false;
      responses.remove();
      token.remove();
      resume.remove();
    };
  }, [isLoaded, isSignedIn, userId, getToken, router]);
  return null;
}
export function NativeReminderSettings() {
  const { getToken, userId } = useAuth();
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [prefs, setPrefs] = useState<ReminderPreferences>(
    defaultReminders(zone()),
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const value = await reminderRequest<ReminderSettings>(getToken, {
      operation: "settings",
    });
    setSettings(value);
    setPrefs(value.preferences ?? defaultReminders(zone()));
  }, [getToken]);
  useEffect(() => {
    void load().catch(() => setMessage("Could not load reminders."));
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
    <Panel>
      <Text style={{ color: colors.ink, fontWeight: "900", fontSize: 20 }}>
        Fit reminders
      </Text>
      {settings && !settings.live && (
        <Text style={{ color: colors.muted }}>
          Preview: save your choices now. Notifications will start after
          delivery is enabled.
        </Text>
      )}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ color: colors.ink, flex: 1 }}>
          Noon check-in when I have no outfit plan
        </Text>
        <Switch
          accessibilityLabel="Daily fit reminder"
          value={prefs.daily}
          onValueChange={(daily) => setPrefs({ ...prefs, daily })}
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ color: colors.ink, flex: 1 }}>
          Remind me when a planned outfit starts
        </Text>
        <Switch
          accessibilityLabel="Planned outfit reminder"
          value={prefs.planned}
          onValueChange={(planned) => setPrefs({ ...prefs, planned })}
        />
      </View>
      <Text style={{ color: colors.muted, lineHeight: 20 }}>
        Untimed plans get a noon reminder. Linking a calendar event lets
        Wardrobe check that event in the background while reminders are on. At
        least 3 hours apart; quiet from 9 pm to 9 am.
      </Text>
      <PlannerButton
        secondary
        title={`Maximum: ${prefs.dailyCap} per day · tap to change`}
        onPress={() =>
          setPrefs({ ...prefs, dailyCap: prefs.dailyCap === 2 ? 1 : 2 })
        }
      />
      <Text style={{ color: colors.muted }}>Timezone: {prefs.timezone}</Text>
      <PlannerButton
        disabled={busy || !settings}
        title={
          prefs.timezone === zone()
            ? "Save reminder preferences"
            : `Save · use ${zone()}`
        }
        onPress={() =>
          void run(
            () =>
              reminderRequest(getToken, {
                operation: "preferences",
                ...prefs,
                timezone: zone(),
                primaryInstallationId: settings?.primaryInstallationId,
              }),
            "Preferences saved.",
          )
        }
      />
      <Text style={{ color: colors.ink, fontWeight: "900" }}>
        One selected device
      </Text>
      {settings?.installations.map((device) => (
        <PlannerButton
          key={device.id}
          secondary
          title={`${device.label}${device.id === settings.primaryInstallationId ? " · selected" : ""}`}
          disabled={busy || device.id === settings.primaryInstallationId}
          onPress={() =>
            void run(
              () =>
                reminderRequest(getToken, {
                  operation: "preferences",
                  ...prefs,
                  primaryInstallationId: device.id,
                }),
              "Selected device updated.",
            )
          }
        />
      ))}
      <PlannerButton
        secondary
        title="Use this phone for reminders"
        disabled={busy || !settings}
        onPress={() =>
          userId &&
          void run(
            () => registerPhone(getToken, userId, true),
            "This phone is selected.",
          )
        }
      />
      <PlannerButton
        secondary
        title="Remove this phone"
        disabled={busy}
        onPress={() =>
          void run(
            () => revokePhone(getToken),
            "This phone will no longer receive reminders.",
          )
        }
      />
      {message ? (
        <Text accessibilityRole="alert" style={{ color: colors.muted }}>
          {message}
        </Text>
      ) : null}
    </Panel>
  );
}
export function useCaptureLease(planId?: string) {
  const { getToken } = useAuth();
  useEffect(() => {
    const renew = () => {
      void reminderRequest(getToken, {
        operation: "capture",
        active: true,
        planId,
      }).catch(() => undefined);
    };
    renew();
    const timer = setInterval(renew, 300_000);
    // The short lease bridges camera -> processing and safely expires after interruption.
    return () => clearInterval(timer);
  }, [getToken, planId]);
}
