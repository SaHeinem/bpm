import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/services/supabase"
import { queryKeys } from "@/lib/query-keys"
import type { Assignment } from "@/types/database"

async function fetchAssignments(): Promise<Assignment[]> {
  const { data, error } = await supabase.from("assignments").select("*")
  if (error) {
    throw error
  }
  return (data ?? []) as Assignment[]
}

async function upsertAssignment(payload: { participant_id: string; restaurant_id: string }): Promise<Assignment> {
  const { data, error } = await supabase
    .from("assignments")
    .upsert(
      { ...payload, assigned_at: new Date().toISOString() },
      {
        onConflict: "participant_id",
        ignoreDuplicates: false,
      },
    )
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data as Assignment
}

async function removeAssignment(participantId: string): Promise<void> {
  const { error } = await supabase.from("assignments").delete().eq("participant_id", participantId)
  if (error) {
    throw error
  }
}

async function clearAllAssignments(): Promise<void> {
  const { error } = await supabase.from("assignments").delete().neq("participant_id", "")
  if (error) {
    throw error
  }
}

export function useAssignments() {
  const queryClient = useQueryClient()

  const assignmentsQuery = useQuery({
    queryKey: queryKeys.assignments.all,
    queryFn: fetchAssignments,
  })

  const assignMutation = useMutation({
    mutationFn: upsertAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all })
    },
  })

  const unassignMutation = useMutation({
    mutationFn: removeAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all })
    },
  })

  const clearAssignmentsMutation = useMutation({
    mutationFn: clearAllAssignments,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.assignments.all })
    },
  })

  return {
    assignments: assignmentsQuery.data ?? [],
    isLoading: assignmentsQuery.isLoading,
    refetch: assignmentsQuery.refetch,
    assignMutation,
    unassignMutation,
    clearAssignmentsMutation,
  }
}
