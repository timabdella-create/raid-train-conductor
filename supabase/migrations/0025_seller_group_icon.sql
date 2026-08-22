-- ============================================================================
-- Raid Train Conductor — Seller group/community icon
-- Lets a seller upload a small badge/logo representing a group or community
-- they're part of (e.g. a Discord community's logo), shown next to their
-- name in the schedule table wherever they've claimed a slot. Reuses the
-- existing public train-images storage bucket/policies from
-- 0003_train_requirements_and_storage.sql (upload path convention
-- {auth.uid()}/{filename} already grants sellers write access) — no new
-- bucket needed.
-- ============================================================================

alter table public.seller_profiles
  add column if not exists group_icon_url text;
