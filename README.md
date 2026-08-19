# Raid Train Conductor

A complete raid-train management platform for Whatnot organizers, sellers, and shoppers — not just a signup calendar. This is Stage 1 (Phase 1: Foundation) of the build: project setup, database schema, security rules, authentication, and dashboard shells for organizers and sellers.

---

## 1. Recommended Technology Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js 14 (App Router) + React 18 + TypeScript | Server Components cut client JS for data-heavy dashboards; Server Actions give secure server-side mutations without hand-rolling API routes for every form; file-based routing maps cleanly onto the page list in the spec (public pages, seller pages, organizer pages, admin pages). |
| Styling | Tailwind CSS + a small hand-rolled component set (`components/ui`) | Fast to build mobile-first, large-tap-target UI. A shadcn/ui-style approach (own the component code, not a black-box library) keeps things simple to extend for train cards, status badges, and the live control room later. |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) | One provider covers auth, a real relational database (needed for slot-uniqueness constraints, waitlist ordering, and audit logs), row-level security for the organizer/seller/public permission model, file storage for profile photos and train images, and Realtime for the live control room in Phase 6 — without standing up a separate backend service. |
| Email | Resend (placeholder in `.env.example`, wired up in Phase 5) | Simple transactional email API, good deliverability, generous free tier. Not required to run Phase 1. |
| Hosting | Vercel (app) + Supabase (data/auth/storage) | Native Next.js support, preview deployments per branch, zero server management. |

### Why this instead of alternatives
- **Supabase vs. a custom Node/Express + Postgres backend:** the spec's security requirements (RLS, "sellers can't see private organizer notes," "no duplicate slot claims") map directly onto Postgres row-level security and constraints. Hand-rolling this in an ORM would duplicate logic Supabase gives for free at the database layer, which is also the safest place to enforce it.
- **Server Actions vs. a separate REST/GraphQL API:** the app has one frontend and no need for a public API in the MVP. Server Actions keep validation, mutation, and revalidation co-located and typed end-to-end.
- **Hand-rolled `components/ui` vs. installing shadcn/ui's CLI:** functionally equivalent (same styling conventions, same accessibility patterns), but avoids a codegen step that isn't available in this build environment. Swapping to the shadcn CLI later is a drop-in change.

---

## 2. Full MVP Feature List

Grouped by build phase (see §7, Roadmap, for the plan). Phase 1 is what ships in this stage.

**Phase 1 — Foundation (this stage)**
1. Project scaffold (Next.js, TypeScript, Tailwind)
2. Database schema for all core tables
3. Row-level security for every table
4. Registration, login, password reset, email confirmation
5. User roles (organizer / seller / admin)
6. Organizer profile creation
7. Seller profile creation
8. Protected dashboard shell with role-based routing
9. Mobile-responsive layout and navigation

**Phase 2 — Train Creation**
10. Raid-train creation wizard (6 steps, per spec)
11. Automatic time-slot generation
12. Draft / publish workflow
13. Public train page (`/train/[slug]`)
14. Visibility modes: public, unlisted, private (with invite code)
15. Clone a previous train

**Phase 3 — Seller Signup**
16. Seller application form
17. Open signup (first-claim), approval-required, invite-only, waitlist-only modes
18. Temporary slot holds to prevent double-claims
19. Waitlist join/offer flow (manual offers in MVP)
20. Seller confirmation

**Phase 4 — Organizer Management**
21. Organizer dashboard (overview, schedule, applications, waitlist, missing info)
22. Drag-and-drop schedule reordering
23. Cancellation + replacement tools
24. Missing-information tracking
25. Schedule export

**Phase 5 — Reminders and Check-in**
26. Transactional email reminders (signup confirmation, approval/rejection, 24h/2h reminders, check-in, "you're next," cancellation, replacement offer)
27. Configurable check-in windows
28. Seller self check-in + organizer manual check-in

**Phase 6 — Live Control Room**
29. Live seller / next seller panel with countdown
30. Mark live / completed / skipped / late / no-show
31. Extend or end a slot early
32. Train activity log

**Phase 7 — Testing & Launch**
33. Mobile, permissions, duplicate-slot, email, and time-zone test passes
34. Basic analytics
35. Production deployment

Deliberately excluded from all MVP phases (per spec): native mobile apps, public reliability scores, DMs/group chat, payment processing, automatic Whatnot verification, live viewer-count integration, AI-generated graphics, complex subscription billing.

---

## 3. Folder Structure

```
raid-train-conductor/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── reset-password/page.tsx
│   ├── auth/
│   │   └── callback/route.ts        # exchanges Supabase email-link codes for a session
│   ├── dashboard/
│   │   ├── layout.tsx               # shared shell (header + nav), auth-gated by middleware
│   │   ├── page.tsx                 # redirects to /dashboard/organizer or /dashboard/seller
│   │   ├── organizer/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts           # Server Actions (create organizer profile)
│   │   └── seller/
│   │       ├── page.tsx
│   │       └── actions.ts           # Server Actions (create seller profile)
│   ├── layout.tsx                   # root HTML shell
│   ├── page.tsx                     # marketing/home page
│   └── globals.css
├── components/
│   ├── ui/                          # button, input, label, card, badge
│   ├── auth/                        # login-form, register-form, reset-password-form, sign-out-button
│   ├── nav/                         # site-header
│   ├── organizer/                   # organizer-profile-form
│   └── seller/                      # seller-profile-form
├── lib/
│   ├── supabase/
│   │   ├── client.ts                # browser client
│   │   ├── server.ts                # server client + admin client
│   │   └── middleware.ts            # session refresh + route protection
│   ├── validations/
│   │   └── auth.ts                  # zod schemas
│   └── utils.ts
├── types/
│   └── database.types.ts            # hand-written now; regenerate via Supabase CLI once linked
├── supabase/
│   └── migrations/
│       ├── 0001_initial_schema.sql
│       └── 0002_row_level_security.sql
├── middleware.ts                    # root middleware, delegates to lib/supabase/middleware.ts
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

Future phases add `app/train/[slug]/` (public train page), `app/dashboard/organizer/[trainId]/...` (schedule manager, applications, waitlist, messaging, live control room), and `app/admin/`.

---

## 4. Database Relationship Overview

```
auth.users (Supabase-managed)
  └─ public.users (role: organizer | seller | admin)
       └─ public.profiles (1:1 — display name, photo, bio, timezone)
       ├─ public.organizer_profiles (1:1, only for organizers)
       │    └─ public.raid_trains (1:many)
       │         ├─ public.train_slots (1:many — the generated schedule)
       │         │    ├─ seller_id → seller_profiles
       │         │    └─ application_id → train_applications
       │         ├─ public.train_applications (1:many)
       │         ├─ public.waitlist_entries (1:many)
       │         ├─ public.train_participants (1:many — the confirmed roster)
       │         ├─ public.seller_history (1:many, organizer-private)
       │         └─ public.train_activity_log (1:many, audit trail)
       └─ public.seller_profiles (1:1, only for sellers)
            ├─ train_slots.seller_id (a seller occupies at most one slot per train)
            ├─ train_applications.seller_id
            ├─ waitlist_entries.seller_id
            ├─ train_participants.seller_id
            └─ seller_history.seller_id

public.notifications → user_id (recipient), optionally scoped to a raid_train_id
public.favorites → user_id + raid_train_id (future: saved trains)
```

**Key constraints enforced at the database level (not just in application code):**
- `train_slots (raid_train_id, seller_id)` is unique → a seller cannot hold two slots in the same train.
- `train_applications (raid_train_id, seller_id)` is unique → a seller cannot apply twice to the same train.
- `waitlist_entries (raid_train_id, seller_id)` is unique → one waitlist entry per seller per train.
- `raid_trains.slug` is globally unique → every train gets a stable public URL.
- A partial unique index on `train_slots` blocks two sellers from both being "active" (`confirmed`/`checked_in`/`live`/`completed`) on the same slot row.
- `end_time > start_time` and `end_datetime > start_datetime` check constraints on trains and slots.
- Foreign keys cascade sensibly: deleting a train cascades to its slots/applications/waitlist/participants/activity log; deleting a user cascades to their profile rows.

**Private data boundary:** `train_applications.organizer_notes` and `train_participants.organizer_notes` are the fields the spec calls out as organizer-only (e.g., "seller was 20 minutes late last time"). Postgres RLS is row-level, not column-level, so those two columns are revoked from the general `SELECT` grant and re-exposed to sellers only through `train_applications_seller_view` / `train_participants_public_view`, which omit the notes column entirely. `seller_history` (the full private attendance/reliability record) is a separate table with an organizer-only RLS policy — never queried by seller or public-facing code at all.

---

## 5. Supabase SQL Schema & RLS

Two migration files, meant to be run in order:

- **`supabase/migrations/0001_initial_schema.sql`** — all Phase 1 tables (`users`, `profiles`, `seller_profiles`, `organizer_profiles`, `raid_trains`, `train_slots`, `train_applications`, `waitlist_entries`, `train_participants`, `notifications`, `seller_history`, `train_activity_log`, `favorites`), enums for every status field in the spec (slot status, application status, waitlist status, attendance status, etc.), `updated_at` triggers, and a trigger that automatically creates `public.users` + `public.profiles` rows whenever someone signs up via Supabase Auth.
- **`supabase/migrations/0002_row_level_security.sql`** — enables RLS on every table and defines policies for: organizers managing only trains they own, sellers managing only their own profile/applications/waitlist entries, the public seeing only `published` trains with `public`/`unlisted` visibility, and private notes/history staying invisible to anyone but the owning organizer or an admin. Includes `security definer` helper functions (`is_admin()`, `owns_organizer_profile()`, `owns_seller_profile()`, `organizes_train()`, `train_is_publicly_visible()`) so policies stay readable and avoid recursive RLS evaluation.

**Not yet included (flagged for Phase 2+ migrations, not silently dropped):**
- The atomic "hold a slot for N minutes while a seller fills out the form" function — needs a `security definer` Postgres function with a `SELECT ... FOR UPDATE` to be race-condition-safe, planned as `0003_slot_holds.sql` alongside the signup flow.
- Private (invite-only) train access via `invite_code` — the column exists now; the lookup function that lets a non-organizer view a private train given a valid code ships with the visibility/signup-mode UI in Phase 2.
- Automatic waitlist replacement (offer → timed acceptance window → cascade) — explicitly deferred to a post-MVP phase per the spec.

---

## 6. Local Setup Guide

### Prerequisites
- Node.js 20+
- A free [Supabase](https://supabase.com) account
- (Optional but recommended) the [Supabase CLI](https://supabase.com/docs/guides/cli) — `npm install -g supabase`

### Step 1 — Install dependencies
```bash
cd raid-train-conductor
npm install
```

### Step 2 — Create a Supabase project
1. Go to supabase.com/dashboard → **New project**.
2. Note the **Project URL** and **anon public key** from Project Settings → API. You'll also want the **service role key** (same page) — keep this one secret, server-only.

### Step 3 — Run the migrations
Easiest path (no CLI needed): open the Supabase Dashboard → **SQL Editor**, and run each file in `supabase/migrations/` **in order** (`0001` through `0008`), pasting the full contents of one file, running it, then moving to the next. Order matters — later migrations alter tables and functions the earlier ones create.

CLI path, if you prefer version-controlled migrations:
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### Step 4 — Configure email confirmation (recommended default: ON)
In Supabase Dashboard → Authentication → Providers → Email, confirm "Confirm email" is enabled. The app's registration flow already handles both cases (instant session vs. "check your email"), so you can also turn it off for faster local testing.

### Step 5 — Set environment variables
```bash
cp .env.example .env
```
Fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — your project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon public key
- `SUPABASE_SERVICE_ROLE_KEY` — the service role key (server-only; never referenced from any Client Component)
- `NEXT_PUBLIC_SITE_URL` — `http://localhost:3000` for local dev
- `RESEND_API_KEY` / `EMAIL_FROM` — get a free API key at [resend.com](https://resend.com) and verify a sending domain (or use their test domain while developing). Leave `RESEND_API_KEY` unset if you just want to see notifications logged without actually emailing anyone — `sendEmail` no-ops gracefully.
- `CRON_SECRET` — any random string; must match whatever your scheduler sends as `Authorization: Bearer <value>` when it calls `/api/cron/send-reminders`. Leave unset for local testing (the check is skipped) — just don't leave it unset in production, since the route would then be callable by anyone who finds the URL.

### Step 6 — Wire up the reminders cron (Phase 5, production only)
`vercel.json` schedules `GET /api/cron/send-reminders` once a day (`0 13 * * *`, i.e. 1pm UTC) — set `CRON_SECRET` in your Vercel project's environment variables and Vercel adds the matching header automatically. This once-daily cadence is a **Vercel Hobby plan limit**, not a design choice: Hobby accounts reject any `vercel.json` cron schedule more frequent than once per day, and deploying with a tighter schedule (the original `*/15 * * * *` this route was designed around) fails outright with "Hobby accounts are limited to daily cron jobs." At once a day, the 24-hour reminder still works reliably, but the 2-hour and check-in reminders become unreliable — a single daily run can easily miss a slot's 2-hour window entirely.

To get the original 15-minute precision back without upgrading to Vercel Pro, drop the `crons` block from `vercel.json` entirely and instead call the route from a free external scheduler — a GitHub Actions workflow on a `schedule:` trigger (since the code already lives in a GitHub repo) or a free tier at a service like cron-job.org both work, hitting `https://your-app.vercel.app/api/cron/send-reminders` with an `Authorization: Bearer <CRON_SECRET>` header every 15 minutes. The route itself doesn't care who calls it or how often — only Vercel's own built-in cron feature is Hobby-restricted. Deploying elsewhere entirely (not Vercel)? Same idea: point any scheduler at the route with that header. Locally, just hit `curl http://localhost:3000/api/cron/send-reminders` whenever you want to test it manually — the `_sent_at` columns keep repeated calls safe regardless of how often it's called.

### Step 7 — Point Supabase Auth redirects at your app
In Supabase Dashboard → Authentication → URL Configuration, add `http://localhost:3000/auth/callback` to the Redirect URLs list (and your production URL later).

### Step 8 — Enable "Continue with Google" (optional)
The app already has a Google sign-in button wired up; enabling it takes two steps outside the codebase:

1. **Google Cloud Console**: at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials), create an OAuth 2.0 Client ID (Application type: **Web application**). Add `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback` as an Authorized redirect URI. Copy the generated **Client ID** and **Client Secret**.
2. **Supabase Dashboard** → Authentication → Sign In / Providers → **Google**: toggle it on, paste the Client ID and Client Secret from step 1, and save.

First-time Google sign-ins default to the `seller` role and land on a one-time "choose your role" screen (`/auth/complete-profile`) before reaching the dashboard, since Google doesn't have a way to ask that question during its own consent screen. Skip this step entirely if you only need email/password auth — nothing else in the app depends on it.

### Step 9 — Run it
```bash
npm run dev
```
Visit `http://localhost:3000`. Register an account, choose **Organizer** or **Seller**, confirm your email if required, log in, and you'll land on a dashboard that prompts you to complete your role-specific profile (organizer name/contact, or Whatnot username/profile URL).

### Step 10 — Typecheck
```bash
npm run typecheck
```

### Regenerating types after future schema changes
```bash
export SUPABASE_PROJECT_ID=your-project-ref
npm run supabase:types
```
This overwrites `types/database.types.ts` with Supabase's generated types once the CLI is linked — the hand-written version in this stage is a faithful match to the SQL but should be replaced by the generated one as soon as you're linked to a real project.

---

## 7. Development Roadmap

| Phase | Focus | Status |
|---|---|---|
| 1 | Foundation — auth, roles, profiles, schema, RLS, dashboard shells | **Done** |
| 2 | Train creation — wizard, slot generator, public train page, clone | **Done** |
| 3 | Seller signup — applications, slot claiming with holds, waitlist, confirmation | **Done** |
| 4 | Organizer management — schedule manager, drag-and-drop, replacements, missing-info tracking | **Done** |
| 5 | Reminders & check-in — Resend integration, scheduled reminders, check-in flow | **Done (this stage)** |
| 6 | Live control room — live/next seller panel, countdown, status controls, activity log | Next |
| 7 | Testing & launch — mobile/permissions/timezone/email test passes, analytics, deploy | Planned |

Each phase after this one will ship as its own stage: an explanation of what's being built, the files touched, complete code, migrations, env vars, validation, error handling, and a testing checklist — building directly on top of what's in this repository rather than restarting.

---

## 8. What Shipped in Phase 1 (Foundation)

- Full Phase 1 database schema and RLS policies (§5)
- Working email/password registration (with role selection), login, password reset, and email-confirmation callback handling, all via Supabase Auth
- Route protection middleware that redirects signed-out users away from `/dashboard/*` and signed-in users away from `/login`/`/register`
- An organizer dashboard shell that prompts new organizers to complete their profile, then shows a stats overview (currently zeroed — real numbers arrive with Phase 2 trains)
- A seller dashboard shell with the same completion-prompt pattern, requiring Whatnot username + profile URL before a seller can be confirmed for anything later
- A shared, accessible, mobile-first UI kit (`components/ui`) used by every form in this stage and reusable for every later one
## 9. What Shipped in Phase 2 (Train Creation)

- **Migration `0003_train_requirements_and_storage.sql`**: adds seller-requirement columns to `raid_trains` (`requires_whatnot_profile`, `requires_show_link`, `sales_level_requirement`, `additional_questions`, `break_minutes`) and a public `train-images` Storage bucket with owner-scoped upload/update/delete policies (path convention `{user_id}/{filename}`) plus public read.
- **`lib/trains/generate-slots.ts`**: pure function that turns a date + start/end time + timezone + slot length + break into a concrete, UTC-anchored list of slots, using `date-fns-tz`'s `fromZonedTime` so a train scheduled in `America/Chicago` stores correctly regardless of the server's own timezone. Reused client-side for the live wizard preview and server-side at save time — same function, same output, no drift.
- **`lib/trains/slug.ts`**: slugifies the train name for its public URL, retries with a short random suffix on collision, and generates the invite code for private trains.
- **Six-step create-train wizard** (`components/organizer/train-wizard/`): a single native `<form>` with all steps kept mounted (toggled via `hidden`, never unmounted) so no field values are lost switching steps, per-step client-side validation before advancing, a live "N slots will be created" preview on the schedule step, image upload straight to Supabase Storage, and Save Draft / Publish as distinct submit buttons feeding one Server Action.
- **Server Actions** (`app/dashboard/organizer/trains/new/actions.ts`, `app/dashboard/organizer/trains/[trainId]/actions.ts`): `createTrain`, `updateTrain`, `setTrainStatus` (publish/unpublish/cancel), `deleteTrain`, and `cloneTrain` — all revalidate server-side with the same zod schema the client uses, so a disabled JS browser or a tampered request still can't create an invalid train. Editing is schedule-locked once a train is published (name/rules/requirements/visibility stay editable; date/time/slot length don't) so a shared public link never silently points at a different schedule.
- **Organizer pages**: the dashboard now lists real trains with live open-slot counts; `/dashboard/organizer/trains/[trainId]` is the train overview (publish/unpublish/cancel/delete, invite-code display for private trains, clone-to-new-date form, read-only generated schedule); `/dashboard/organizer/trains/[trainId]/edit` reuses the wizard.
- **Public train page** (`/train/[slug]`): server-rendered, respects RLS for public/unlisted trains automatically; private trains are resolved through the service-role admin client only after the invite code in `?code=` is verified server-side (never trust a client-side code check). Shows the live/next slot with a client-side countdown, the full schedule with status badges, share button (native share sheet with clipboard fallback), and train rules/cancellation policy.
- **What's intentionally still a placeholder**: the "Apply for a slot" button on the public page is disabled with an explanatory label — seller applications, slot claiming, and the waitlist are Phase 3. The organizer schedule table shows time + status only; seller names populate once Phase 3 assigns sellers to slots.

## 10. What Shipped in Phase 3 (Seller Signup)

- **Migration `0004_seller_signup.sql`**: adds `train_applications.custom_answers` (jsonb) and six `SECURITY DEFINER` Postgres functions that are the *only* way seller-facing code can mutate `train_slots`, `train_applications`, `waitlist_entries`, and `train_participants` — sellers have no direct `UPDATE` grant on those tables (see 0002's RLS), so these functions are a narrow, validated doorway, not a bypass:
  - `hold_train_slot(slot_id, hold_minutes)` — the race-safe claim. The atomic `UPDATE ... WHERE status = 'open' ... RETURNING` is what actually prevents double-booking: Postgres serializes concurrent updates to the same row, so if two sellers click the same slot within the same second, exactly one succeeds and the other gets a clean "that slot was just taken" error instead of a corrupted booking.
  - `release_train_slot`, `release_expired_holds_for_train` — give back a hold voluntarily, or lazily clean up abandoned ones (called whenever a train's slots are listed, so expired 10-minute holds don't block other sellers from seeing the slot as open again).
  - `submit_train_application` — locks the slot row (`FOR UPDATE`), re-verifies the caller still holds it and the hold hasn't expired, then either confirms instantly (`open` signup mode) or marks it pending (`approval_required`), inserting the `train_participants` row only on instant confirmation.
  - `join_train_waitlist`, `cancel_train_participation` — waitlist join with position assignment, and self-service cancellation that frees the slot, withdraws the application, and writes a private `seller_history` row (notice-hours computed from how far out the cancellation happened) — never a public score, per the spec.
- **Apply flow** (`/train/[slug]/apply`): resolves the same way the public page does (public/unlisted via RLS, private via a server-verified invite code), then branches on the seller's current state — already confirmed, pending, waitlisted, or new — before ever showing the slot picker. Claiming a slot holds it and redirects to a form with a live countdown to the hold's expiry; letting the countdown lapse and trying to submit anyway is caught by `submit_train_application`'s re-check, not just trusted from the client.
- **Seller dashboard**: real numbers now (upcoming trains, pending applications, waitlist position), plus `/dashboard/seller/trains` (browse + search + category filter — the "basic train directory" MVP item), `/applications`, `/waitlist`, `/upcoming` (with a cancel button wired to `cancel_train_participation`), and `/past` (reads from `seller_history`).
- **Organizer overview**: the schedule table now resolves and displays the seller name + Whatnot username for held/pending/confirmed slots, and the stats row shows real pending-application and waitlist counts — both organizer dashboard pages pull from the same live data sellers are creating.
- **What's intentionally still a placeholder**: approving/rejecting pending applications, offering a waitlist slot, and drag-and-drop reordering are all organizer-side actions that read fine right now (counts are real) but don't have management UI yet — that's Phase 4. Invite-only trains show "ask the organizer for an invite" since the organizer-side invite/assign tool is also Phase 4. Actual emails aren't sent yet — `submit_train_application` writes a real row to the `notifications` table (correct recipient, subject, message) but nothing delivers it until Resend is wired up in Phase 5.

## 11. What Shipped in Phase 4 (Organizer Management)

- **Migration `0005_organizer_management.sql`**: four more `SECURITY DEFINER` functions, needed only where a seller must act on rows RLS otherwise reserves for organizers, or where several rows have to move together atomically:
  - `accept_waitlist_offer` / `decline_waitlist_offer` — a seller responding to a manually-offered slot. Accepting confirms the slot and creates the application + participant rows in one transaction; declining frees the slot immediately so the organizer can offer it to the next person without waiting on you.
  - `release_expired_waitlist_offers_for_train` — the same lazy-cleanup pattern as the slot holds from Phase 3: if a seller never responds, the next page load quietly reverts the offer and reopens the slot.
  - `swap_train_slot_sellers` — the operation behind the schedule manager's drag-and-drop. Locks both slot rows, swaps whichever seller/application is on each, and keeps `train_applications.slot_id` and `train_participants.slot_id` pointed at the right row afterward — dragging a seller card from the 10:00 slot onto the 10:30 slot doesn't leave their application or participant record still referencing the old time.
  - Everything else in this phase (approve/reject an application, reassign to a different open slot, move to waitlist, offer a waitlist slot, remove a confirmed seller, mark a slot unavailable) runs as plain organizer-authenticated writes — organizers already have `UPDATE` rights on trains they own from Phase 1's RLS, so no bypass function is needed there.
- **Applications management** (`/dashboard/organizer/trains/[trainId]/applications`): every application for a train, with the seller's Whatnot info, notes, and answers to any custom questions the organizer asked during train creation. Pending ones get Approve / Reject / Move-to-waitlist buttons; pending or approved ones can be reassigned to any other open slot from a dropdown.
- **Waitlist management** (`.../waitlist`): entries in line order, with a dropdown to offer any specific open slot to a specific waitlisted seller. Offering holds that slot for them for 48 hours and writes a real `notifications` row; the seller sees it on their own waitlist page (Phase 3's page, now with Accept/Decline buttons) and can accept or decline right there.
- **Schedule manager** (`.../schedule`): drag-and-drop, built on `@dnd-kit/core` (pointer + touch sensors, so it works on a phone during a live event, not just a mouse). Dragging a seller's card onto another time slot swaps them; the swap applies optimistically in the UI while `swap_train_slot_sellers` reconciles it server-side. Each slot also has Remove-seller (frees the slot, withdraws the application, logs `seller_history`) and Mark-unavailable/Reopen for slots the organizer wants to pull out of rotation entirely (a bye, a break the auto-generator didn't account for, etc.).
- **Missing-information card** on the train overview: flags a missing thumbnail, any pending applications still awaiting review, and confirmed sellers who haven't supplied a show link yet (only counted when the train's settings actually require one) — each item links straight to where you'd fix it.
- **What's intentionally still a placeholder**: "missing check-in" isn't tracked yet because check-in itself doesn't exist until Phase 5. Bulk messaging ("email all sellers," reminders) isn't built here either — the spec places that with Phase 5's Resend integration, not organizer management, so it stays there rather than getting split across two phases.

## 12. What Shipped in Phase 5 (Reminders and Check-in)

- **Migration `0006_reminders_and_checkin.sql`**: adds `reminder_24h_sent_at`, `reminder_2h_sent_at`, and `checkin_reminder_sent_at` to `train_participants` — one nullable timestamp per reminder type, each set exactly once, which is what lets the cron route (below) run as often as you like without ever double-sending. Also removes the old direct `insert into notifications` calls from `submit_train_application` and `accept_waitlist_offer` now that `lib/notifications/send.ts` is the single place a notification gets created and delivered.
- **Email delivery** (`lib/email/resend.ts`): a thin `fetch` wrapper around the Resend API — no SDK dependency. If `RESEND_API_KEY` isn't set, it logs a warning and returns `{ sent: false }` instead of throwing, so the app runs fully in development without an email provider configured; nothing else in the request path breaks.
- **Notification templates** (`lib/notifications/templates.ts`): one function, `buildNotificationContent`, covering every notification type in the spec (signup confirmation, application approved/rejected, added to waitlist, slot changed, 24h/2h reminders, check-in reminder, you're-next, cancellation, replacement offer, and a free-form "custom" type for the messaging page) — each returns a subject, an HTML email body, and a plain-text fallback stored on the `notifications` row.
- **`lib/notifications/send.ts`**: `sendNotification()` is now the only path that writes a `notifications` row and attempts delivery. It uses the service-role client deliberately — an organizer approving a seller's application is writing a notification *for* the seller, and a seller cancelling is writing one *for* the organizer, so no single RLS insert policy covers every direction without a lot of extra policy surface. `getUserIdForSeller` / `getUserIdForOrganizer` resolve a profile id to the actual `auth.users` id every caller needs. Every seller- and organizer-facing action from Phases 3 and 4 (apply, waitlist join, approve, reject, waitlist-add, slot move, offer, cancel, remove-from-slot) now calls through this one function instead of writing its own ad hoc notification.
- **Seller check-in** (`/dashboard/seller/upcoming`): each upcoming slot shows whether check-in is open yet (`now >= slot start − train.check_in_minutes_before`), a checked-in / not-yet-open / check-in-now badge, and a working "Check in" button (`checkInToTrain` action) once the window opens.
- **Organizer manual check-in** (`.../schedule`): the schedule manager now shows each seller's check-in status and gives the organizer a manual Check-in / Undo-check-in button for the door-staff case — a seller shows up but never got the email, or checked in and then had a connection drop.
- **Scheduled reminders** (`app/api/cron/send-reminders/route.ts`): scans confirmed `train_participants` for slots starting in the next two days, and for each one sends whichever of the 24-hour reminder, 2-hour reminder, or check-in-opened reminder is now due — gated by the three `_sent_at` columns so nothing repeats. Protected by a `CRON_SECRET` bearer-token check (skipped only if the env var is unset, for local testing); `vercel.json` schedules it to run every 15 minutes. Any other host can point its own scheduler at the same route with the same header.
- **Organizer messaging** (`/das
## 13. Visual Redesign (Public-Facing Pages)

- **Scope**: the marketing homepage (`app/page.tsx`) and the public train page (`/train/[slug]`), plus the shared auth pages (login/register/reset-password), were redesigned with a bolder, more energetic look to better match live-selling/Whatnot culture. Internal organizer/seller dashboards were intentionally left as-is.
- **New design tokens** (`app/globals.css`, `tailwind.config.ts`): `--accent` (hot pink) and `--electric` (teal) color tokens alongside the original palette, plus `--hero-from/via/to/ink` for the gradient/mesh hero backgrounds. New utility classes: `.font-display`, `.bg-hero-gradient`, `.bg-hero-mesh`, `.text-gradient`, `.glow-primary`, `.glow-accent`, and `animate-pulse-glow` / `animate-float` / `animate-fade-up` (all disabled under `prefers-reduced-motion`).
- **Typography**: added `Space Grotesk` as a self-hosted variable font (`next/font/google`, `app/layout.tsx`) for headings, applied via the `font-display` utility.
- **Homepage**: full hero section with animated gradient mesh background, headline with gradient text, floating "live schedule" preview card, a 3-step "how it works" section, a features grid, and a closing CTA band.
- **Public train page**: full-bleed hero banner (train image or gradient mesh fallback) with a pulsing "Live now" indicator, an upgraded stats card, live/next-slot highlight cards, and a restyled schedule table.
- **Auth pages**: now share a common `components/auth/auth-shell.tsx` wrapper with the same gradient-mesh background and a glowing card, instead of a plain centered card.
- **Note on the local build sandbox**: this project's build/verification sandbox blocks outbound requests to `fonts.googleapis.com`, so a local `next build` here fails at the font-fetch step. This is a sandbox network restriction, not a code issue — confirmed by temporarily stubbing out the font import and getting a fully clean build (all 17 routes) with no other errors. Vercel's build servers have normal internet access and fetch/self-host Google Fonts as part of every `next build`, so production deploys are unaffected.

## 14. Google Sign-In (OAuth)

- **Migration `0008_oauth_onboarding.sql`**: adds `onboarded` to `public.users` (true for email/password sign-ups, since they explicitly pick a role at registration; false for OAuth sign-ups, since Google has no equivalent step). Updates `handle_new_user()` to set it accordingly and to fall back through Google's `full_name`/`name` metadata for the display name. Adds `complete_oauth_onboarding(p_role)`, a `security definer` RPC guarded by `where onboarded = false` — it can only ever run once per user, so it can't be reused as a way to change roles later (the existing `users` RLS update policy already blocks that on ordinary updates).
- **`components/auth/google-button.tsx`**: a "Continue with Google" button on both the login and register pages, calling `supabase.auth.signInWithOAuth({ provider: "google" })`.
- **`app/auth/complete-profile`**: a one-time "choose your role" screen shown after a user's first Google sign-in (`app/dashboard/page.tsx` redirects here whenever `onboarded` is false). Picking Seller or Organizer calls the RPC above and lands the user on the matching dashboard from then on.
- **Setup required outside the codebase** (see README §6, Step 8): a Google Cloud OAuth Client ID/Secret, entered into Supabase Dashboard → Authentication → Providers → Google. Nothing in the app itself needs an env var for this — Supabase holds the OAuth client secret, not this codebase.

## 15. Leaderboard (Top Organizers / Top Sellers)

- **Migration `0009_leaderboard.sql`**: `get_top_organizers(p_limit)` and `get_top_sellers(p_limit)`, two `security definer` SQL functions ranking organizers by trains completed (`raid_trains.status = 'completed'`) and sellers by trains completed as a participant (`train_participants.attendance_status = 'completed'`). Both are grantable to `anon` since they only ever return a handful of already-public fields (organizer name, seller display name/Whatnot username, a count) — no need to loosen RLS on the underlying tables.
- **`components/leaderboard/leaderboard.tsx`**: one shared server component with two variants. `variant="public"` renders a full-width two-column section (gold/teal-tinted rank badges) between the features grid and the closing CTA on the homepage. `variant="compact"` (the default) renders a smaller card, added to both the organizer and seller dashboard home pages.
- Ranking is all-time and ties are broken alphabetically. Until any trains/slots are marked `completed`, each list shows a "fills in as trains wrap up" placeholder instead of an empty box.

## 16. Homepage Activity Widget (Live Now / Coming Up)

- **Migration `0010_train_activity.sql`**: `get_current_trains(p_limit)` and `get_upcoming_trains(p_limit)`, security-definer SQL functions listing public trains. "Current" is computed from real time (`train_slots.start_datetime <= now() < end_datetime`), not the `raid_trains.status` column, since nothing in the app currently transitions a train's own status to `'live'` automatically — the slot-level timestamps are the reliable source of truth for "is this happening right now." "Upcoming" excludes anything currently live and anything before today, ordered by date/time.
- **`components/discovery/train-activity.tsx`**: a homepage-only section between the hero and "How it works," showing up to 3 live trains (pulsing red dot) and up to 3 upcoming trains, each linking to its public `/train/[slug]` page. Only `visibility = 'public'` trains are ever shown — unlisted/private/invite-only trains never appear here, same as they're excluded from search elsewhere.
- Renders nothing at all if there's no public activity yet, rather than showing an empty box.

## 17. Dark Theme Redesign (Gold + Teal)

- Switched the entire app from the light purple/pink theme to a full dark theme — near-black background, warm gold as the primary/accent color, teal as the secondary accent — styled after a look the site owner liked on a competitor's site.
- **`app/globals.css`**: every CSS variable value changed (background, foreground, card, muted, border, primary, accent, electric, hero-from/via/to/ink), plus `color-scheme: dark` on `:root` so native form controls (date/time pickers, `<select>` dropdowns, scrollbars) render with dark-appropriate chrome instead of a jarring light popup. `.text-gradient` now blends gold → teal instead of purple → pink.
- Because the whole app already used CSS-variable-based Tailwind tokens (`bg-card`, `text-muted-foreground`, `border-border`, etc.) rather than hardcoded colors, this single file change re-themes the homepage, public train page, auth pages, and both dashboards consistently.
- Fixed three spots that *did* use hardcoded light-mode literals and would have been unreadable on a dark background: `components/ui/badge.tsx` (status badge tones switched from pastel `-100`/`-800` combos to tinted `/15` backgrounds with `-400` text), the organizer train page's "missing information" card (`bg-amber-50` → `bg-amber-500/10`), and `components/organizer/message-form.tsx`'s success text (`text-green-700` → `text-emerald-400`).

## 18. Dual-Role Support (Organizer + Seller Switcher)

- Removed the hard role gate on `/dashboard/organizer` that redirected any non-`organizer`-role user away. Data access was already correctly scoped by profile ownership (`organizer_profiles`/`seller_profiles` RLS policies key off `user_id`, and `owns_organizer_profile()`/`organizes_train()` never check `users.role`) — the role gate was purely a UI restriction, and removing it required no database changes at all.
- **`components/nav/role-switcher.tsx`** (new): shown in the site header for any logged-in user. If someone has both an organizer profile and a seller profile, it renders a pill-style toggle between the two dashboards. If they only have one, it shows that dashboard link plus a "+ Become a seller" / "+ Become an organizer" link — clicking it lands on the other dashboard's existing first-time setup form (no new form needed; `/dashboard/organizer` and `/dashboard/seller` already show a profile-setup form whenever the corresponding profile row doesn't exist yet).
- `users.role` still decides which dashboard the bare `/dashboard` link lands on by default, but no longer gates which dashboards a person can actually visit or use.

## 19. Edit Profile Page

- **`app/dashboard/profile`** (new): one page to edit everything about your account — basic info (name, phone, timezone, bio) from `public.profiles`, plus your organizer profile and/or seller profile if you have them. Whichever of the two you don't have yet shows a "+ Become a seller/organizer" link instead of a form, reusing the same first-time setup flow from dual-role support (§18).
- The organizer and seller profile forms now double as edit forms: `saveOrganizerProfile`/`saveSellerProfile` (renamed from `createOrganizerProfile`/`createSellerProfile`) upsert on the `user_id` unique constraint instead of always inserting, so submitting the form again updates the existing row in place rather than failing or duplicating it. `OrganizerProfileForm`/`SellerProfileForm` now accept an optional `defaultValues` prop to prefill for editing; both are unchanged (still create-only, unprefilled) when used from the first-time setup screens.
- Added a new server action, `updateBasicProfile`, for the `profiles` table fields — the only ones that previously had no edit path at all.
- "Edit profile" link added to the site header for any logged-in user.

## 20. Wider Desktop Layout

- The marketing homepage, public train page, leaderboard section, homepage activity widget, and the dashboard shell were all capped at `max-w-5xl`/`max-w-6xl` (1024–1152px), which left a lot of empty space on either side on large desktop monitors. Widened to `max-w-7xl` (1280px) for page-level sections, and `max-w-5xl` for the public train page (was `max-w-3xl`), so the site fills a wide screen properly instead of floating as a narrow column.
- Left narrow on purpose: auth forms, the profile/edit page, and train-creation forms — these are single-column input flows that read worse stretched full-width, so they keep their existing narrower max-widths.
- Homepage's feature grid also picked up a 4-column layout at the `lg` breakpoint (was capped at 2 columns even on wide screens).

## 21. Specific Signup CTAs

- Replaced generic "Start a train — it's free" / "Create your first train" buttons with role-specific copy: **Build My First Train** (organizer, `/register?role=organizer`) and **Join a Raid Train** (seller, `/register?role=seller`) — used in both the homepage hero and the closing CTA band.
- The register page now reads a `role` query param to preselect the seller/organizer radio button, so both buttons land on the right side of the form already selected.
- The register form's submit button is now role-aware: **Create My Free Seller Account** or **Create My Organizer Account**, updating live as the user toggles the radio buttons (not just on page load from the query param).

## 22. Lighter Dark Theme

- Lightened the dark theme's CSS variable values in `app/globals.css` — background lifted from near-black (`8% lightness`) to a medium charcoal (`15%`), cards/muted surfaces lightened proportionally, and gold/teal accents made slightly more saturated and vivid. Same overall dark aesthetic and color identity (gold + teal, from §17), just noticeably less heavy — a "dimmed" dark theme (think GitHub's dark-dimmed mode) rather than near-OLED-black.
- No component markup changed — every color still routes through the same CSS variables, so this was a one-file change.

## 23. Bookmark a Seller's Show

- Public train pages now show each filled slot's seller (`@whatnot_username`, linked to their Whatnot profile) in a new "Seller" column, next to a bookmark icon. **`lib/bookmarks/local-bookmarks.ts`** stores bookmarks in `localStorage` — no account or login required, matching "one click" — so this works for anonymous visitors browsing a train page, not just registered users.
- Seller identity uses `seller_profiles.whatnot_username`/`whatnot_profile_url` rather than the base `profiles.display_name`, because RLS only makes `seller_profiles` (and `organizer_profiles`) publicly readable for people on a publicly visible train — the base `profiles` table stays private to its owner. Confirmed this while building rather than assuming, since it would've silently returned nothing for anonymous visitors otherwise.
- **`/bookmarks`** (new, public route): lists everything saved on this device with a link back to the seller's Whatnot profile and the train it was saved from, plus a Remove button. Linked from the public train page (next to Share) and from the dashboard header ("Saved shows").
- Known limitation, by design: bookmarks live in browser `localStorage`, so they don't sync across devices or survive clearing browsing data. Moving to account-backed bookmarks later would need a new table plus requiring sellers/organizers (or a new "buyer" role) to log in to save a show — a bigger change than what was asked for here.

## 24. "Bookmark All" Button

- Added a "Bookmark all" button at the top of each public train page, next to Share/Saved shows. One click saves every seller currently signed up for that train to `localStorage` at once (via a new `addBookmarks()` helper), showing a brief "Saved N shows" confirmation. Skips anyone already bookmarked and shows "Already saved" if everyone on the train was saved already. Renders nothing if no sellers have signed up yet.
- Individual bookmark icons and "Bookmark all" now stay in sync with each other on the same page load: `local-bookmarks.ts` dispatches a `rtc-bookmarks-changed` window event on every write, and each bookmark icon listens for it — so clicking "Bookmark all" immediately fills in every icon in the schedule table, not just on next page load.

## 25. Trains Hosted / Trains Sold Counts

- Public train pages now show "Organized by {name} · N trains hosted" near the top, and each seller in the schedule table shows "(N trains)" next to their `@whatnot_username` — both counts are completed-trains totals, not just sign-ups.
- **`supabase/migrations/0011_participation_counts.sql`** (new, applied): two `SECURITY DEFINER` RPCs, `get_organizer_completed_count(p_organizer_id)` and `get_seller_completed_counts(p_seller_ids[])` (batched — one round trip for every seller on a train instead of one call per seller), both counting rows where the train/participation status is `completed`. Granted to `anon, authenticated` since these counts are meant to be public, same pattern as the leaderboard RPCs.
- The organizer's name is sourced from `organizer_profiles.organizer_name`, which — like `seller_profiles` — has a public-read RLS exception for organizers/sellers tied to a publicly visible train. This also fixes a gap where the organizer's name wasn't shown anywhere on the public train page before.
- The organizer's Applications review page (`/dashboard/organizer/trains/[trainId]/applications`) now shows each applicant's completed-trains count too, using the same batched RPC — useful context when deciding who to approve for an open slot.

## 26. Brand Color Palette

- Swapped the theme's colors in `app/globals.css` for the site's actual brand palette: **Purple** `#8A20E8` (primary), **Fuchsia** `#F23BC2` (accent), **Turquoise** `#27CFC8`/**Deep Teal** `#079C9C` (electric + hero gradient), on **Black** `#09090B` / **White** `#F7F7F7`. Same one-file, CSS-variable-only change as the earlier theme edits (§17, §22) — no component markup touched.
- The hero gradient (homepage banner, train page fallback banner) now runs purple → fuchsia → deep teal instead of gold → orange → cyan.
- Left the functional status colors alone (green/amber/red/sky in badges and success/warning messages) — those signal state (approved/pending/error), not brand, so mixing in fuchsia/purple there would hurt readability rather than help it.
- Added `--soft-pink` (`#E982B5`) as a defined-but-unused CSS variable for future accents.

## 27. Transfer Train Ownership

- Organizers can hand a train off to another organizer from the train's page ("Transfer ownership"). It's a request/accept flow, not an instant change: the sender enters the recipient's account email, and ownership only moves once the recipient logs in and accepts — mirroring the existing invite/apply pattern (train_applications) rather than a one-click irreversible action.
- **`supabase/migrations/0012_train_transfers.sql`** (new, applied): a `train_transfers` table plus three `SECURITY DEFINER` RPCs — `initiate_train_transfer(train_id, to_email)`, `respond_to_train_transfer(transfer_id, accept)`, and `cancel_train_transfer(transfer_id)`. The recipient is looked up by their login email (`public.users.email`), which is why this has to go through an RPC — `public.users` isn't selectable cross-user under RLS. Requests fail loudly (e.g. "No organizer account found for that email") rather than silently doing nothing.
- Recipients must already have an organizer account on the platform. If the email doesn't match one, the sender gets a clear error explaining why, instead of the request just disappearing.
- Only one pending transfer per train at a time — starting a new one while one's outstanding is blocked until the sender cancels it.
- **`/dashboard/organizer/trains/[trainId]/transfer`** (new page): shows the request form, or the pending outgoing request with a Cancel button if one exists.
- The organizer dashboard now shows an "Incoming transfer requests" card at the top when someone has sent *you* a train — Accept moves `raid_trains.organizer_id` over immediately; Decline just closes the request. Both actions are logged to `train_activity_log`.

## 28. Seller Show Thumbnail

- Organizers can now upload a second, optional image per train — a "seller show thumbnail" — separate from the train's own banner image. It's meant to be downloaded by sellers and used as their own Whatnot show thumbnail when they go live, so it's typically a square/promo-style image rather than the wide banner.
- **`supabase/migrations/0013_seller_thumbnail.sql`** (new, applied): adds `seller_thumbnail_url` to `raid_trains`. Reuses the existing public `train-images` storage bucket and owner-scoped upload policies from §(storage setup) — no new bucket needed.
- Upload happens in the same Basic Details step of the train wizard/edit form as the banner image, via a second `ImageUploadField` (that component now takes `label`/`helpText`/`id` props instead of being hardcoded to the banner's copy).
- **`components/train/download-thumbnail-button.tsx`** (new): fetches the image as a blob and triggers a real file download (not just an image preview tab) — falls back to opening the image in a new tab if the fetch fails for any reason.
- Shown in two places once an organizer sets it: on the public train page (with a preview + download button, visible to anyone browsing/applying), and on a seller's "Upcoming trains" dashboard list next to each train they're confirmed for.

## 29. Co-Conductors

- Organizers can add another organizer as a "co-conductor" on a train to help run it day-to-day — approve/reject applications, manage the schedule and waitlist, and message sellers — without handing over ownership. Same request/accept pattern as train transfers (§27): nothing grants access until the invited organizer accepts.
- **`supabase/migrations/0014_train_co_conductors.sql`** (new, applied): adds a `train_co_conductors` table plus three `SECURITY DEFINER` RPCs — `invite_co_conductor(train_id, to_email)`, `respond_to_co_conductor_invite(invite_id, accept)`, and `remove_co_conductor(id)`. Like transfers, the invitee is looked up by their login email via `public.users`, so it has to go through an RPC rather than a direct client insert.
- The key mechanism is a one-function change: `organizes_train()` — already referenced throughout the RLS policies for `train_slots`, `train_applications`, `waitlist_entries`, `train_participants`, and `train_activity_log` — now also returns true for an accepted co-conductor, not just the train's owner. That single change cascades day-to-day management access everywhere it's already used, with no other policy edits required.
- Ownership-only actions stay strictly owner-only, enforced at the database level, not just hidden in the UI: editing train settings, publishing/unpublishing, deleting, transferring ownership, and inviting/removing co-conductors all still key off `owns_organizer_profile(organizer_id)` alone. `raid_trains` UPDATE/DELETE policies were deliberately left untouched by this feature, so a co-conductor can never reassign a train to themselves via a raw API call.
- **`lib/trains/access.ts`** (new): a shared `getTrainAccess()` / `assertCanManageTrain()` helper, replacing ~8 copy-pasted per-page ownership checks across the applications/messaging/schedule/waitlist pages and their server actions with one place that understands "owner or accepted co-conductor."
- The train overview page now shows a "Co-conductors" card (owners can invite by email and remove; co-conductors can see who else manages the train and leave), and a "Co-conductor" badge for anyone viewing a train they don't own. Edit, Transfer ownership, and the Publish/Cancel/Delete/Clone actions card are all hidden from co-conductors.
- The organizer dashboard gained an "Incoming co-conductor invites" card (mirroring the existing transfer-invite UX) and a "Trains you help manage" section separate from "Your raid trains," since co-conductors need a way to find trains they don't own.

## 30. Invite-Code Auto-Join

- Trains set to "Invite only" signup now actually work: previously `submit_train_application()` unconditionally rejected every direct application on an invite_only train, even from someone who had a code — the `invite_code` column existed and gated page visibility for private trains, but had no effect on signup at all.
- **`supabase/migrations/0015_invite_code_auto_join.sql`** (new, applied): `submit_train_application` now takes a `p_invite_code` argument. For invite_only trains, it must match `raid_trains.invite_code` or the application is rejected; if it matches, the application is auto-approved and the seller is confirmed immediately — no organizer review step, unlike approval_required.
- `visibility` (who can see the train) and `signup_mode` (how they join it) are independent settings. An invite_only train can be public/unlisted and fully visible, gated only on signup — so invite-code generation was broadened from "private-visibility trains only" to "private-visibility OR invite_only trains," in the wizard, the edit form, and cloning.
- The organizer's train page shows the invite code whenever either setting needs one, with copy explaining what sharing it does in context (view access for private trains, auto-approval for invite_only trains).
- On the public train page and apply flow, `gatedByCode` is now computed for every train (not just private ones) by checking the `?code=` query param against `invite_code` — that's what unlocks the slot picker for an invite_only train instead of the "ask the organizer" dead end.
