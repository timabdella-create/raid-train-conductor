// Hand-written types mirroring supabase/migrations/0001-0004. Once the
// project is linked to a real Supabase instance, regenerate this file with
// `npm run supabase:types` (see package.json) to stay in sync.

export type UserRole = "organizer" | "seller" | "admin";
export type TrainSignupMode = "open" | "approval_required" | "invite_only" | "waitlist_only";
export type TrainVisibility = "public" | "unlisted" | "private";
export type TrainStatus = "draft" | "published" | "live" | "completed" | "cancelled";
export type SlotStatus =
  | "open" | "held" | "pending_approval" | "confirmed" | "waitlisted"
  | "checked_in" | "live" | "completed" | "cancelled" | "replaced" | "late" | "no_show" | "skipped";
export type ApplicationStatus = "pending" | "approved" | "rejected" | "waitlisted" | "withdrawn";
export type WaitlistStatus = "waiting" | "offered" | "accepted" | "declined" | "expired" | "removed";
export type ConfirmationStatus = "unconfirmed" | "confirmed" | "declined";
export type CheckInStatus = "not_checked_in" | "checked_in" | "missed";
export type AttendanceStatus =
  | "pending" | "attended" | "completed" | "cancelled_with_notice"
  | "last_minute_cancellation" | "late" | "no_show";
export type NotificationType =
  | "signup_confirmation" | "application_approved" | "application_rejected"
  | "added_to_waitlist" | "slot_changed" | "reminder_24h" | "reminder_2h"
  | "check_in_reminder" | "you_are_next" | "cancellation_confirmation"
  | "replacement_offer" | "custom";
export type DeliveryMethod = "email" | "sms" | "push" | "discord";
export type DeliveryStatus = "queued" | "sent" | "failed";
export type TransferStatus = "pending" | "accepted" | "declined" | "cancelled";
export type CoConductorStatus = "pending" | "accepted" | "declined" | "removed";

interface Table<Row, Insert, Update> {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
}

interface Fn<Args, Returns> {
  Args: Args;
  Returns: Returns;
}

export interface Database {
  public: {
    Tables: {
      users: Table<
        {
          id: string; email: string; role: UserRole; onboarded: boolean;
          created_at: string; updated_at: string;
        },
        { id: string; email: string; role?: UserRole; onboarded?: boolean },
        { role?: UserRole }
      >;
      profiles: Table<
        {
          id: string; user_id: string; display_name: string; phone: string | null;
          profile_photo_url: string | null; bio: string | null; timezone: string;
          created_at: string; updated_at: string;
        },
        {
          user_id: string; display_name: string; phone?: string | null;
          profile_photo_url?: string | null; bio?: string | null; timezone?: string;
        },
        Partial<{
          display_name: string; phone: string | null; profile_photo_url: string | null;
          bio: string | null; timezone: string;
        }>
      >;
      seller_profiles: Table<
        {
          id: string; user_id: string; whatnot_username: string; whatnot_profile_url: string;
          shop_logo_url: string | null; group_id: string | null; seller_category: string | null;
          sales_level: string | null; created_at: string; updated_at: string;
        },
        {
          user_id: string; whatnot_username: string; whatnot_profile_url: string;
          shop_logo_url?: string | null; group_id?: string | null; seller_category?: string | null;
          sales_level?: string | null;
        },
        Partial<{
          whatnot_username: string; whatnot_profile_url: string; shop_logo_url: string | null;
          group_id: string | null; seller_category: string | null; sales_level: string | null;
        }>
      >;
      seller_groups: Table<
        {
          id: string; name: string; icon_url: string; created_by: string;
          created_at: string; updated_at: string;
        },
        {
          name: string; icon_url: string; created_by: string;
        },
        Partial<{
          name: string; icon_url: string;
        }>
      >;
      organizer_profiles: Table<
        {
          id: string; user_id: string; organizer_name: string; whatnot_username: string | null;
          contact_email: string; created_at: string; updated_at: string;
        },
        {
          user_id: string; organizer_name: string; whatnot_username?: string | null;
          contact_email: string;
        },
        Partial<{ organizer_name: string; whatnot_username: string | null; contact_email: string }>
      >;
      raid_trains: Table<
        {
          id: string; organizer_id: string; name: string; slug: string; description: string | null;
          theme: string | null; category: string | null; image_url: string | null;
          image_position: string; image_fit: string;
          event_date: string; start_time: string; end_time: string; timezone: string;
          slot_duration_minutes: number; break_minutes: number; signup_mode: TrainSignupMode;
          visibility: TrainVisibility; status: TrainStatus; rules: string | null;
          cancellation_policy: string | null; check_in_minutes_before: number;
          requires_whatnot_profile: boolean; requires_show_link: boolean;
          sales_level_requirement: string | null; additional_questions: string[];
          invite_code: string | null; cloned_from_id: string | null;
          seller_thumbnail_url: string | null; discord_webhook_url: string | null;
          published_at: string | null; created_at: string; updated_at: string;
        },
        Partial<{
          description: string | null; theme: string | null; category: string | null;
          image_url: string | null; image_position: string; image_fit: string; timezone: string; break_minutes: number;
          signup_mode: TrainSignupMode; visibility: TrainVisibility; status: TrainStatus;
          rules: string | null; cancellation_policy: string | null; check_in_minutes_before: number;
          requires_whatnot_profile: boolean; requires_show_link: boolean;
          sales_level_requirement: string | null; additional_questions: string[];
          invite_code: string | null; cloned_from_id: string | null; published_at: string | null;
          seller_thumbnail_url: string | null; discord_webhook_url: string | null;
        }> & {
          organizer_id: string; name: string; slug: string; event_date: string;
          start_time: string; end_time: string; slot_duration_minutes: number;
        },
        Partial<{
          name: string; slug: string; description: string | null; theme: string | null;
          category: string | null; image_url: string | null; image_position: string; image_fit: string; event_date: string;
          start_time: string; end_time: string; timezone: string; slot_duration_minutes: number;
          break_minutes: number; signup_mode: TrainSignupMode; visibility: TrainVisibility;
          status: TrainStatus; rules: string | null; cancellation_policy: string | null;
          check_in_minutes_before: number; requires_whatnot_profile: boolean;
          requires_show_link: boolean; sales_level_requirement: string | null;
          additional_questions: string[]; invite_code: string | null; published_at: string | null;
          seller_thumbnail_url: string | null; discord_webhook_url: string | null;
        }>
      >;
      train_slots: Table<
        {
          id: string; raid_train_id: string; start_datetime: string; end_datetime: string;
          position: number; status: SlotStatus; seller_id: string | null;
          application_id: string | null; held_until: string | null;
          created_at: string; updated_at: string;
        },
        {
          raid_train_id: string; start_datetime: string; end_datetime: string; position: number;
          status?: SlotStatus; seller_id?: string | null; application_id?: string | null;
          held_until?: string | null;
        },
        Partial<{
          start_datetime: string; end_datetime: string; position: number; status: SlotStatus;
          seller_id: string | null; application_id: string | null; held_until: string | null;
        }>
      >;
      train_applications: Table<
        {
          id: string; raid_train_id: string; slot_id: string | null; seller_id: string;
          requested_time: string | null; status: ApplicationStatus; organizer_notes: string | null;
          seller_notes: string | null; show_url: string | null; custom_answers: unknown;
          created_at: string; updated_at: string;
        },
        {
          raid_train_id: string; seller_id: string; slot_id?: string | null;
          requested_time?: string | null; status?: ApplicationStatus; seller_notes?: string | null;
          show_url?: string | null; custom_answers?: unknown;
        },
        Partial<{
          slot_id: string | null; status: ApplicationStatus; organizer_notes: string | null;
          seller_notes: string | null; show_url: string | null; custom_answers: unknown;
        }>
      >;
      waitlist_entries: Table<
        {
          id: string; raid_train_id: string; seller_id: string; preferred_times: string | null;
          position: number; status: WaitlistStatus; offered_slot_id: string | null;
          offer_expires_at: string | null; created_at: string; updated_at: string;
        },
        {
          raid_train_id: string; seller_id: string; preferred_times?: string | null;
          position: number; status?: WaitlistStatus;
        },
        Partial<{
          position: number; status: WaitlistStatus; offered_slot_id: string | null;
          offer_expires_at: string | null;
        }>
      >;
      train_participants: Table<
        {
          id: string; raid_train_id: string; seller_id: string; slot_id: string | null;
          confirmation_status: ConfirmationStatus; check_in_status: CheckInStatus;
          checked_in_at: string | null; show_url: string | null; attendance_status: AttendanceStatus;
          organizer_notes: string | null; reminder_24h_sent_at: string | null;
          reminder_2h_sent_at: string | null; checkin_reminder_sent_at: string | null;
          created_at: string; updated_at: string;
        },
        {
          raid_train_id: string; seller_id: string; slot_id?: string | null;
          confirmation_status?: ConfirmationStatus; show_url?: string | null;
        },
        Partial<{
          slot_id: string | null; confirmation_status: ConfirmationStatus; check_in_status: CheckInStatus;
          checked_in_at: string | null; show_url: string | null; attendance_status: AttendanceStatus;
          organizer_notes: string | null; reminder_24h_sent_at: string | null;
          reminder_2h_sent_at: string | null; checkin_reminder_sent_at: string | null;
        }>
      >;
      notifications: Table<
        {
          id: string; user_id: string; raid_train_id: string | null;
          notification_type: NotificationType; subject: string; message: string;
          delivery_method: DeliveryMethod; delivery_status: DeliveryStatus;
          sent_at: string | null; created_at: string;
        },
        {
          user_id: string; raid_train_id?: string | null; notification_type: NotificationType;
          subject: string; message: string; delivery_method?: DeliveryMethod;
          delivery_status?: DeliveryStatus;
        },
        Partial<{ delivery_status: DeliveryStatus; sent_at: string | null }>
      >;
      seller_history: Table<
        {
          id: string; seller_id: string; raid_train_id: string; organizer_id: string;
          attendance_status: AttendanceStatus; raid_completed: boolean;
          cancellation_notice_hours: number | null; private_notes: string | null; created_at: string;
        },
        {
          seller_id: string; raid_train_id: string; organizer_id: string;
          attendance_status?: AttendanceStatus; raid_completed?: boolean;
          cancellation_notice_hours?: number | null; private_notes?: string | null;
        },
        Partial<{
          attendance_status: AttendanceStatus; raid_completed: boolean;
          cancellation_notice_hours: number | null; private_notes: string | null;
        }>
      >;
      train_activity_log: Table<
        {
          id: string; raid_train_id: string; user_id: string | null; action_type: string;
          action_details: Record<string, unknown> | null; created_at: string;
        },
        {
          raid_train_id: string; user_id?: string | null; action_type: string;
          action_details?: Record<string, unknown> | null;
        },
        Record<string, never>
      >;
      favorites: Table<
        { id: string; user_id: string; raid_train_id: string; created_at: string },
        { user_id: string; raid_train_id: string },
        Record<string, never>
      >;
      train_transfers: Table<
        {
          id: string; raid_train_id: string; from_organizer_id: string; to_organizer_id: string;
          to_email: string; status: TransferStatus; created_at: string; responded_at: string | null;
        },
        {
          raid_train_id: string; from_organizer_id: string; to_organizer_id: string;
          to_email: string; status?: TransferStatus;
        },
        Record<string, never>
      >;
      train_co_conductors: Table<
        {
          id: string; raid_train_id: string; organizer_id: string; invited_by: string;
          to_email: string; status: CoConductorStatus; created_at: string; responded_at: string | null;
        },
        {
          raid_train_id: string; organizer_id: string; invited_by: string;
          to_email: string; status?: CoConductorStatus;
        },
        Record<string, never>
      >;
    };
    Views: {
      train_applications_seller_view: {
        Row: {
          id: string; raid_train_id: string; slot_id: string | null; seller_id: string;
          requested_time: string | null; status: ApplicationStatus; seller_notes: string | null;
          show_url: string | null; custom_answers: unknown; created_at: string; updated_at: string;
        };
        Relationships: [];
      };
      train_participants_public_view: {
        Row: {
          id: string; raid_train_id: string; seller_id: string; slot_id: string | null;
          confirmation_status: ConfirmationStatus; check_in_status: CheckInStatus;
          show_url: string | null; attendance_status: AttendanceStatus;
          created_at: string; updated_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      hold_train_slot: Fn<
        { p_slot_id: string; p_hold_minutes?: number },
        Database["public"]["Tables"]["train_slots"]["Row"]
      >;
      release_train_slot: Fn<{ p_slot_id: string }, undefined>;
      release_expired_holds_for_train: Fn<{ p_train_id: string }, undefined>;
      submit_train_application: Fn<
        {
          p_slot_id: string;
          p_seller_notes?: string | null;
          p_show_url?: string | null;
          p_custom_answers?: unknown;
          p_invite_code?: string | null;
        },
        Database["public"]["Tables"]["train_applications"]["Row"]
      >;
      join_train_waitlist: Fn<
        { p_train_id: string; p_preferred_times?: string | null },
        Database["public"]["Tables"]["waitlist_entries"]["Row"]
      >;
      cancel_train_participation: Fn<{ p_train_id: string }, undefined>;
      accept_waitlist_offer: Fn<{ p_waitlist_entry_id: string }, undefined>;
      decline_waitlist_offer: Fn<{ p_waitlist_entry_id: string }, undefined>;
      release_expired_waitlist_offers_for_train: Fn<{ p_train_id: string }, undefined>;
      swap_train_slot_sellers: Fn<{ p_slot_a_id: string; p_slot_b_id: string }, undefined>;
      complete_oauth_onboarding: Fn<{ p_role: UserRole }, undefined>;
      get_top_organizers: Fn<
        { p_limit?: number },
        { organizer_id: string; organizer_name: string; completed_trains: number }[]
      >;
      get_top_sellers: Fn<
        { p_limit?: number },
        {
          seller_id: string; display_name: string; whatnot_username: string | null;
          completed_trains: number;
        }[]
      >;
      get_current_trains: Fn<
        { p_limit?: number },
        {
          train_id: string; name: string; slug: string; category: string | null;
          event_date: string; timezone: string; organizer_name: string;
        }[]
      >;
      get_upcoming_trains: Fn<
        { p_limit?: number },
        {
          train_id: string; name: string; slug: string; category: string | null;
          event_date: string; start_time: string; timezone: string; organizer_name: string;
        }[]
      >;
      get_organizer_completed_count: Fn<{ p_organizer_id: string }, number>;
      get_organizer_rider_count: Fn<{ p_organizer_id: string }, number>;
      get_seller_completed_counts: Fn<
        { p_seller_ids: string[] },
        { seller_id: string; completed_trains: number }[]
      >;
      initiate_train_transfer: Fn<{ p_raid_train_id: string; p_to_email: string }, string>;
      respond_to_train_transfer: Fn<{ p_transfer_id: string; p_accept: boolean }, undefined>;
      cancel_train_transfer: Fn<{ p_transfer_id: string }, undefined>;
      invite_co_conductor: Fn<{ p_raid_train_id: string; p_to_email: string }, string>;
      respond_to_co_conductor_invite: Fn<{ p_invite_id: string; p_accept: boolean }, undefined>;
      remove_co_conductor: Fn<{ p_id: string }, undefined>;
      get_group_members: Fn<
        { p_group_id: string },
        { seller_id: string; whatnot_username: string; whatnot_profile_url: string }[]
      >;
    };
  };
}
