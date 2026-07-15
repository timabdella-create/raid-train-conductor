import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
        MVP — Phase 1: Foundation
      </span>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Raid Train Conductor
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Build the schedule, fill open slots, manage sellers, and run your
        Whatnot raid train live — all in one place.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/register"
          className="rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground hover:opacity-90"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-border px-5 py-3 font-medium hover:bg-muted"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
