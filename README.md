# Synthetic Engagement Engine

**Stack:** [Vercel](https://vercel.com) (static frontend hosting) + [Supabase](https://supabase.com) (Postgres, Auth, Storage, Edge Functions) + [Google Gemini](https://aistudio.google.com) (company-file extraction).

## Local setup

1. Clone the repository and navigate to the project directory.
2. Install dependencies: `npm install`
3. Create an `.env.local` file:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
4. Run the app: `npm run dev`

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com) and grab its URL + publishable key (Project Settings → API) for `.env.local` above.
2. Run `supabase/schema.sql` in the SQL Editor to create the tables, RLS policies, and the `company-files` storage bucket.
3. Deploy the Edge Functions (`supabase/functions/*`) with the [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```sh
   npx supabase link --project-ref your-project-ref
   npx supabase functions deploy
   ```
4. Set the secrets the functions need:
   ```sh
   npx supabase secrets set GEMINI_API_KEY=...
   ```
   Get a Gemini key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
5. In Authentication → Email Templates, customize "Confirm signup" to send `{{ .Token }}` (a 6-digit code) instead of the default magic link — Register.jsx expects an OTP code, not a link.

## Deploying

Push to your Git provider and import the repo into [Vercel](https://vercel.com) as a static Vite app. Set the same `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` as project environment variables there.

## Profile page connectors

The Profile page lets a user connect Gmail, Google Calendar, and WhatsApp.

1. **Gmail / Google Calendar** — not wired up yet. This needs a Google Cloud OAuth Client and a token-exchange Edge Function. Until `VITE_GOOGLE_CLIENT_ID` is set, the Profile page shows these as "not configured" (see `src/lib/connectors.js`).

2. **WhatsApp** — there's no official OAuth for linking a personal WhatsApp account, so this uses the unofficial WhatsApp Web protocol via [Baileys](https://github.com/WhiskeySockets/Baileys), run from a separate always-on bridge service in `/whatsapp-bridge` (see its README). Deploy that service somewhere with a persistent filesystem, then:
   ```sh
   npx supabase secrets set WHATSAPP_BRIDGE_URL=https://your-bridge-host WHATSAPP_BRIDGE_TOKEN=...
   ```
   **This is outside WhatsApp's Terms of Service** and risks the linked number being limited or banned — use a number you're comfortable putting at risk. For a compliant production integration, swap this bridge for the official [WhatsApp Business Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) instead; the rest of the flow (table, functions, UI) stays the same.
