import { MobileBookBar } from "@/components/public/mobile-book-bar";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { SiteMessenger } from "@/components/public/site-messenger";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <MobileBookBar />
      <SiteMessenger />
    </>
  );
}
