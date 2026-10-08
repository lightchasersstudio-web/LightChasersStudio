import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Light Chasers Studio" },
  robots: { index: false, follow: false },
};

// Wraps both the login page and the protected area; the auth gate lives in (protected)/layout.tsx.
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
