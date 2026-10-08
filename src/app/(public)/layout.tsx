import Image from "next/image";
import Link from "next/link";

import { ThemeToggle } from "@/components/shared/theme-toggle";

// Placeholder public shell — replaced by the real header/footer in Phase 4.
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" aria-label="Light Chasers Studio home">
            <Image
              src="/brand/logo.jpg"
              alt="Light Chasers Studio"
              width={64}
              height={64}
              priority
            />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
    </>
  );
}
