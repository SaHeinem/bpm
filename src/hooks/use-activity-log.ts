import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/services/supabase"
import { queryKeys } from "@/lib/query-keys"
import type { ActivityLogEntry } from "@/types/database"

async function fetchActivityLog(): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase.from("event_activity").select("*").order("created_at", { ascending: false })
  if (error) {
    throw error
  }
  return (data ?? []) as ActivityLogEntry[]
}

async function insertActivityLog(entry: Omit<ActivityLogEntry, "id" | "created_at">): Promise<ActivityLogEntry> {
  const { data, error } = await supabase
    .from("event_activity")
    .insert({ ...entry })
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data as ActivityLogEntry
}

export function useActivityLog() {
  const queryClient = useQueryClient()

  const activityLogQuery = useQuery({
    queryKey: queryKeys.activityLog.all,
    queryFn: fetchActivityLog,
  })

  const createActivityLogEntry = useMutation({
    mutationFn: insertActivityLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activityLog.all })
    },
  })

  return {
    activityLog: activityLogQuery.data ?? [],
    isLoading: activityLogQuery.isLoading,
    refetch: activityLogQuery.refetch,
    createActivityLogEntry,
  }
}

export function useActivityLogger() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: insertActivityLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activityLog.all })
    },
  })
}
