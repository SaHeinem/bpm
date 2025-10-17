import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/services/supabase"
import { queryKeys } from "@/lib/query-keys"
import type { Restaurant } from "@/types/database"

export interface RestaurantPayload {
  name: string
  address: string
  max_seats: number
  taxi_time?: number | null
  public_transport_time?: number | null
  public_transport_lines?: string | null
  assigned_captain_id?: string | null
}

async function fetchRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await supabase.from("restaurants").select("*").order("name", { ascending: true })
  if (error) {
    throw error
  }
  return (data ?? []) as Restaurant[]
}

async function insertRestaurant(payload: RestaurantPayload): Promise<Restaurant> {
  const { data, error } = await supabase.from("restaurants").insert(payload).select("*").single()
  if (error) {
    throw error
  }
  return data as Restaurant
}

async function updateRestaurant(id: string, payload: Partial<RestaurantPayload>): Promise<Restaurant> {
  const { data, error } = await supabase.from("restaurants").update(payload).eq("id", id).select("*").single()
  if (error) {
    throw error
  }
  return data as Restaurant
}

async function deleteRestaurant(id: string): Promise<void> {
  const { error } = await supabase.from("restaurants").delete().eq("id", id)
  if (error) {
    throw error
  }
}

export function useRestaurants() {
  const queryClient = useQueryClient()

  const restaurantsQuery = useQuery({
    queryKey: queryKeys.restaurants.all,
    queryFn: fetchRestaurants,
  })

  const createRestaurant = useMutation({
    mutationFn: insertRestaurant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.all })
    },
  })

  const editRestaurant = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<RestaurantPayload> }) => updateRestaurant(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.all })
    },
  })

  const removeRestaurant = useMutation({
    mutationFn: deleteRestaurant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.all })
    },
  })

  return {
    restaurants: restaurantsQuery.data ?? [],
    isLoading: restaurantsQuery.isLoading,
    refetch: restaurantsQuery.refetch,
    createRestaurant,
    editRestaurant,
    removeRestaurant,
  }
}
