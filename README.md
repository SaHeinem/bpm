# Blind Peering Event Management

React + TypeScript dashboard for running blind peering dinners. Manage restaurants, captains, and participants, automate table assignments, and export captain handouts.

## Features

- Restaurant and participant CRUD with ShadCN UI
- Workflow tracking (`setup → captains → participants → finalized`)
- Random captain selection that honours availability and status
- Round-robin participant allocation with capacity checks and manual overrides
- CSV/print exports for captain packets
- Activity log for assignments, imports, and administration actions

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 8+
- Supabase project with Row Level Security disabled for the tables below
- Optional: [Supabase CLI](https://supabase.com/docs/guides/cli) for local database workflows

## Quick Start

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment variables**

   Copy the sample env file and supply your Supabase project credentials.

   ```bash
   cp .env.example .env
   # edit .env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
   ```

3. **Create database schema**

   Use the provided migration with Supabase CLI or run the SQL against your project:

   ```bash
   supabase db push --file supabase/migrations/001_create_blind_peering.sql
   # or
   psql "$SUPABASE_CONNECTION_STRING" -f supabase/migrations/001_create_blind_peering.sql
   ```

4. **Run the app**

   ```bash
   pnpm dev
   ```

   The dashboard is available at `http://localhost:5173`.

## Scripts

| Command        | Description                        |
| -------------- | ---------------------------------- |
| `pnpm dev`     | Start Vite dev server (HMR enabled) |
| `pnpm build`   | Type-check + build for production   |
| `pnpm preview` | Preview production build            |
| `pnpm lint`    | Run linting via ESLint              |

## Data Model

| Table            | Purpose                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------- |
| `restaurants`    | Event venues. Tracks address, transport info, capacity, and assigned captain.             |
| `participants`   | Pretix attendees. Includes captain flag, contact preferences, and status enum.            |
| `assignments`    | Participant-to-restaurant mapping. Unique per participant and includes `assigned_at`.     |
| `event_status`   | Single-row workflow tracker (`setup`, `captains_assigned`, `participants_assigned`, `finalized`). |
| `event_activity` | Append-only audit trail for automation steps and manual adjustments.                      |

## Assignment Workflow

1. **Setup** – Import participants and add restaurants. Required checks:
   - Participant warning if `registered + late_joiner` count exceeds total capacity (`Σ max_seats - restaurant_count`).
   - Captain warning if fewer active captains than restaurants.
2. **Assign all captains** – Randomises captains across every restaurant (button on dashboard). Re-run at any time until finalised.
3. **Assign all participants** – Round-robin placement prioritising least full restaurant, respecting capacity and captain slots.
4. **Manual tweaks** – Drag-and-drop is modelled with dropdowns. Both people and restaurant tabs allow reassign or unassign.
5. **Finalize event** – Locks the workflow; all assignment actions become read-only. Export CSV/PDF is still available.

Activity log entries are generated for captain assignment, bulk participant shuffle, manual moves, clears, and exports.

## Exporting Captain Packets

Use the **Export rosters** button on the dashboard or assignments page. The app will:

1. Download a CSV (`restaurant, captain, participant...`).
2. Open a print-friendly HTML page. Use the browser print dialog to generate PDFs for captains.

## Notes

- The Supabase client is created without authentication; ensure Row Level Security remains disabled or add service-role credentials.
- CSV imports expect headers: `pretix_id, attendee_email, given_name, family_name, attendee_name, is_table_captain, status`.
- Tailwind CSS (v4) with ShadCN components powers the UI; adjust themes via `src/index.css`.
