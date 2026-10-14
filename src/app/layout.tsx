import type { Metadata } from "next";
import { Caveat, Fraunces, Nunito_Sans } from "next/font/google";

import { ThemeProvider } from "@/components/shared/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

// Brand type: Fraunces (soft serif headings), Nunito Sans (body), Caveat (handwritten accents).
const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});
const body = Nunito_Sans({ variable: "--font-body", subsets: ["latin"] });
const hand = Caveat({ variable: "--font-hand", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Light Chasers Studio",
    template: "%s · Light Chasers Studio",
  },
  description:
    "Wedding, portrait, event and product photography in Zamboanga City. Book your session online.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${hand.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          {/* Top: on phones a bottom toast would cover sticky save bars. */}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
