# Supabase CLI Project

This directory is structured for use with the Supabase CLI.

## Typical workflow

```bash
# run these commands from this directory
supabase start              # launch local services (Postgres, Auth, Storage, Realtime, Studio)
supabase db reset           # apply all migrations in supabase/migrations
supabase stop               # tear everything down when finished
```

After `supabase start`, the CLI writes local connection details (URL + anon/service keys) to `supabase/.env`. Copy the anon key and API URL into the frontend `.env` file as `VITE_SUPABASE_ANON_KEY` and `VITE_SUPABASE_URL` so the app talks to your local stack.

All schema changes should be captured as SQL migrations inside `supabase/migrations`. `supabase db reset` will drop and recreate the database using those files, which is the quickest way to reset local state.

## Capturing Auth emails with Mailpit

1. After the stack is running, launch Mailpit on the Supabase Docker network:

   ```bash
   docker run -d --name supabase-mailpit \
     --network supabase_default \
     -p 1025:1025 -p 8025:8025 \
     axllent/mailpit:latest
   ```

2. Update `supabase/.env` and set:

   ```
   SMTP_HOST=supabase-mailpit
   SMTP_PORT=1025
   SMTP_USER=
   SMTP_PASS=
   SMTP_ADMIN_EMAIL=admin@example.com
   SMTP_SENDER_NAME=Blind Peering Events
   ```

3. Restart the stack so GoTrue rereads the SMTP configuration:

   ```bash
   supabase stop
   supabase start
   ```

4. Visit http://localhost:8025 to view captured messages. Stop Mailpit with `docker stop supabase-mailpit` when you are finished.

For additional commands and advanced configuration, refer to the [Supabase CLI docs](https://supabase.com/docs/guides/cli).
