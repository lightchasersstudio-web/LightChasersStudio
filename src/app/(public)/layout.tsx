import Image from "next/image";
import Link from "next/link";

import { ThemeToggle } from "@/components/shared/theme-toggle";

// Placeholder public shell — replaced by the real header/footer in Phase 4.
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" aria-label="Light Chasers Studio home">
            <Image
              src="/brand/logo.jpg"
              alt="Light Chasers Studio"
              width={64}
              height={64}
              className="rounded-xl mix-blend-multiply dark:mix-blend-normal"
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
