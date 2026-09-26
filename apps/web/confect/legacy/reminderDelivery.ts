"use node";
import { v } from "convex/values";
import { internalAction } from "../../convex/_generated/server";
import { internal } from "../../convex/_generated/api";
import webPush from "web-push";

const expoHeaders = () => ({
  "Content-Type": "application/json",
  ...(process.env.EXPO_PUSH_ACCESS_TOKEN
    ? { Authorization: `Bearer ${process.env.EXPO_PUSH_ACCESS_TOKEN}` }
    : {}),
});
const message = (kind: string) => ({
  title:
    kind === "daily_fit_due"
      ? "A moment for your fit?"
      : "Time for a fit check",
  body: "Capture what you're wearing today.",
});
export const deliver = internalAction({
  args: { id: v.id("notificationIntents"), scheduleRevision: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const attemptId = await ctx.runMutation(internal.reminders.claim, args);
    if (!attemptId) return null;
    const target = await ctx.runQuery(internal.reminders.submission, {
      attemptId,
    });
    if (!target) {
      await ctx.runMutation(internal.reminders.finish, {
        attemptId,
        outcome: "definite_rejection",
        errorKind: "state_changed",
      });
      return null;
    }
    const payload = {
      version: 1,
      reminderId: target.reminderId,
      expiresAt: target.expiresAt,
    };
    try {
      if (target.transport === "expo") {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: expoHeaders(),
          body: JSON.stringify({
            to: target.endpoint,
            ...message(target.kind),
            data: payload,
            channelId: "fit-reminders",
            expiration: Math.floor(target.expiresAt / 1000),
            sound: "default",
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
          await ctx.runMutation(internal.reminders.finish, {
            attemptId,
            outcome: response.status >= 500 ? "unknown" : "definite_rejection",
            errorKind:
              response.status === 429 ? "provider_rate_limit" : "provider_http",
          });
          return null;
        }
        const body = (await response.json()) as {
          data?: { status?: string; id?: string; details?: { error?: string } };
        };
        if (body.data?.status === "ok" && body.data.id)
          await ctx.runMutation(internal.reminders.finish, {
            attemptId,
            outcome: "provider_accepted",
            ticket: body.data.id,
          });
        else if (body.data?.status === "error")
          await ctx.runMutation(internal.reminders.finish, {
            attemptId,
            outcome: "definite_rejection",
            errorKind:
              body.data.details?.error === "DeviceNotRegistered"
                ? "device_unregistered"
                : "provider_rejected",
          });
        else
          await ctx.runMutation(internal.reminders.finish, {
            attemptId,
            outcome: "unknown",
            errorKind: "provider_response_unknown",
          });
      } else {
        const publicKey = process.env.WEB_PUSH_PUBLIC_KEY,
          privateKey = process.env.WEB_PUSH_PRIVATE_KEY,
          subject = process.env.WEB_PUSH_SUBJECT;
        if (
          !publicKey ||
          !privateKey ||
          !subject ||
          !target.p256dh ||
          !target.auth
        ) {
          await ctx.runMutation(internal.reminders.finish, {
            attemptId,
            outcome: "definite_rejection",
            errorKind: "transport_unconfigured",
          });
          return null;
        }
        await webPush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          },
          JSON.stringify({ ...payload, ...message(target.kind) }),
          {
            TTL: Math.max(
              0,
              Math.floor((target.expiresAt - Date.now()) / 1000),
            ),
            topic: target.reminderId.slice(-32),
            timeout: 15_000,
            vapidDetails: { subject, publicKey, privateKey },
          },
        );
        await ctx.runMutation(internal.reminders.finish, {
          attemptId,
          outcome: "provider_accepted",
        });
      }
    } catch (error) {
      const status =
        error && typeof error === "object" && "statusCode" in error
          ? Number(error.statusCode)
          : undefined;
      await ctx.runMutation(internal.reminders.finish, {
        attemptId,
        outcome:
          status && status >= 400 && status < 500
            ? "definite_rejection"
            : "unknown",
        errorKind:
          status === 404 || status === 410
            ? "device_unregistered"
            : "provider_unknown",
      });
    }
    return null;
  },
});
export const receipt = internalAction({
  args: { attemptId: v.id("notificationAttempts") },
  returns: v.null(),
  handler: async (ctx, { attemptId }): Promise<null> => {
    const attempt = await ctx.runMutation(internal.reminders.receiptAttempt, {
      attemptId,
    });
    if (!attempt) return null;
    try {
      const response = await fetch(
        "https://exp.host/--/api/v2/push/getReceipts",
        {
          method: "POST",
          headers: expoHeaders(),
          body: JSON.stringify({ ids: [attempt.ticket] }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!response.ok) return null;
      const result = (await response.json()) as {
        data?: Record<
          string,
          { status?: string; details?: { error?: string } }
        >;
      };
      const receipt = result.data?.[attempt.ticket];
      if (receipt?.status === "ok")
        await ctx.runMutation(internal.reminders.finish, {
          attemptId,
          outcome: "provider_handoff",
        });
      if (receipt?.status === "error")
        await ctx.runMutation(internal.reminders.finish, {
          attemptId,
          outcome: "definite_rejection",
          errorKind:
            receipt.details?.error === "DeviceNotRegistered"
              ? "device_unregistered"
              : "provider_receipt_error",
        });
    } catch {
      /* Missing receipt never authorizes resubmission. Bounded checks are already scheduled. */
    }
    return null;
  },
});
export const refreshCalendar = internalAction({
  args: { planId: v.id("outfitSuggestions") },
  returns: v.null(),
  handler: async (ctx, { planId }): Promise<null> => {
    const source = await ctx.runQuery(internal.reminders.calendarSource, {
      planId,
    });
    if (!source || !process.env.CLERK_SECRET_KEY) return null;
    try {
      const tokens = await fetch(
        `https://api.clerk.com/v1/users/${encodeURIComponent(source.userId)}/oauth_access_tokens/oauth_google?paginated=true`,
        {
          headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!tokens.ok) return null;
      const entries = (await tokens.json()) as { data?: { token?: string }[] };
      const token = entries.data?.[0]?.token;
      if (!token) return null;
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(source.calendarId)}/events/${encodeURIComponent(source.eventId)}?fields=id,status,start,end`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (response.status === 404 || response.status === 410) {
        await ctx.runMutation(internal.reminders.calendarResult, {
          planId,
          revision: source.revision,
          active: false,
        });
        return null;
      }
      if (!response.ok) return null;
      const event = (await response.json()) as {
        status?: string;
        start?: { dateTime?: string };
        end?: { dateTime?: string };
      };
      const startsAt = event.start?.dateTime
        ? Date.parse(event.start.dateTime)
        : undefined;
      const endsAt = event.end?.dateTime
        ? Date.parse(event.end.dateTime)
        : undefined;
      const active =
        event.status !== "cancelled" &&
        startsAt !== undefined &&
        Number.isFinite(startsAt) &&
        (endsAt === undefined ||
          (Number.isFinite(endsAt) && endsAt > startsAt));
      await ctx.runMutation(internal.reminders.calendarResult, {
        planId,
        revision: source.revision,
        active,
        ...(active ? { startsAt, endsAt } : {}),
      });
    } catch {
      /* Keep last known state; the freshness gate prevents stale sends. */
    }
    return null;
  },
});
