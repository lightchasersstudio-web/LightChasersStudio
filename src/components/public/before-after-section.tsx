import { BeforeAfterSlider } from "@/components/public/before-after-slider";
import { SectionHeading } from "@/components/public/section-heading";
import { Reveal, RevealItem, RevealList } from "@/components/shared/reveal";
import { BEFORE_AFTER } from "@/content/before-after";
import { publicImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { PublicPhoto } from "@/server/queries/public";

const PREVIEW = process.env.NODE_ENV === "development";

/**
 * "The magic of editing": before/after pairs from `src/content/before-after.ts`.
 * Hidden on the live site until there's a real pair; in development a clearly
 * labelled sample (one photo with a dull filter as the "before") shows instead.
 */
export function BeforeAfterSection({
  samplePhoto,
  className,
}: {
  samplePhoto?: PublicPhoto;
  className?: string;
}) {
  const sample = BEFORE_AFTER.length === 0 && PREVIEW && samplePhoto;
  if (BEFORE_AFTER.length === 0 && !sample) return null;

  const pairs = sample
    ? [
        {
          before: publicImageUrl("portfolio", samplePhoto.storage_path),
          after: publicImageUrl("portfolio", samplePhoto.storage_path),
          width: samplePhoto.width ?? 1200,
          height: samplePhoto.height ?? 900,
          alt: samplePhoto.alt_text,
          caption: "Sample only",
        },
      ]
    : BEFORE_AFTER;

  return (
    <section
      aria-labelledby="before-after"
      className={cn("mx-auto max-w-6xl px-4 py-20 sm:px-6", className)}
    >
      <Reveal>
        <SectionHeading
          id="before-after"
          eyebrow="the magic of editing"
          title="Before & after"
          description="Drag the slider to see how we bring out the colour, light and mood in every photo."
          align="center"
        />
        {sample && (
          <p className="mx-auto mt-4 w-fit max-w-full rounded-full border border-dashed border-terracotta/60 bg-blush/60 px-4 py-1.5 text-center text-sm">
            <strong>Sample</strong> (only you can see this). Add your real before/after photos in{" "}
            <code className="font-mono text-xs">src/content/before-after.ts</code>.
          </p>
        )}
      </Reveal>
      <RevealList
        className={cn(
          "mx-auto mt-10 grid gap-8",
          pairs.length > 1 ? "md:grid-cols-2" : "max-w-3xl",
        )}
      >
        {pairs.map((pair) => (
          <RevealItem key={pair.after}>
            <figure>
              <BeforeAfterSlider
                {...pair}
                beforeClassName={
                  sample ? "brightness-90 contrast-75 grayscale-[35%] saturate-50" : undefined
                }
              />
              {pair.caption && (
                <figcaption className="mt-3 text-center font-script text-xl text-terracotta-ink">
                  {pair.caption}
                </figcaption>
              )}
            </figure>
          </RevealItem>
        ))}
      </RevealList>
    </section>
  );
}
