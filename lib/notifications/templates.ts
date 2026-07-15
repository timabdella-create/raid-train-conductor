import type { NotificationType } from "@/types/database.types";

export interface NotificationTemplateResult {
  subject: string;
  html: string;
  /** Plain-text fallback also stored as notifications.message. */
  text: string;
}

function shell(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px 16px; color: #1a1a2e;">
      <p style="font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; color: #6b46c1; font-weight: 600;">Raid Train Conductor</p>
      <h1 style="font-size: 20px; margin: 8px 0 16px;">${title}</h1>
      <div style="font-size: 15px; line-height: 1.6;">${bodyHtml}</div>
    </div>
  `.trim();
}

// Data shapes per notification type. Kept loose (not a discriminated union)
// so callers can pass exactly the fields relevant to that one type without
// threading a big shared interface through every call site.
export type NotificationData = {
  trainName: string;
  slotTime?: string;
  showUrl?: string | null;
  position?: number;
  expiresAt?: string;
  initiatedByOrganizer?: boolean;
  pending?: boolean;
  subject?: string;
  message?: string;
};

export function buildNotificationContent(
  type: NotificationType,
  data: NotificationData
): NotificationTemplateResult {
  switch (type) {
    case "signup_confirmation": {
      if (data.pending) {
        const subject = `Application received for ${data.trainName}`;
        const text = `Your application for ${data.trainName} is awaiting the organizer's approval. We'll email you as soon as they respond.`;
        return { subject, text, html: shell(subject, `<p>${text}</p>`) };
      }
      const subject = `You're confirmed for ${data.trainName}`;
      const text = `You're confirmed${data.slotTime ? ` for ${data.slotTime}` : ""} on ${data.trainName}. We'll send reminders as it gets closer.`;
      return { subject, text, html: shell(subject, `<p>${text}</p>`) };
    }

    case "application_approved": {
      const subject = `Approved: ${data.trainName}`;
      const text = `Good news — the organizer approved your application${data.slotTime ? ` for ${data.slotTime}` : ""} on ${data.trainName}.`;
      return { subject, text, html: shell(subject, `<p>${text}</p>`) };
    }

    case "application_rejected": {
      const subject = `Update on your application for ${data.trainName}`;
      const text = `The organizer didn't approve your application for ${data.trainName} this time. Check the train's page for other open slots.`;
      return { subject, text, html: shell(subject, `<p>${text}</p>`) };
    }

    case "added_to_waitlist": {
      const subject = `You're on the waitlist for ${data.trainName}`;
      const text = `You're #${data.position ?? "?"} on the waitlist for ${data.trainName}. We'll email you if a slot opens up.`;
      return { subject, text, html: shell(subject, `<p>${text}</p>`) };
    }

    case "slot_changed": {
      const subject = `Your slot changed on ${data.trainName}`;
      const text = `The organizer moved you to a new slot${data.slotTime ? `: ${data.slotTime}` : ""} on ${data.trainName}.`;
      return { subject, text, html: shell(subject, `<p>${text}</p>`) };
    }

    case "reminder_24h": {
      const subject = `Tomorrow: ${data.trainName}`;
      const text = `Reminder — your slot${data.slotTime ? ` (${data.slotTime})` : ""} on ${data.trainName} is in about 24 hours.${data.showUrl ? ` Show link: ${data.showUrl}` : ""}`;
      return { subject, text, html: shell(subject, `<p>${text}</p>`) };
    }

    case "reminder_2h": {
      const subject = `Starting soon: ${data.trainName}`;
      const text = `Reminder — your slot${data.slotTime ? ` (${data.slotTime})` : ""} on ${data.trainName} starts in about 2 hours.${data.showUrl ? ` Show link: ${data.showUrl}` : ""}`;
      return { subject, text, html: shell(subject, `<p>${text}</p>`) };
    }

    case "check_in_reminder": {
      const subject = `Check in for ${data.trainName}`;
      const text = `Check-in is now open for your slot${data.slotTime ? ` (${data.slotTime})` : ""} on ${data.trainName}. Check in from your dashboard so the organizer knows you're ready.`;
      return { subject, text, html: shell(subject, `<p>${text}</p>`) };
    }

    case "you_are_next": {
      const subject = `You're up next on ${data.trainName}!`;
      const text = `You're next in the lineup on ${data.trainName} — get ready to go live.`;
      return { subject, text, html: shell(subject, `<p>${text}</p>`) };
    }

    case "cancellation_confirmation": {
      const subject = `Cancelled: ${data.trainName}`;
      const text = data.initiatedByOrganizer
        ? `The organizer removed you from ${data.trainName}. Reach out to them if you have questions.`
        : `You've cancelled your slot on ${data.trainName}. Thanks for letting us know.`;
      return { subject, text, html: shell(subject, `<p>${text}</p>`) };
    }

    case "replacement_offer": {
      const subject = `A slot opened up on ${data.trainName}`;
      const text = `You've been offered an open slot${data.slotTime ? ` (${data.slotTime})` : ""} on ${data.trainName} from the waitlist.${data.expiresAt ? ` Respond by ${data.expiresAt}.` : ""} Accept or decline from your waitlist dashboard.`;
      return { subject, text, html: shell(subject, `<p>${text}</p>`) };
    }

    case "custom":
    default: {
      const subject = data.subject ?? `Update on ${data.trainName}`;
      const text = data.message ?? "";
      return { subject, text, html: shell(subject, `<p>${text.replace(/\n/g, "<br />")}</p>`) };
    }
  }
}
