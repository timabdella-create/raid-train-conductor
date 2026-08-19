-- ============================================================================
-- Raid Train Conductor — Seller show thumbnail
-- A second, optional image an organizer can upload for a train, distinct
-- from the train's own banner (image_url): this one is meant for sellers to
-- download and use as their own Whatnot show thumbnail when they go live.
-- Reuses the existing public train-images storage bucket/policies from
-- 0003_train_requirements_and_storage.sql — no new bucket needed.
-- ============================================================================

alter table public.raid_trains
  add column if not exists seller_thumbnail_url text;
