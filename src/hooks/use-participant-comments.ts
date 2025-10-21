import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/services/supabase"
import { queryKeys } from "@/lib/query-keys"
import type { ParticipantComment } from "@/types/database"

export interface ParticipantCommentPayload {
  participant_id: string
  comment_text: string
}

async function fetchParticipantComments(participantId: string): Promise<ParticipantComment[]> {
  const { data, error } = await supabase
    .from("participant_comments")
    .select("*")
    .eq("participant_id", participantId)
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  // Fetch user emails for comments with created_by
  const comments = (data ?? []) as ParticipantComment[]
  const userIds = [...new Set(comments.map(c => c.created_by).filter(Boolean))]

  if (userIds.length > 0) {
    const emailPromises = userIds.map(async (userId) => {
      const { data: email } = await supabase.rpc('get_user_email', { user_id: userId })
      return { userId, email }
    })

    const emails = await Promise.all(emailPromises)
    const emailMap = new Map(emails.map(e => [e.userId, e.email]))

    return comments.map(comment => ({
      ...comment,
      created_by_email: comment.created_by ? emailMap.get(comment.created_by) : null
    }))
  }

  return comments
}

async function insertParticipantComment(payload: ParticipantCommentPayload): Promise<ParticipantComment> {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from("participant_comments")
    .insert({
      ...payload,
      created_by: user?.id ?? null,
    })
    .select("*")
    .single()

  if (error) {
    throw error
  }
  return data as ParticipantComment
}

async function updateParticipantComment(id: string, comment_text: string): Promise<ParticipantComment> {
  const { data, error } = await supabase
    .from("participant_comments")
    .update({ comment_text })
    .eq("id", id)
    .select("*")
    .single()

  if (error) {
    throw error
  }
  return data as ParticipantComment
}

async function deleteParticipantComment(id: string): Promise<void> {
  const { error } = await supabase
    .from("participant_comments")
    .delete()
    .eq("id", id)

  if (error) {
    throw error
  }
}

export function useParticipantComments(participantId: string) {
  const queryClient = useQueryClient()

  const commentsQuery = useQuery({
    queryKey: queryKeys.participantComments.byParticipant(participantId),
    queryFn: () => fetchParticipantComments(participantId),
    enabled: !!participantId,
  })

  const createComment = useMutation({
    mutationFn: insertParticipantComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.participantComments.byParticipant(participantId) })
    },
  })

  const editComment = useMutation({
    mutationFn: ({ id, comment_text }: { id: string; comment_text: string }) =>
      updateParticipantComment(id, comment_text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.participantComments.byParticipant(participantId) })
    },
  })

  const removeComment = useMutation({
    mutationFn: deleteParticipantComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.participantComments.byParticipant(participantId) })
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
