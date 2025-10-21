import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/services/supabase"
import { queryKeys } from "@/lib/query-keys"
import type { RestaurantComment } from "@/types/database"

export interface RestaurantCommentPayload {
  restaurant_id: string
  comment_text: string
}

async function fetchRestaurantComments(restaurantId: string): Promise<RestaurantComment[]> {
  const { data, error } = await supabase
    .from("restaurant_comments")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  // Fetch user emails for comments with created_by
  const comments = (data ?? []) as RestaurantComment[]
  const userIds = [...new Set(comments.map(c => c.created_by).filter(Boolean))]

  console.log('Comments:', comments)
  console.log('User IDs to fetch:', userIds)

  if (userIds.length > 0) {
    const emailPromises = userIds.map(async (userId) => {
      const { data: email, error: emailError } = await supabase.rpc('get_user_email', { user_id: userId })
      console.log('Email for user', userId, ':', email, emailError)
      return { userId, email }
    })

    const emails = await Promise.all(emailPromises)
    const emailMap = new Map(emails.map(e => [e.userId, e.email]))

    console.log('Email map:', emailMap)

    return comments.map(comment => ({
      ...comment,
      created_by_email: comment.created_by ? emailMap.get(comment.created_by) : null
    }))
  }

  return comments
}

async function insertRestaurantComment(payload: RestaurantCommentPayload): Promise<RestaurantComment> {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from("restaurant_comments")
    .insert({
      ...payload,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single()

  if (error) {
    throw error
  }
  return data as RestaurantComment
}

async function updateRestaurantComment(id: string, comment_text: string): Promise<RestaurantComment> {
  const { data, error } = await supabase
    .from("restaurant_comments")
    .update({ comment_text })
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    throw error
  }
  return data as RestaurantComment
}

async function deleteRestaurantComment(id: string): Promise<void> {
  const { error } = await supabase
    .from("restaurant_comments")
    .delete()
    .eq("id", id)

  if (error) {
    throw error
  }
}

export function useRestaurantComments(restaurantId: string) {
  const queryClient = useQueryClient()

  const commentsQuery = useQuery({
    queryKey: queryKeys.restaurantComments.byRestaurant(restaurantId),
    queryFn: () => fetchRestaurantComments(restaurantId),
    enabled: !!restaurantId,
  })

  const createComment = useMutation({
    mutationFn: insertRestaurantComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurantComments.byRestaurant(restaurantId) })
    },
  })

  const editComment = useMutation({
    mutationFn: ({ id, comment_text }: { id: string; comment_text: string }) =>
      updateRestaurantComment(id, comment_text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurantComments.byRestaurant(restaurantId) })
    },
  })

  const removeComment = useMutation({
    mutationFn: deleteRestaurantComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.restaurantComments.byRestaurant(restaurantId) })
    },
  })

  return {
    comments: commentsQuery.data ?? [],
    isLoading: commentsQuery.isLoading,
    createComment,
    editComment,
    removeComment,
  }
}
