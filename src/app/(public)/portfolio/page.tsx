import type { Metadata } from "next";

import { BookCta } from "@/components/public/book-cta";
import { PortfolioGallery } from "@/components/public/portfolio-gallery";
import { SectionHeading } from "@/components/public/section-heading";
import { listPortfolio } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Weddings, portraits, events and product photography by Light Chasers Studio.",
};

export default async function PortfolioPage() {
  const photos = await listPortfolio();

  return (
    <>
      <section className="bg-studio">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <SectionHeading
            as="h1"
            eyebrow="our work"
            title="Portfolio"
            description="A few of our favourite frames. Tap any photo to see it larger."
          />
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <PortfolioGallery photos={photos} />
      </div>
      <BookCta title="Love what you see?" />
    </>
  );
}
