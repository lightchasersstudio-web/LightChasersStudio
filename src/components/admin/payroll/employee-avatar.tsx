import { cn } from "@/lib/utils";

/** Round staff photo, or their initials. */
export function EmployeeAvatar({
  name,
  photoUrl,
  className,
}: {
  name: string;
  photoUrl: string | null;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className={cn(
        "grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-blush font-semibold text-terracotta-ink",
        className,
      )}
      aria-hidden
    >
      {photoUrl ? (
        // Signed URL of a private photo: not something next/image can optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}
