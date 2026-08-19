"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TransferFormState = {
  error?: string;
  success?: string;
};

export async function initiateTransfer(
  trainId: string,
  _prevState: TransferFormState,
  formData: FormData
): Promise<TransferFormState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const email = formData.get("toEmail");
  if (typeof email !== "string" || !email.trim() || !email.includes("@")) {
    return { error: "Enter the recipient's account email." };
  }

  const { error } = await supabase.rpc("initiate_train_transfer", {
    p_raid_train_id: trainId,
    p_to_email: email,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/organizer/trains/${trainId}/transfer`);
  return { success: `Transfer request sent to ${email.trim()}. Ownership moves once they accept it.` };
}

export async function cancelTransfer(trainId: string, transferId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("cancel_train_transfer", { p_transfer_id: transferId });
  revalidatePath(`/dashboard/organizer/trains/${trainId}/transfer`);
}
