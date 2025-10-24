/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PretixAttendeeNameParts {
  _scheme: string
  given_name: string
  family_name: string
}

interface PretixPosition {
  id: number
  order: string
  positionid: number
  item: number
  variation: number | null
  price: string
  attendee_name: string
  attendee_name_parts: PretixAttendeeNameParts
  company: string | null
  street: string | null
  zipcode: string | null
  city: string | null
  country: string | null
  state: string | null
  attendee_email: string | null
  voucher: number | null
  tax_rate: string
  tax_value: string
  secret: string
  addon_to: number | null
  subevent: number | null
  checkins: unknown[]
  order__status: string
  order__valid_if_pending: boolean
  order__require_approval: boolean
  require_attention: boolean
  blocked: string | null
}

interface PretixResponse {
  count: number
  next: string | null
  previous: string | null
  results: PretixPosition[]
}

interface SyncResult {
  newParticipants: number
  updatedParticipants: number
  cancelledParticipants: number
  errors: Array<{ pretixId: number; reason: string }>
}

async function fetchPretixPositions(
  checkinListId: string,
  apiToken: string,
  event: string,
  organizer: string = 'denog'
): Promise<PretixPosition[]> {
  const allPositions: PretixPosition[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const url = `https://pretix.eu/api/v1/organizers/${organizer}/events/${event}/checkinlists/${checkinListId}/positions/?page=${page}`

    console.log(`Fetching page ${page} from ${url}`)

    const response = await fetch(url, {
      headers: {
        'Authorization': `Token ${apiToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Pretix API error: ${response.status} ${response.statusText}`)
    }

    const data: PretixResponse = await response.json()
    allPositions.push(...data.results)

    if (data.next) {
      page++
    } else {
      hasMore = false
    }
  }

  return allPositions
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get Pretix configuration from environment
    const pretixApiToken = Deno.env.get('PRETIX_API_TOKEN')
    const pretixEvent = Deno.env.get('PRETIX_EVENT')
    const pretixLocalListId = Deno.env.get('PRETIX_CHECKIN_LIST_ID_LOCAL')
    const pretixGlobalListId = Deno.env.get('PRETIX_CHECKIN_LIST_ID_GLOBAL')

    if (!pretixApiToken || !pretixEvent || !pretixLocalListId || !pretixGlobalListId) {
      throw new Error('Missing Pretix configuration in environment variables')
    }

    const result: SyncResult = {
      newParticipants: 0,
      updatedParticipants: 0,
      cancelledParticipants: 0,
      errors: [],
    }

    // Fetch existing participants from database
    const { data: existingParticipants, error: fetchError } = await supabase
      .from('participants')
      .select('*')

    if (fetchError) {
      throw fetchError
    }

    const existingParticipantsMap = new Map()
    const existingPretixIds = new Set<number>()

    for (const participant of existingParticipants || []) {
      if (participant.pretix_id) {
        existingParticipantsMap.set(participant.pretix_id, participant)
        existingPretixIds.add(participant.pretix_id)
      }
    }

    // Step 1: Fetch all positions from LOCAL checkin list
    console.log('Fetching positions from LOCAL checkin list...')
    const localPositions = await fetchPretixPositions(pretixLocalListId, pretixApiToken, pretixEvent)
    console.log(`Found ${localPositions.length} positions in LOCAL list`)

    // Step 2: Fetch all positions from GLOBAL checkin list for email addresses
    console.log('Fetching positions from GLOBAL checkin list for emails...')
    const globalPositions = await fetchPretixPositions(pretixGlobalListId, pretixApiToken, pretixEvent)
    console.log(`Found ${globalPositions.length} positions in GLOBAL list`)

    // Create maps for email lookup
    // Map 1: order code -> email (for matching by order)
    // Map 2: position id -> email (for direct matching)
    const emailByOrder = new Map<string, string>()
    const emailByPositionId = new Map<number, string>()

    for (const position of globalPositions) {
      if (position.attendee_email) {
        // Store by order code
        emailByOrder.set(position.order, position.attendee_email)
        // Also store by position ID
        emailByPositionId.set(position.id, position.attendee_email)
      }
    }

    console.log(`Email map sizes - by order: ${emailByOrder.size}, by position ID: ${emailByPositionId.size}`)

    // Step 3: Process each position from LOCAL list
    const pretixIdsFromPretix = new Set<number>()

    for (const position of localPositions) {
      pretixIdsFromPretix.add(position.id)

      // Get email from GLOBAL list using multiple strategies:
      // 1. Direct match by position ID
      // 2. Match by order code (for add-on items)
      const email = position.attendee_email ||
                    emailByPositionId.get(position.id) ||
                    emailByOrder.get(position.order)

      if (!email) {
        result.errors.push({
          pretixId: position.id,
          reason: `No email found (order: ${position.order}, addon_to: ${position.addon_to})`,
        })
        continue
      }

      const participantData = {
        pretix_id: position.id,
        given_name: position.attendee_name_parts.given_name,
        family_name: position.attendee_name_parts.family_name,
        attendee_name: position.attendee_name,
        attendee_email: email,
        is_table_captain: false,
        captain_phone: null,
        captain_preferred_contact: null,
        status: 'registered',
      }

      // Check if participant already exists
      const existingParticipant = existingParticipantsMap.get(position.id)

      if (existingParticipant) {
        // Update only if status needs to change or basic info changed
        // Don't overwrite captain fields or manually set statuses
        const updates: any = {
          given_name: participantData.given_name,
          family_name: participantData.family_name,
          attendee_name: participantData.attendee_name,
          attendee_email: participantData.attendee_email,
        }

        // Only update status if it hasn't been manually overridden
        if (!existingParticipant.manual_status_override && existingParticipant.status === 'cancelled') {
          updates.status = 'registered'
        }

        const { error: updateError } = await supabase
          .from('participants')
          .update(updates)
          .eq('pretix_id', position.id)

        if (updateError) {
          result.errors.push({
            pretixId: position.id,
            reason: `Update failed: ${updateError.message}`,
          })
        } else {
          result.updatedParticipants++
        }
      } else {
        // Insert new participant
        const { error: insertError } = await supabase
          .from('participants')
          .insert(participantData)

        if (insertError) {
          result.errors.push({
            pretixId: position.id,
            reason: `Insert failed: ${insertError.message}`,
          })
        } else {
          result.newParticipants++
        }
      }
    }

    // Step 4: Mark participants not in Pretix as cancelled (only if not manually overridden)
    for (const pretixId of existingPretixIds) {
      if (!pretixIdsFromPretix.has(pretixId)) {
        const participant = existingParticipantsMap.get(pretixId)
        // Only auto-cancel if status wasn't manually set and participant is not already cancelled
        if (participant && participant.status !== 'cancelled' && !participant.manual_status_override) {
          const { error: cancelError } = await supabase
            .from('participants')
            .update({ status: 'cancelled' })
            .eq('pretix_id', pretixId)

          if (cancelError) {
            result.errors.push({
              pretixId,
              reason: `Failed to mark as cancelled: ${cancelError.message}`,
            })
          } else {
            result.cancelledParticipants++
          }
        }
      }
    }

    console.log('Sync completed:', result)

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Sync error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
