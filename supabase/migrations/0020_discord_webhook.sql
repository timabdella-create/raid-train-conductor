-- Lets an organizer attach a Discord webhook URL to their train. When set,
-- two things happen: (1) a message posts immediately whenever a confirmed
-- slot frees up (seller cancels, or organizer removes them), and (2) a
-- daily 8am ET cron (see app/api/cron/discord-daily-summary) posts a
-- roundup of remaining open slots. Purely additive/optional — trains
-- without a webhook configured behave exactly as before.
alter table public.raid_trains
  add column discord_webhook_url text;

comment on column public.raid_trains.discord_webhook_url is
  'Organizer-provided Discord webhook URL (https://discord.com/api/webhooks/...). Null = Discord updates disabled for this train.';
