"use client";
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section
      className="rack-panel space-y-3 p-5"
      aria-label="Diary unavailable"
    >
      <h2 className="text-base font-bold">Diary</h2>
      <p role="alert">Your diary could not load. Please try again.</p>
      <button
        type="button"
        className="min-h-11 border border-current px-4 font-semibold"
        onClick={reset}
      >
        Retry diary
      </button>
    </section>
  );
}
