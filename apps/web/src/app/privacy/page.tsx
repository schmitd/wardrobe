import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy | Wardrobe" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-10 pb-32">
      <h1 className="text-3xl font-bold">Wardrobe privacy</h1>
      <p>Updated September 26, 2026. Wardrobe is a beta closet and outfit-planning application operated by David Schmitt.</p>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">What Wardrobe processes</h2>
        <p>Wardrobe processes your account identity, uploaded photos, clothing descriptions, style notes, saved plans, outfit history, and feedback to provide the features you request. Photos and relevant style context may be sent to AI services for garment analysis and recommendations. Review suggestions before relying on them.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">Optional Google Calendar connection</h2>
        <p>Google sign-in alone does not grant calendar access. If you choose to connect Calendar, Wardrobe requests read-only access to your calendar list and events so you can select calendars and request an outfit for a particular day. Wardrobe does not create, change, or delete Google Calendar events.</p>
        <p>Opening a week reads event titles and times from your selected calendars for display. When you explicitly include Calendar in an outfit request, Wardrobe also uses event locations for the reviewed dates, up to seven days per request. It does not request attendee lists or event descriptions. Outfit-request context is sent to OpenAI to generate your personalized recommendations. Do not include a calendar whose contents you do not want processed for that purpose.</p>
        <p>Google access tokens are handled server-side through Clerk. Selected calendar identifiers and connection settings are stored in Wardrobe. Raw event responses are not saved to the Wardrobe database or Zep style memory. If you explicitly link an event to an outfit reminder, Wardrobe stores its identifiers and start/end times and checks that event in the background while planned reminders are enabled. Disconnecting Calendar removes those links. Generated outfit explanations can reflect event context and are saved with your recommendations. Calendar contents and identifiers are excluded from product analytics and session replay.</p>
        <p>Disconnecting Calendar in Wardrobe stops further reads and removes unaccepted calendar suggestions. Outfits you accepted and evidence of what you wore remain in your history; they are not treated as raw calendar records. This leaves your other wardrobe data and Google sign-in intact. You may separately revoke access for Wardrobe in your <a className="underline" href="https://myaccount.google.com/connections">Google Account connections</a>.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">Optional reminders and image sharing</h2>
        <p>Reminders are opt-in and go to one selected device. Wardrobe stores notification preferences and the device token or browser subscription needed for delivery. Expo and Apple/Google push services, or your browser push service, receive generic notification text and an opaque reminder identifier, not your photo or calendar title. Delivery attempts and expired reminder records are removed after 30 days; revoked device registrations after 30 days and inactive registrations after 90 days. You can turn reminders off or remove a device in reminder settings.</p>
        <p>Sharing prepares a private copy of your photo with orientation applied and embedded metadata removed. Wardrobe hands the image to the operating system, clipboard, or a download you choose. It does not publish a photo link or collect recipients. Native temporary share files are cleaned up on the next app start or share after 24 hours, and on sign-out. Copies you send to other apps follow those apps’ privacy practices.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">Voice input</h2>
        <p>Recording starts only when you choose Dictate and grant microphone permission. Recordings are limited to 60 seconds. Choosing Transcribe sends the recording to OpenAI; you can edit the resulting text before requesting an outfit. Wardrobe handles audio in server memory rather than storing it in its database or style memory, and deletes its temporary native recording file after use or cancellation.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">Analytics and reliability</h2>
        <p>PostHog receives bounded usage events and sanitized errors to help improve the app. Where session replay is enabled, media and input masking is applied; private photos, style notes, calendar content, and credentials are excluded. Native replay is disabled until its platform masking checks are verified. You can disable optional analytics in the app privacy controls. Essential server reliability logs remain enabled in Axiom.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">Service providers and retention</h2>
        <p>Wardrobe uses Clerk for authentication, Convex for application data and uploaded files, Vercel for web hosting, OpenAI for text, vision, and audio processing, Google Gemini for direct image and text embeddings, Zep for style memory, and PostHog and Axiom for observability. These providers process information needed for their respective functions under their own service terms. Wardrobe does not sell your personal data.</p>
        <p>Saved wardrobe data supports your ongoing use of the app. Older unaccepted recommendations may be removed. Accepted plans and recorded wear remain in your history, including plans you have not yet confirmed. You can delete pieces and request account-data deletion through the app or the contact below. Provider logs and backups may follow separate retention schedules; deletion is not a promise of immediate erasure from every backup.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">Questions and requests</h2>
        <p>Contact <a className="underline" href="mailto:davidschmittgit@gmail.com">davidschmittgit@gmail.com</a> about privacy, access, correction, or deletion. This notice will be updated when data practices change.</p>
      </section>
      <Link href="/" className="inline-block underline">Back to Wardrobe</Link>
    </main>
  );
}
