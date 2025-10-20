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
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local development)
- Supabase project (cloud or local) with Row Level Security disabled for the tables below

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

3. **Bring up Supabase locally** (or point at an existing project)

   ```bash
   # install the CLI once: https://supabase.com/docs/guides/cli
   cd supabase
   supabase start
   supabase db reset
   ```

   The CLI prints the local API URL and anon key to `supabase/.env`. Copy those values into `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. When you are done developing, run `supabase stop` to tear the stack down.

   > **Using Supabase Cloud instead?** Skip the commands above and run the SQL migration against your hosted project:
   >
   > ```bash
   > psql "$SUPABASE_CONNECTION_STRING" -f supabase/migrations/001_create_blind_peering.sql
   > ```

4. **Run the app**

   ```bash
   pnpm dev
   ```

   The dashboard is available at `http://localhost:5173`.

### Local email testing (Mailpit)

After `supabase start` you can capture outgoing Supabase Auth emails with [Mailpit](https://github.com/axllent/mailpit):

1. Run Mailpit on the same Docker network as the Supabase stack:

   ```bash
   docker run -d --name supabase-mailpit \
     --network supabase_network_local \
     -p 1025:1025 -p 8025:8025 \
     axllent/mailpit:latest
   ```

2. Edit `supabase/.env` (created by the CLI) and set:

   ```
   SMTP_HOST=supabase-mailpit
   SMTP_PORT=1025
   SMTP_USER=
   SMTP_PASS=
   SMTP_ADMIN_EMAIL=admin@example.com
   SMTP_SENDER_NAME=Blind Peering Events
   ```

   Save the file and restart the stack (`supabase stop && supabase start`) so GoTrue picks up the new SMTP settings.

3. Open the Mailpit UI at [http://localhost:8025](http://localhost:8025) to inspect the captured messages. When you are finished testing, stop Mailpit with `docker stop supabase-mailpit`.

## Scripts

| Command        | Description                         |
| -------------- | ----------------------------------- |
| `pnpm dev`     | Start Vite dev server (HMR enabled) |
| `pnpm build`   | Type-check + build for production   |
| `pnpm preview` | Preview production build            |
| `pnpm lint`    | Run linting via ESLint              |

## Data Model

| Table            | Purpose                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `restaurants`    | Event venues. Tracks address, transport info, capacity, and assigned captain.                     |
| `participants`   | Pretix attendees. Includes captain flag, contact preferences, and status enum.                    |
| `assignments`    | Participant-to-restaurant mapping. Unique per participant and includes `assigned_at`.             |
| `event_status`   | Single-row workflow tracker (`setup`, `captains_assigned`, `participants_assigned`, `finalized`). |
| `event_activity` | Append-only audit trail for automation steps and manual adjustments.                              |

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
