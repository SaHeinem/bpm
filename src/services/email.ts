import type { Participant, Restaurant } from "@/types/database"

export interface EmailTemplateData {
  participantName: string
  participantEmail: string
  restaurantName: string
  restaurantAddress: string
  taxiTime: string
  publicTransportTime: string
  transitLines: string
  captainName: string
  captainEmail: string
  captainPhone: string
  captainPreferredContact: string
  tableGuests: string
}

export function generateAssignmentEmail(data: EmailTemplateData): { subject: string; body: string } {
  const subject = `DENOG Pre-Social - Your Restaurant Assignment`

  const body = `Dear DENOG participant,

We're excited that you join the DENOG Pre-Social on Sunday, November 9, 2025!

Your assigned restaurant: ${data.restaurantName}
Address: ${data.restaurantAddress}

How to get there:
${data.taxiTime}${data.publicTransportTime}${data.transitLines}

Your Table Captain: ${data.captainName}
Contact: ${data.captainEmail}${data.captainPhone}
${data.captainPreferredContact}

Table Guests:
${data.tableGuests}

Please arrive by 19:00 at the restaurant to ensure we can start on
time. If you have any questions, please feel free to contact your
Table Captain directly.

As noted before - this social is self-paid, hence it is advisable to carry cash.

The reservation for the table is under the name "Florian Hibler".

We look forward to a wonderful evening with you!

Best regards,
Your DENOG Event Team`

  return { subject, body }
}

export function buildEmailTemplateData(
  participant: Participant,
  restaurant: Restaurant,
  captain: Participant | null,
  tableGuestsParam: Participant[]
): EmailTemplateData {
  const taxiTime = restaurant.taxi_time ? `By Taxi: ${restaurant.taxi_time} minutes\n` : ""
  const publicTransportTime = restaurant.public_transport_time
    ? `By Public Transport: ${restaurant.public_transport_time} minutes\n`
    : ""
  const transitLines = restaurant.public_transport_lines ? `${restaurant.public_transport_lines}\n` : ""

  const captainName = captain?.attendee_name ?? "To be assigned"
  const captainEmail = captain?.attendee_email ?? ""
  const captainPhone = captain?.captain_phone ? ` / ${captain.captain_phone}` : ""
  const captainPreferredContact = captain?.captain_preferred_contact
    ? `Preferred contact methods: ${captain.captain_preferred_contact}`
    : ""

  const tableGuestsFormatted = tableGuestsParam.length
    ? tableGuestsParam.map((guest) => `- ${guest.attendee_name} (${guest.attendee_email})`).join("\n")
    : "- No other guests assigned yet"

  return {
    participantName: participant.attendee_name,
    participantEmail: participant.attendee_email,
    restaurantName: restaurant.name,
    restaurantAddress: restaurant.address,
    taxiTime,
    publicTransportTime,
    transitLines,
    captainName,
    captainEmail,
    captainPhone,
    captainPreferredContact,
    tableGuests: tableGuestsFormatted,
  }
}

export interface SendEmailPayload {
  to: string
  subject: string
  body: string
}

/**
 * Send email via SMTP (using mailpit for local development)
 * Calls the Supabase Edge Function to send emails
 */
export async function sendEmail(payload: SendEmailPayload): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase configuration missing")
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(`Failed to send email: ${error.error || response.statusText}`)
  }

  const result = await response.json()
  console.log("Email sent successfully:", result)
}
