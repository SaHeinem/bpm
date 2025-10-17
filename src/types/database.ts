export type EventWorkflowState = "setup" | "captains_assigned" | "participants_assigned" | "finalized"

export interface Restaurant {
  id: string
  name: string
  address: string
  taxi_time: number | null
  public_transport_time: number | null
  public_transport_lines: string | null
  max_seats: number
  assigned_captain_id: string | null
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
