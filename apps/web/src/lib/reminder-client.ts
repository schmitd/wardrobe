import type { ReminderOperation } from "@wardrobe/shared";
export async function reminderRequest<T>(
  operation: ReminderOperation,
): Promise<T> {
  const response = await fetch("/api/reminders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(operation),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "Could not update reminders.");
  return data;
}
