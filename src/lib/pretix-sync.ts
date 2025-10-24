import { supabase } from "@/services/supabase"

export interface SyncResult {
  newParticipants: number
  updatedParticipants: number
  cancelledParticipants: number
  errors: Array<{ pretixId: number; reason: string }>
}

/**
 * Syncs participants from Pretix to the database via Supabase Edge Function
 *
 * Process (handled by Edge Function):
 * 1. Fetch all positions from LOCAL checkin list
 * 2. Fetch all positions from GLOBAL checkin list for email addresses
 * 3. Match positions and update/create participants
 * 4. Mark participants not in Pretix as cancelled
 */
export async function syncParticipantsFromPretix(): Promise<SyncResult> {
  try {
    const { data, error } = await supabase.functions.invoke("pretix-sync", {
      method: "POST",
    })

    if (error) {
      throw error
    }

    if (!data) {
      throw new Error("No data returned from sync function")
    }

    return data as SyncResult
  } catch (error) {
    throw new Error(`Sync failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}
