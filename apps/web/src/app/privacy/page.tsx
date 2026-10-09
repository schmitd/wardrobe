import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Privacy | Lint' };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-10 pb-32">
      <h1 className="text-3xl font-bold">Lint privacy</h1>
      <p>Updated October 9, 2026. Lint (formerly Wardrobe) is a beta closet and outfit planner operated by David Schmitt.</p>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">Your closet and suggestions</h2>
        <p>We use your account details, photos, clothing descriptions, style notes, plans, outfit history, and feedback to run Lint. Relevant photos and text go to OpenAI for analysis and recommendations, Google Gemini for search embeddings, and Zep for style memory. Voice recordings you choose to transcribe go to OpenAI; Lint handles that audio temporarily rather than saving it in your closet.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">Optional Calendar and weather</h2>
        <p>Google sign-in alone does not connect Calendar. Connecting gives Lint read-only access to the calendars you choose. We read event titles and times to show your week, and titles, times, and locations for requested or automatic outfit planning. That planning context goes to OpenAI. We do not read event descriptions or attendees, or change your Google events.</p>
        <p>Clerk handles Google access tokens on our server. Lint saves your calendar selection and settings, not raw event responses. Saved outfit explanations can include event context. Disconnecting stops further reads and deletes saved calendar-derived outfits, including planned and worn entries, after confirmation. Other closet data remains. You can also revoke Google access in <a className="underline" href="https://myaccount.google.com/connections">Google Account connections</a>.</p>
        <p>Calendar and weather are optional. If you include weather, our server requests a forecast from MET Norway using approximate city coordinates. Device location requested while planning, when you allow it, is matched to a supported city on your device; raw device coordinates are not sent to our server. The forecast provider does not receive your account or closet.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">Services and usage tracking</h2>
        <p>Clerk manages accounts, Convex stores app data and uploads, and Vercel hosts the web app. PostHog collects usage activity and errors, and receives account ID, email, and name on the web. Web session replay is configured to mask text and inputs and block private media. The mobile app has an analytics switch in Account. Axiom receives operational logs and AI-operation metrics. These services process data for their roles under their own terms.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">Keeping and deleting data</h2>
        <p>Saved closet data stays available for your ongoing use. Lint keeps up to 100 outfit recommendations. You can delete pieces in the app; deleting your account starts cleanup of app data and style memory. For help with access, correction, or deletion, email <a className="underline" href="mailto:davidschmittgit@gmail.com">davidschmittgit@gmail.com</a>. Provider logs and backups have separate retention schedules, so deletion does not mean immediate removal from every backup.</p>
        <p>We will update this page and its date when our practices change. Check it for material changes.</p>
      </section>
      <Link href="/" className="inline-block underline">Back to Lint</Link>
    </main>
  );
}
