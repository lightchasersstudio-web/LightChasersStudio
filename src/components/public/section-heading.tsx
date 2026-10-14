import { Sparkle } from "@/components/shared/sparkle";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  as: Tag = "h2",
  align = "left",
  id,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  as?: "h1" | "h2";
  align?: "left" | "center";
  id?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && (
        <p
          className={cn(
            "flex items-center gap-2 font-script text-2xl text-terracotta-ink",
            align === "center" && "justify-center",
          )}
        >
          <Sparkle className="size-3.5 text-terracotta" />
          {eyebrow}
        </p>
      )}
      <Tag
        id={id}
        className={cn(
          "mt-1 font-semibold",
          Tag === "h1" ? "text-4xl sm:text-5xl md:text-6xl" : "text-3xl sm:text-4xl",
        )}
      >
        {title}
      </Tag>
      {description && <p className="mt-4 text-lg text-muted-foreground">{description}</p>}
    </div>
  );
}
