"use client";

import "./globals.css";

/** Last resort when the root layout itself fails: no fonts or theme, just a way back. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  console.error(error);
  return (
    <html lang="en">
      <body className="grid min-h-svh place-items-center bg-background px-4 text-center text-foreground">
        <main>
          <h1 className="text-3xl font-semibold">Something went wrong</h1>
          <p className="mt-3 text-muted-foreground">Please try again in a moment.</p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-6 h-11 rounded-full bg-primary px-6 font-semibold text-primary-foreground"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
