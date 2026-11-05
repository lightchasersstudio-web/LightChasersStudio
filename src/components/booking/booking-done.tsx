"use client";

import {
  ArrowRightIcon,
  BookOpenIcon,
  CheckIcon,
  CopyIcon,
  ImageDownIcon,
  ImagesIcon,
  MailCheckIcon,
  MessageCircleHeartIcon,
  SearchIcon,
  Share2Icon,
  SparklesIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { AddToCalendar, useRememberedBooking } from "@/components/booking/add-to-calendar";
import { drawBookingPass } from "@/components/booking/booking-pass-image";
import { saveBookingOnDevice } from "@/components/booking/saved-bookings";
import { Sparkle } from "@/components/shared/sparkle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatBookingWhen } from "@/lib/booking/booking-summary";
import { cn } from "@/lib/utils";

type SaveMethod = "copied" | "image" | "shared" | "calendar" | "ticked";

const NEXT_STEPS = [
  {
    Icon: MailCheckIcon,
    title: "Check your inbox",
    text: "Your booking details are on their way by email. Not there in a few minutes? Look in Spam or Promotions.",
  },
  {
    Icon: UserRoundCheckIcon,
    title: "We confirm your session",
    text: "We review every booking and get in touch to confirm. Your booking page always shows the latest status.",
  },
  {
    Icon: SparklesIcon,
    title: "Get ready, then say cheese!",
    text: "Read our short prep guide so you arrive relaxed and camera-ready.",
  },
];

const noop = () => () => {};
const canShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

/**
 * The thank-you page body: a booking pass with the reference and ways to keep it
 * (copy, save as image, share, add to calendar), what happens next, and where to
 * go from here. Leaving before saving the reference asks once.
 */
export function BookingDone({ reference, studioName }: { reference: string; studioName: string }) {
  const router = useRouter();
  const event = useRememberedBooking(reference);
  const shareable = useSyncExternalStore(noop, canShare, () => false);
  const [saved, setSaved] = useState<SaveMethod | null>(null);
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
  }, [saved]);

  const when = event ? formatBookingWhen(event.startAt, event.endAt) : null;
  const packageName = event?.title.split(" · ")[0] ?? null;

  // Remember it in this browser so "Find your booking" on the home page offers it.
  useEffect(() => {
    saveBookingOnDevice({ reference, title: packageName, startAt: event?.startAt ?? null });
  }, [reference, packageName, event?.startAt]);

  // Ask once before following a link away from here while the reference isn't saved.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (savedRef.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname)
        return;
      e.preventDefault();
      setLeavingTo(url.pathname + url.search + url.hash);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const lookupUrl = () => `${window.location.origin}/booking`;
  const shareText = () =>
    [
      `My ${studioName} booking reference: ${reference}`,
      packageName,
      when,
      `Look it up with my email at ${lookupUrl()}?ref=${reference}`,
    ]
      .filter(Boolean)
      .join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference);
      setSaved("copied");
      toast.success("Reference copied. Paste it somewhere safe, like your notes.");
      return true;
    } catch {
      toast.error("Couldn't copy. Please write it down or take a screenshot.");
      return false;
    }
  }

  async function saveImage() {
    setBusy(true);
    try {
      const blob = await drawBookingPass({
        reference,
        studioName,
        title: packageName,
        when,
        location: event?.location ?? null,
        lookupUrl: lookupUrl().replace(/^https?:\/\//, ""),
      });
      const file = new File([blob], `${reference}.png`, { type: "image/png" });
      // Phones: the share sheet has "Save image" (to Photos). Elsewhere: download.
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: `Booking ${reference}` });
          setSaved("image");
          return;
        } catch (error) {
          if ((error as DOMException).name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      setSaved("image");
      toast.success("Booking pass saved to your downloads.");
    } catch (error) {
      console.error("[saveImage]", error);
      toast.error("Couldn't make the image. Please take a screenshot instead.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: `Booking ${reference}`, text: shareText() });
      setSaved("shared");
    } catch {
      // Closed the share sheet: nothing to do.
    }
  }

  function leave(markSaved: boolean) {
    const href = leavingTo;
    setLeavingTo(null);
    if (markSaved) setSaved("ticked");
    if (href) {
      savedRef.current = "ticked"; // let this navigation through
      router.push(href);
    }
  }

  return (
    <div className="mt-10 space-y-12 text-left">
      {/* Booking pass */}
      <article
        aria-label={`Booking ${reference}`}
        className="relative mx-auto w-full max-w-md overflow-hidden rounded-[1.75rem] border bg-card shadow-xl"
      >
        <header className="relative bg-panel px-6 pt-6 pb-9 text-panel-foreground">
          <Sparkle className="absolute top-5 right-6 size-6 text-terracotta" />
          <p className="text-xs font-bold tracking-wider uppercase opacity-85">
            Your booking reference
          </p>
          <div className="mt-1 flex items-center gap-2">
            <p className="font-heading text-[1.6rem] font-semibold tracking-wide whitespace-nowrap select-all min-[400px]:text-3xl sm:text-4xl">
              {reference}
            </p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={copy}
              className="text-panel-foreground hover:bg-white/15 hover:text-panel-foreground"
              aria-label="Copy booking reference"
            >
              {saved === "copied" ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
            </Button>
          </div>
        </header>
        {/* Ticket perforation */}
        <div aria-hidden className="relative -mt-4 h-8 rounded-t-[1.75rem] bg-card">
          <span className="absolute top-1/2 -left-4 size-8 -translate-y-1/2 rounded-full border bg-background" />
          <span className="absolute top-1/2 -right-4 size-8 -translate-y-1/2 rounded-full border bg-background" />
          <span className="absolute inset-x-6 top-1/2 border-t-2 border-dashed border-border" />
        </div>
        <div className="space-y-5 px-6 pb-6">
          {event && (
            <dl className="grid gap-3 text-sm">
              {packageName && <PassRow label="Package" value={packageName} />}
              {when && <PassRow label="When" value={when} />}
              {event.location && <PassRow label="Where" value={event.location} />}
            </dl>
          )}

          <div
            role="status"
            className={cn(
              "rounded-2xl px-4 py-3 text-sm transition-colors",
              saved ? "bg-sage/25" : "bg-blush text-foreground",
            )}
          >
            {saved ? (
              <p className="flex items-start gap-2 font-semibold">
                <CheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                Saved! You can find this booking any time with the reference and your email.
              </p>
            ) : (
              <p>
                <strong>Save this reference before you go.</strong> You&apos;ll need it with your
                email to look up your booking. We&apos;ve also emailed it to you.
              </p>
            )}
          </div>

          <div className={cn("grid gap-2", shareable ? "grid-cols-3" : "grid-cols-2")}>
            <SaveButton onClick={copy} Icon={CopyIcon} label="Copy" done={saved === "copied"} />
            <SaveButton
              onClick={saveImage}
              Icon={ImageDownIcon}
              label="Save image"
              done={saved === "image"}
              disabled={busy}
            />
            {shareable && (
              <SaveButton
                onClick={share}
                Icon={Share2Icon}
                label="Send to me"
                done={saved === "shared"}
              />
            )}
          </div>

          {!saved && (
            <label className="flex cursor-pointer items-center gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                onChange={(e) => e.target.checked && setSaved("ticked")}
              />
              I&apos;ve written it down or taken a screenshot
            </label>
          )}
        </div>
      </article>

      {event && (
        <div className="text-center">
          <p className="mb-3 text-sm font-semibold">Pop it in your calendar</p>
          <AddToCalendar event={event} onAdded={() => setSaved((s) => s ?? "calendar")} />
        </div>
      )}

      {/* What happens next */}
      <section aria-labelledby="next-steps">
        <h2
          id="next-steps"
          className="flex items-center justify-center gap-2 text-center font-script text-2xl text-terracotta-ink"
        >
          <Sparkle className="size-3.5 text-terracotta" />
          what happens next
        </h2>
        <ol className="mt-5 space-y-3">
          {NEXT_STEPS.map(({ Icon, title, text }, i) => (
            <li key={title} className="flex gap-4 rounded-3xl border bg-card p-4 sm:p-5">
              <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <Icon className="size-5" aria-hidden />
                <span className="absolute -top-1 -right-1 grid size-6 place-items-center rounded-full bg-terracotta font-heading text-xs font-semibold text-white ring-2 ring-card">
                  {i + 1}
                </span>
              </span>
              <div>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Where to go from here */}
      <nav aria-label="Next steps" className="grid gap-3 sm:grid-cols-2">
        <NextLink
          href={`/booking?ref=${reference}`}
          Icon={SearchIcon}
          title="View your booking"
          text="Status, payment and details"
          primary
        />
        <NextLink
          href="/prepare"
          Icon={BookOpenIcon}
          title="How to prepare"
          text="Outfits, timing and tips"
        />
        <NextLink
          href="/contact"
          Icon={MessageCircleHeartIcon}
          title="Questions? Message us"
          text="We're happy to help"
        />
        <NextLink
          href="/portfolio"
          Icon={ImagesIcon}
          title="Get inspired"
          text="Browse our recent work"
        />
      </nav>
      <p className="text-center">
        <Button asChild variant="link">
          <Link href="/">Back to home</Link>
        </Button>
      </p>

      <AlertDialog open={leavingTo !== null} onOpenChange={(open) => !open && setLeavingTo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Saved your booking reference?</AlertDialogTitle>
            <AlertDialogDescription>
              Keep <strong className="text-foreground">{reference}</strong> somewhere safe. With
              your email, it&apos;s how you look up your booking later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay here</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                leave(true);
              }}
            >
              I&apos;ve saved it
            </AlertDialogAction>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                if (await copy()) leave(true);
              }}
            >
              <CopyIcon aria-hidden />
              Copy &amp; continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PassRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold tracking-wider text-muted-foreground uppercase">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function SaveButton({
  onClick,
  Icon,
  label,
  done,
  disabled,
}: {
  onClick: () => void;
  Icon: typeof CopyIcon;
  label: string;
  done: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={done ? "secondary" : "outline"}
      onClick={onClick}
      disabled={disabled}
      className="h-auto flex-col gap-1 rounded-2xl py-3 text-xs"
    >
      {done ? (
        <CheckIcon className="size-5" aria-hidden />
      ) : (
        <Icon className="size-5" aria-hidden />
      )}
      {label}
    </Button>
  );
}

function NextLink({
  href,
  Icon,
  title,
  text,
  primary,
}: {
  href: string;
  Icon: typeof CopyIcon;
  title: string;
  text: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-4 rounded-3xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        primary
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card hover:border-terracotta",
      )}
    >
      <span
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full",
          primary ? "bg-white/15" : "bg-accent text-accent-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className={cn("block text-sm", primary ? "opacity-85" : "text-muted-foreground")}>
          {text}
        </span>
      </span>
      <ArrowRightIcon
        className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
