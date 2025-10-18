import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/services/supabase"
import { queryKeys } from "@/lib/query-keys"
import type { EmailLog, EmailType, Participant, Restaurant } from "@/types/database"
import { buildEmailTemplateData, generateAssignmentEmail, sendEmail } from "@/services/email"

export interface SendEmailToParticipantPayload {
  participant: Participant
  restaurant: Restaurant
  captain: Participant | null
  tableGuests: Participant[]
  emailType: EmailType
}

export interface SendBulkEmailsPayload {
  emails: SendEmailToParticipantPayload[]
  emailType: EmailType
}

async function fetchEmailLogs(): Promise<EmailLog[]> {
  const { data, error } = await supabase.from("email_logs").select("*").order("sent_at", { ascending: false })
  if (error) {
    throw error
  }
  return (data ?? []) as EmailLog[]
}

async function logEmail(payload: {
  participantId: string
  restaurantId: string | null
  emailType: EmailType
  recipientEmail: string
  subject: string
  bodyText: string
  sentBy?: string | null
  metadata?: Record<string, unknown>
}): Promise<EmailLog> {
  const { data, error } = await supabase
    .from("email_logs")
    .insert({
      participant_id: payload.participantId,
      restaurant_id: payload.restaurantId,
      email_type: payload.emailType,
      recipient_email: payload.recipientEmail,
      subject: payload.subject,
      body_text: payload.bodyText,
      sent_by: payload.sentBy ?? null,
      metadata: payload.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) {
    throw error
  }

  return data as EmailLog
}

async function sendEmailToParticipant(payload: SendEmailToParticipantPayload): Promise<EmailLog> {
  const templateData = buildEmailTemplateData(payload.participant, payload.restaurant, payload.captain, payload.tableGuests)
  const { subject, body } = generateAssignmentEmail(templateData)

  // Send the actual email
  await sendEmail({
    to: payload.participant.attendee_email,
    subject,
    body,
  })

  // Log the email in the database
  return logEmail({
    participantId: payload.participant.id,
    restaurantId: payload.restaurant.id,
    emailType: payload.emailType,
    recipientEmail: payload.participant.attendee_email,
    subject,
    bodyText: body,
    metadata: {
      restaurantName: payload.restaurant.name,
      captainName: payload.captain?.attendee_name ?? null,
      guestCount: payload.tableGuests.length,
    },
  })
}

async function sendBulkEmails(payload: SendBulkEmailsPayload): Promise<EmailLog[]> {
  const results: EmailLog[] = []

  for (const emailPayload of payload.emails) {
    try {
      const log = await sendEmailToParticipant(emailPayload)
      results.push(log)
    } catch (error) {
      console.error(`Failed to send email to ${emailPayload.participant.attendee_email}:`, error)
      // Continue with other emails even if one fails
    }
  }

  return results
}

export function useEmails() {
  const queryClient = useQueryClient()

  const emailLogsQuery = useQuery({
    queryKey: queryKeys.emailLogs,
    queryFn: fetchEmailLogs,
  })

  const sendEmailMutation = useMutation({
    mutationFn: sendEmailToParticipant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailLogs })
    },
  })

  const sendBulkEmailsMutation = useMutation({
    mutationFn: sendBulkEmails,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emailLogs })
    },
  })

  return {
    emailLogs: emailLogsQuery.data ?? [],
    isLoading: emailLogsQuery.isLoading,
    refetch: emailLogsQuery.refetch,
    sendEmailMutation,
    sendBulkEmailsMutation,
  }
}
