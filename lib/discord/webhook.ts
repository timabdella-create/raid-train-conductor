// Thin wrapper around Discord's incoming webhook API. Same "plain fetch, no
// SDK" approach as lib/email/resend.ts — a webhook post is a single POST
// with a JSON body, no auth beyond the URL itself.

/** Matches the URL shape Discord issues for channel webhooks. Used to keep
 *  the field from being (ab)used to POST arbitrary content at some other
 *  URL — this app only ever needs to talk to Discord's webhook endpoint. */
export const DISCORD_WEBHOOK_URL_PATTERN = /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+\/?$/;

export function isValidDiscordWebhookUrl(url: string): boolean {
  return DISCORD_WEBHOOK_URL_PATTERN.test(url.trim());
}

async function postToDiscord(webhookUrl: string, body: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[discord] webhook post failed (${res.status}): ${text}`);
    }
  } catch (err) {
    // Never let a Discord hiccup break the seller/organizer action that
    // triggered it — this is a best-effort notification, not a critical path.
    console.warn("[discord] webhook post error:", err instanceof Error ? err.message : err);
  }
}

/** Posted immediately when a confirmed slot frees up (cancellation or organizer removal). sellerName is the Whatnot username of whoever left, e.g. "@EddieBanks" — omitted entirely if we couldn't resolve it. */
export async function notifyDiscordSlotOpened(input: {
  webhookUrl: string;
  trainName: string;
  trainUrl: string;
  openSlotCount: number;
  sellerName?: string | null;
}): Promise<void> {
  const { webhookUrl, trainName, trainUrl, openSlotCount, sellerName } = input;
  const who = sellerName ? `**${sellerName}** dropped their slot on` : "A slot just opened up on";
  const content =
    `🚨 ${who} **${trainName}**! ` +
    `${openSlotCount} open slot${openSlotCount === 1 ? "" : "s"} left — ${trainUrl}`;
  await postToDiscord(webhookUrl, { content });
}

/** Posted immediately when a seller claims a slot (open/invite_only modes confirm right away; approval_required stays pending until the organizer decides). sellerName is the Whatnot username of whoever signed up, e.g. "@EddieBanks" — omitted entirely if we couldn't resolve it. */
export async function notifyDiscordSlotClaimed(input: {
  webhookUrl: string;
  trainName: string;
  trainUrl: string;
  openSlotCount: number;
  pending: boolean;
  sellerName?: string | null;
}): Promise<void> {
  const { webhookUrl, trainName, trainUrl, openSlotCount, pending, sellerName } = input;
  const who = sellerName ? `**${sellerName}**` : "A seller";
  const content = pending
    ? `📝 ${who} just applied for a slot on **${trainName}** (pending your approval). ${openSlotCount} open slot${openSlotCount === 1 ? "" : "s"} left — ${trainUrl}`
    : `✅ ${who} just claimed a slot on **${trainName}**! ${openSlotCount} open slot${openSlotCount === 1 ? "" : "s"} left — ${trainUrl}`;
  await postToDiscord(webhookUrl, { content });
}

/** Posted once daily (see app/api/cron/discord-daily-summary) listing the slots still open. */
export async function notifyDiscordOpenSlotsSummary(input: {
  webhookUrl: string;
  trainName: string;
  trainUrl: string;
  openSlotCount: number;
  openSlotTimes: string[];
}): Promise<void> {
  const { webhookUrl, trainName, trainUrl, openSlotCount, openSlotTimes } = input;

  if (openSlotCount === 0) {
    await postToDiscord(webhookUrl, {
      content: `☀️ Good morning! **${trainName}** is fully booked — no open slots left. ${trainUrl}`,
    });
    return;
  }

  const MAX_LISTED = 20;
  const listed = openSlotTimes.slice(0, MAX_LISTED);
  const remainder = openSlotTimes.length - listed.length;
  const timesLine = listed.join(", ") + (remainder > 0 ? `, +${remainder} more` : "");

  const content =
    `☀️ Good morning! **${trainName}** still has ${openSlotCount} open slot${openSlotCount === 1 ? "" : "s"}:\n` +
    `${timesLine}\n` +
    `Grab one: ${trainUrl}`;
  await postToDiscord(webhookUrl, { content });
}
