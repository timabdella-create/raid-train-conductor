import Link from "next/link";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-hero-mesh px-4 py-12">
      <Link
        href="/"
        className="mb-8 font-display text-lg font-semibold tracking-tight text-white/90 transition-colors hover:text-white"
      >
        Raid Train Conductor
      </Link>
      <div className="w-full max-w-md">
        <div className="glow-primary rounded-lg border border-white/10 bg-card p-6 shadow-sm">
          {children}
        </div>
      </div>
    </main>
  );
}
