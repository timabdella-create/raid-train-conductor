-- Fixes a third bug found while re-testing the Discord feature: a seller
-- who is removed from a slot (or cancels, or gets declined) can never
-- apply to that same train again. train_applications had a plain
-- UNIQUE(raid_train_id, seller_id) constraint — since submit_train_
-- application() always INSERTs a new row rather than updating an existing
-- one, that constraint blocks a second application forever, even though
-- the first row is long since 'withdrawn' or 'rejected' and the seller's
-- slot has genuinely reopened. Reproduced live: after being removed by the
-- organizer (see 0022), reapplying failed with
--   duplicate key value violates unique constraint
--   "train_applications_raid_train_id_seller_id_key"
-- The real intent (one seller can't hold two *simultaneous* applications
-- on the same train) only needs to constrain the active statuses —
-- 'pending' and 'approved'. 'rejected' and 'withdrawn' are terminal;
-- 'waitlisted' is defined on the enum but never actually written anywhere
-- in this codebase (train_waitlist_entries is the real waitlist table),
-- so it's excluded from the active set to be safe rather than guessed at.
alter table public.train_applications
  drop constraint train_applications_raid_train_id_seller_id_key;

create unique index train_applications_active_unique
  on public.train_applications (raid_train_id, seller_id)
  where status in ('pending', 'approved');
