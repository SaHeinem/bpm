import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/services/supabase"
import { queryKeys } from "@/lib/query-keys"
import type { Participant } from "@/types/database"

export interface ParticipantPayload {
  pretix_id: string
  given_name: string
  family_name: string
  attendee_name: string
  attendee_email: string
  is_table_captain: boolean
  captain_phone?: string | null
  captain_preferred_contact?: string | null
  status?: Participant["status"]
}

async function fetchParticipants(): Promise<Participant[]> {
  const { data, error } = await supabase.from("participants").select("*").order("given_name", { ascending: true })
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

async function bulkUpsertParticipants(payload: ParticipantPayload[]): Promise<void> {
  if (!payload.length) {
    return
  }

  const { error } = await supabase.from("participants").upsert(
    payload.map((participant) => ({
      status: participant.status ?? "registered",
      ...participant,
    })),
    {
      onConflict: "pretix_id",
      ignoreDuplicates: false,
    },
  )

  if (error) {
    throw error
  }
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

  return {
    participants: participantsQuery.data ?? [],
    isLoading: participantsQuery.isLoading,
    refetch: participantsQuery.refetch,
    createParticipant,
    editParticipant,
    removeParticipant,
    bulkImportParticipants,
  }
}
