-- ============================================================================
-- Raid Train Conductor — Banner focal point
-- The train banner (raid_trains.image_url) renders as a full-width, short
-- strip (see app/train/[slug]/page.tsx), so most uploaded images need to be
-- cropped horizontally to fill it. Vertical cropping is the real complaint —
-- an image whose subject sits near the top or bottom gets trimmed by the
-- default centered crop. image_position lets the organizer pick which edge
-- to anchor to instead of re-editing their file externally.
-- ============================================================================

alter table public.raid_trains
  add column image_position text not null default 'center'
  check (image_position in ('top', 'center', 'bottom'));
