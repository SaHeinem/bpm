import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/services/supabase"
import { queryKeys } from "@/lib/query-keys"
import type { Participant } from "@/types/database"
import { syncParticipantsFromPretix } from "@/lib/pretix-sync"

export interface ParticipantPayload {
  pretix_id?: number | null
  given_name: string
  family_name: string
  attendee_name: string
  attendee_email: string
  is_table_captain: boolean
  captain_phone?: string | null
  captain_preferred_contact?: string | null
  status?: Participant["status"]
  manual_status_override?: boolean
  manual_email_override?: boolean
}

async function fetchParticipants(): Promise<Participant[]> {
  const { data, error } = await supabase.from("participants").select("*").order("created_at", { ascending: true })
  if (error) {
    throw error
  }
  return (data ?? []) as Participant[]
}

async function insertParticipant(payload: ParticipantPayload): Promise<Participant> {
  const { data, error } = await supabase.from("participants").insert(payload).select("*").single()
  if (error) {
    throw error
  }
  return data as Participant
}

async function updateParticipant(id: string, payload: Partial<ParticipantPayload>): Promise<Participant> {
  const { data, error } = await supabase.from("participants").update(payload).eq("id", id).select("*").single()
  if (error) {
    throw error
  }
  return data as Participant
}

async function deleteParticipant(id: string): Promise<void> {
  const { error } = await supabase.from("participants").delete().eq("id", id)
  if (error) {
    throw error
  }
}

export interface BulkImportResult {
  succeeded: number
  failed: number
  errors: Array<{ email: string; reason: string }>
}

async function bulkUpsertParticipants(payload: ParticipantPayload[]): Promise<BulkImportResult> {
  if (!payload.length) {
    return { succeeded: 0, failed: 0, errors: [] }
  }

  const result: BulkImportResult = {
    succeeded: 0,
    failed: 0,
    errors: [],
  }

  // Process each participant individually to handle conflicts gracefully
  for (const participant of payload) {
    // Use pretix_id as conflict key if available, otherwise fall back to email
    const conflictKey = participant.pretix_id ? "pretix_id" : "attendee_email"

    const { error } = await supabase.from("participants").upsert(
      {
        status: participant.status ?? "registered",
        ...participant,
      },
      {
        onConflict: conflictKey,
        ignoreDuplicates: false,
      },
    )

    if (error) {
      result.failed++
      result.errors.push({
        email: participant.attendee_email,
        reason: error.message,
      })
    } else {
      result.succeeded++
    }
  }

  return result
}

export function useParticipants() {
  const queryClient = useQueryClient()

  const participantsQuery = useQuery({
    queryKey: queryKeys.participants.all,
    queryFn: fetchParticipants,
  })

  const createParticipant = useMutation({
    mutationFn: insertParticipant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.participants.all })
    },
  })

  const editParticipant = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ParticipantPayload> }) =>
      updateParticipant(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.participants.all })
    },
  })

  const removeParticipant = useMutation({
    mutationFn: deleteParticipant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.participants.all })
    },
  })

  const bulkImportParticipants = useMutation({
    mutationFn: bulkUpsertParticipants,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.participants.all })
    },
  })

  const syncFromPretix = useMutation({
    mutationFn: syncParticipantsFromPretix,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.participants.all })
    },
  })

  return {
    participants: participantsQuery.data ?? [],
    isLoading: participantsQuery.isLoading,
    refetch: participantsQuery.refetch,
    createParticipant,
    editParticipant,
    removeParticipant,
    bulkImportParticipants,
    syncFromPretix,
  }
}
