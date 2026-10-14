import { HeartIcon, PackageIcon, PartyPopperIcon, UsersIcon, type LucideIcon } from "lucide-react";

import { Sparkle } from "@/components/shared/sparkle";
import { cn } from "@/lib/utils";

// shortcut: illustrated placeholders, swap for real portfolio shots once Phase 3 uploads exist.
const shots: { caption: string; icon: LucideIcon; photo: string; tilt: string }[] = [
  {
    caption: "weddings",
    icon: HeartIcon,
    photo: "from-terracotta/25 to-terracotta/75",
    tilt: "-rotate-6 delay-150",
  },
  {
    caption: "portraits",
    icon: UsersIcon,
    photo: "from-sage/40 to-sage",
    tilt: "rotate-3 translate-y-8 delay-300",
  },
  {
    caption: "events",
    icon: PartyPopperIcon,
    photo: "from-terracotta/30 to-sage/70",
    tilt: "rotate-2 delay-450",
  },
  {
    caption: "products",
    icon: PackageIcon,
    photo: "from-sage/25 to-terracotta/45",
    tilt: "-rotate-3 translate-y-8 delay-600",
  },
];

/** Decorative brand panel for the login page (md and up, hidden on short landscape screens). */
export function LoginCollage() {
  return (
    <div
      aria-hidden
      className="relative hidden overflow-hidden bg-panel text-panel-foreground md:flex md:flex-col md:justify-between md:p-10 lg:p-14 [@media(max-height:640px)]:hidden"
    >
      {/* Dot grid + soft glows. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(color-mix(in_oklab,white_14%,transparent)_1px,transparent_1px)] bg-size-[20px_20px]" />
      <div className="pointer-events-none absolute -top-24 -left-24 size-80 rounded-full bg-terracotta/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -bottom-20 size-96 rounded-full bg-sage/30 blur-3xl" />

      <p className="relative flex items-center gap-2 font-script text-2xl text-sage">
        <Sparkle className="size-4 text-terracotta" />
        behind the lens
      </p>

      <div className="relative mx-auto grid w-full max-w-[min(28rem,58vh)] grid-cols-2 gap-x-6 gap-y-4 py-10 lg:gap-x-10">
        {shots.map(({ caption, icon: Icon, photo, tilt }) => (
          <figure
            key={caption}
            className={cn(
              "polaroid animate-in pb-9 transition-transform duration-500 fill-mode-both zoom-in-90 fade-in hover:scale-105 hover:rotate-0",
              tilt,
            )}
          >
            <div
              className={cn(
                "grid aspect-square place-items-center rounded-[2px] bg-linear-to-br",
                photo,
              )}
            >
              <Icon className="size-8 text-white drop-shadow lg:size-10" strokeWidth={1.5} />
            </div>
            <figcaption className="absolute inset-x-0 bottom-1.5 text-center font-script text-xl">
              {caption}
            </figcaption>
          </figure>
        ))}
        <Sparkle className="absolute top-2 left-1/2 size-5 -translate-x-1/2 text-terracotta" />
        <Sparkle className="absolute bottom-0 left-[46%] size-3 text-sage" />
      </div>

      <div className="relative">
        <h2 className="text-3xl font-semibold text-balance lg:text-4xl">
          Every session starts here.
        </h2>
        <p className="mt-3 max-w-sm text-panel-foreground/80">
          Bookings, schedules, services and your portfolio — all in one cosy little studio.
        </p>
      </div>
    </div>
  );
}
