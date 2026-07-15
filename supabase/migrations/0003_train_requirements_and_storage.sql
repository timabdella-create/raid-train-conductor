-- ============================================================================
-- Raid Train Conductor — Phase 2 additions
-- Seller-requirement fields on raid_trains (Step 4 of the create-train
-- wizard), a break_minutes field so slot-generation settings round-trip
-- through edit/clone, and a public storage bucket for train images with
-- owner-scoped write policies.
-- ============================================================================

alter table public.raid_trains
  add column if not exists requires_whatnot_profile boolean not null default true,
  add column if not exists requires_show_link boolean not null default true,
  add column if not exists sales_level_requirement text,
  add column if not exists additional_questions jsonb not null default '[]'::jsonb,
  add column if not exists break_minutes integer not null default 0;

-- ----------------------------------------------------------------------------
-- STORAGE: train-images bucket
-- Upload path convention enforced by policy: {auth.uid()}/{filename}
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('train-images', 'train-images', true)
on conflict (id) do nothing;

create policy "train_images_public_read"
  on storage.objects for select
  using (bucket_id = 'train-images');

create policy "train_images_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'train-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "train_images_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'train-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "train_images_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'train-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
