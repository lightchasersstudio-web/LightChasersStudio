import { Sparkle } from "@/components/shared/sparkle";

export default function HomePage() {
  return (
    <section className="bg-studio">
      <div className="mx-auto max-w-6xl px-4 py-24 md:py-32">
        <p className="flex items-center gap-2 font-script text-2xl text-terracotta-ink">
          <Sparkle className="size-3.5 text-terracotta" />
          chasing the light in Zamboanga City
        </p>
        <h1 className="mt-3 max-w-3xl text-5xl font-semibold md:text-6xl">Light Chasers Studio</h1>
        <p className="mt-5 max-w-prose text-lg text-muted-foreground">
          Weddings &amp; prenup, portraits &amp; family, events and product photography. The full
          site and online booking are coming soon.
        </p>
      </div>
    </section>
  );
}
