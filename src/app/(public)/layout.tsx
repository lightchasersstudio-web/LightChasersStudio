import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { SiteMessenger } from "@/components/public/site-messenger";
import { SiteBookBar, SiteWorkshop } from "@/components/public/site-workshop";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <SiteBookBar />
      <SiteMessenger />
      <SiteWorkshop />
    </>
  );
}
