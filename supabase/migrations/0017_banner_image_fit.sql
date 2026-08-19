-- ============================================================================
-- Raid Train Conductor — Banner fit mode
-- The train banner crops to fill its strip by default (object-cover), which
-- works fine for most photos but hard-crops graphics with text or detail
-- running edge-to-edge — the crop shape needed on mobile (~1.35:1, closer to
-- square) can be very different from desktop (~3.3:1, panoramic), so a wide
-- graphic that looks fine on desktop can lose content on both sides on
-- mobile, and there's no single crop shape that's safe for every image.
-- image_fit lets the organizer opt into "contain" instead: the full image
-- always shows, never cropped, with the remaining space filled by a blurred
-- copy of the same image rather than empty bars.
-- ============================================================================

alter table public.raid_trains
  add column image_fit text not null default 'cover'
  check (image_fit in ('cover', 'contain'));
