import Image from "next/image";
import { Leaderboard } from "@/components/leaderboard/leaderboard";
import { TrainActivity } from "@/components/discovery/train-activity";
import { AnnouncementPopup } from "@/components/discovery/announcement-popup";

const STEPS = [
  {
    number: "01",
    title: "Build the schedule",
    body: "Set your date, slot length, and rules — the wizard generates every timezone-correct slot for you in seconds.",
  },
  {
    number: "02",
    title: "Sellers claim slots",
    body: "Open signup, require approval, or invite-only — sellers hold a slot, apply, and get confirmed with zero double-bookings.",
  },
  {
    number: "03",
    title: "Run it live",
    body: "Drag-and-drop reordering, check-in tracking, and automatic reminders keep the lineup moving without the group-chat chaos.",
  },
];

const FEATURES = [
  {
    title: "Zero double-booked slots",
    body: "Slot claims are race-safe at the database level — two sellers clicking the same slot at once can't both win it.",
  },
  {
    title: "Reminders that actually send",
    body: "24-hour, 2-hour, and check-in-opened emails go out automatically so you're not the one chasing sellers at 11pm.",
  },
  {
    title: "A schedule sellers can trust",
    body: "Public train pages show live status, up-next countdowns, and open slots in real time — no more \"is this still open?\" DMs.",
  },
  {
    title: "Waitlists that fill themselves",
    body: "When a seller cancels, the next person in line gets offered the slot automatically, with a countdown to respond.",
  },
];

const DISCORD_SERVERS = [
  {
    name: "Raid Train Conductor",
    description: "The main community server — every train, every seller.",
    href: "https://discord.gg/JgkMgfzGq",
    image: "/discord/raid-train-conductor-logo.png",
  },
  {
    name: "PenBattles.com",
    description: "The niche server for Pen Battles trains.",
    href: "https://discord.gg/Bmj6afhbN",
    image: "/discord/pen-battles-logo.png",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <AnnouncementPopup />
      <section className="relative overflow-hidden bg-hero-mesh px-6 pb-24 pt-20 sm:pt-28">
        <div className="mx-auto flex max-w-6xl flex-col items-center text-center">
          <span className="animate-fade-up rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-white/80 backdrop-blur">
            Built for Whatnot raid trains
          </span>

          <h1
            className="mt-6 animate-fade-up font-display text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
            style={{ animationDelay: "80ms" }}
          >
            Run your raid train
            <br />
            like it&apos;s <span className="text-gradient">the main event</span>
          </h1>

          <p
            className="mt-6 max-w-2xl animate-fade-up text-lg text-white/70 sm:text-xl"
            style={{ animationDelay: "160ms" }}
          >
            Build the schedule, fill every slot, and keep sellers checked in and on time —
            all from one link you can drop straight in your Whatnot show or Discord.
          </p>

          <div
            className="mt-10 flex animate-fade-up flex-wrap items-center justify-center gap-4"
            style={{ animationDelay: "240ms" }}
          >
            {/* Signups temporarily disabled -- was <Link href="/register?role=organizer">, swap back when re-enabling. */}
            <span
              aria-disabled="true"
              className="glow-accent pointer-events-none cursor-not-allowed rounded-md bg-accent px-6 py-3.5 font-display text-base font-semibold text-accent-foreground opacity-40"
            >
              Organize a Raid Train
            </span>
            <span
              aria-disabled="true"
              className="pointer-events-none cursor-not-allowed rounded-md border border-white/20 bg-white/5 px-6 py-3.5 font-display text-base font-semibold text-white opacity-40 backdrop-blur"
            >
              Join a Raid Train
            </span>
          </div>
        </div>

        <div
          className="pointer-events-none absolute -bottom-10 left-1/2 hidden w-full max-w-3xl -translate-x-1/2 animate-float px-6 sm:block"
          aria-hidden="true"
        >
          <div className="glow-primary rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs font-medium text-white/60">
              <span>Saturday night sneaker train</span>
              <span className="flex items-center gap-1.5 text-white">
                <span className="h-2 w-2 animate-pulse-glow rounded-full bg-destructive" />
                Live now
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {["@kickscentral", "@resale_ry", "@heat_check_hq"].map((seller, i) => (
                <div
                  key={seller}
                  className={`rounded-md border px-3 py-2 text-left text-xs ${
                    i === 0
                      ? "border-electric/40 bg-electric/10 text-white"
                      : "border-white/10 bg-white/5 text-white/60"
                  }`}
                >
                  <p className="font-medium">{seller}</p>
                  <p className="mt-0.5 text-[11px] opacity-80">{i === 0 ? "On now" : `Slot ${i + 1}`}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <TrainActivity />

      <section className="mx-auto max-w-7xl px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            From empty calendar to sold-out lineup
          </h2>
          <p className="mt-3 text-muted-foreground">
            Three steps, no spreadsheets, no pinned messages nobody reads.
          </p>
        </div>

        <div className="mt-14 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.number} className="relative">
              <span className="font-display text-5xl font-bold text-primary/15">{step.number}</span>
              <h3 className="mt-2 font-display text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted/50 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Everything a raid train actually needs
            </h2>
            <p className="mt-3 text-muted-foreground">
              Not a generic calendar tool — built around slot claims, waitlists, and live show day.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-md"
              >
                <h3 className="font-display text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Temporarily hidden while the Discord servers are still being finished. Flip back on by changing false to true below. */}
      {false && (
      <section className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Join the community
          </h2>
          <p className="mt-3 text-muted-foreground">
            Hop into Discord for schedules, announcements, and raid train chatter.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {DISCORD_SERVERS.map((server) => (
            <a
              key={server.name}
              href={server.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <Image
                src={server.image}
                alt={`${server.name} Discord icon`}
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-full object-cover"
              />
              <div className="text-left">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Join our Discord
                </p>
                <p className="font-display text-lg font-semibold">{server.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{server.description}</p>
              </div>
            </a>
          ))}
        </div>
      </section>
      )}

      <Leaderboard variant="public" />

      <section className="relative overflow-hidden bg-hero-gradient px-6 py-20 text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Your next train is one link away
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-white/80">
          Free to start. No credit card, no spreadsheets, no more &quot;is this slot still open?&quot;
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          {/* Signups temporarily disabled -- was <Link href="/register?role=organizer">, swap back when re-enabling. */}
          <span
            aria-disabled="true"
            className="pointer-events-none cursor-not-allowed rounded-md bg-white px-6 py-3.5 font-display text-base font-semibold opacity-40"
            style={{ color: "hsl(var(--hero-ink))" }}
          >
            Organize a Raid Train
          </span>
          <span
            aria-disabled="true"
            className="pointer-events-none cursor-not-allowed rounded-md border border-white/30 px-6 py-3.5 font-display text-base font-semibold text-white opacity-40"
          >
            Join a Raid Train
          </span>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
        Raid Train Conductor
      </footer>
    </main>
  );
}
