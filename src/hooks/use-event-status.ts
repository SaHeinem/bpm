import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/services/supabase"
import { queryKeys } from "@/lib/query-keys"
import type { EventStatus, EventWorkflowState } from "@/types/database"

const DEFAULT_STATE: EventStatus = {
  id: "default",
  state: "setup",
  updated_at: new Date(0).toISOString(),
}

async function fetchEventStatus(): Promise<EventStatus> {
  const { data, error } = await supabase.from("event_status").select("*").order("updated_at", { ascending: false }).limit(1)
  if (error) {
    throw error
  }
  if (!data || data.length === 0) {
    return DEFAULT_STATE
  }
  return data[0] as EventStatus
}

async function updateEventStatus(state: EventWorkflowState): Promise<EventStatus> {
  const { data, error } = await supabase
    .from("event_status")
    .upsert({ id: DEFAULT_STATE.id, state, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data as EventStatus
}

export function useEventStatus() {
  const queryClient = useQueryClient()

  const eventStatusQuery = useQuery({
    queryKey: queryKeys.eventStatus.all,
    queryFn: fetchEventStatus,
  })

  const setEventStatusMutation = useMutation({
    mutationFn: updateEventStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.eventStatus.all })
    },
  })

  return {
    eventStatus: eventStatusQuery.data ?? DEFAULT_STATE,
    isLoading: eventStatusQuery.isLoading,
    refetch: eventStatusQuery.refetch,
    setEventStatusMutation,
  }
}
