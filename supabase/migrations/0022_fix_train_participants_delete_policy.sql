-- Fixes another real, pre-existing bug found while re-testing the Discord
-- feature: train_participants had INSERT/SELECT/UPDATE policies but no
-- DELETE policy at all. RLS with no matching DELETE policy doesn't error —
-- it just silently deletes zero rows. removeSellerFromSlot() (organizer
-- removing a confirmed seller, in app/dashboard/organizer/trains/[trainId]/
-- schedule/actions.ts) has been calling
--   supabase.from("train_participants").delete()...
-- on the regular RLS-bound client this whole time, so every organizer
-- removal has correctly reopened the slot and withdrawn the application,
-- but left an orphaned train_participants row with confirmation_status =
-- 'confirmed' behind. Confirmed live: after removing a seller via the
-- schedule manager, the seller's own apply page still showed "You're
-- confirmed!" for the freed slot, and a direct query showed the
-- train_participants row still present days/weeks after removal.
-- (The seller-initiated path, cancel_train_participation(), is unaffected —
-- it's a SECURITY DEFINER function and its DELETE runs as the table owner,
-- bypassing RLS entirely.)
-- Fix: add the missing DELETE policy, mirroring the existing UPDATE policy
-- (train_participants_update_organizer) exactly.
create policy "train_participants_delete_organizer"
  on public.train_participants for delete
  using (organizes_train(raid_train_id) OR is_admin());
