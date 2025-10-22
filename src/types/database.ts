export type EventWorkflowState = "setup" | "captains_assigned" | "participants_assigned" | "finalized"

export interface Restaurant {
  id: string
  name: string
  address: string
  phone: string | null
  taxi_time: number | null
  public_transport_time: number | null
  public_transport_lines: string | null
  max_seats: number
  assigned_captain_id: string | null
  reservation_channel: string | null
  reservation_name: string | null
  reservation_confirmed: string | null
  created_at: string
  updated_at: string
}

export interface Participant {
  id: string
  pretix_id: string
  given_name: string
  family_name: string
  attendee_name: string
  attendee_email: string
  is_table_captain: boolean
  captain_phone: string | null
  captain_preferred_contact: string | null
  status: "registered" | "cancelled" | "late_joiner"
  created_at: string
  updated_at: string
}

export interface Assignment {
  id: string
  participant_id: string
  restaurant_id: string
  assigned_at: string
  created_at: string
}

export interface RestaurantWithRelations extends Restaurant {
  captain?: Participant | null
  assignments?: Assignment[]
}

export interface AssignmentWithParticipantRestaurant extends Assignment {
  participant: Participant
  restaurant: Restaurant
}

export interface EventStatus {
  id: string
  state: EventWorkflowState
  updated_at: string
}

export interface ActivityLogEntry {
  id: string
  event_type: string
  description: string
  actor: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

export type EmailType = "initial_assignment" | "final_assignment" | "individual_update"

export interface EmailLog {
  id: string
  participant_id: string
  restaurant_id: string | null
  email_type: EmailType
  recipient_email: string
  subject: string
  body_text: string
  sent_at: string
  sent_by: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface RestaurantComment {
  id: string
  restaurant_id: string
  comment_text: string
  created_by: string | null
  created_at: string
  updated_at: string
  created_by_email?: string | null
}

export interface ParticipantComment {
  id: string
  participant_id: string
  comment_text: string
  created_by: string | null
  created_at: string
  updated_at: string
  created_by_email?: string | null
}
