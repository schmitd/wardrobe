import { SignedIn, SignedOut } from "@clerk/nextjs";
import ReminderSettings from "@/components/ReminderSettings";
export default function RemindersPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-28">
      <SignedIn>
        <ReminderSettings />
      </SignedIn>
      <SignedOut>
        <p>Sign in to manage fit reminders.</p>
      </SignedOut>
    </main>
  );
}
