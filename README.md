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

The Profile page lets a user connect Gmail, Google Calendar, Outlook, and WhatsApp — each with their own permission, so the backend ends up holding an OAuth token (or, for WhatsApp, a paired session) it can act on their behalf with.

### Gmail / Google Calendar / Outlook (OAuth Authorization Code flow)

Clicking "Connect" redirects the browser straight to the provider's consent screen (`buildAuthorizeUrl` in `src/lib/connectors.js`); after the user approves, the provider redirects back to the single shared `/oauth/callback` route (`src/pages/OAuthCallback.jsx`), which verifies the CSRF `state` it stashed in `sessionStorage` before redirecting and then calls the `oauth-callback` Edge Function to exchange the code for tokens. Raw tokens are stored server-side only, in the `oauth_tokens` table (locked down to the service-role key — never selectable from the browser); the public `connections` table only ever gets `status` + `external_label` (the connected account's email).

To wire this up yourself, you need to create OAuth clients with Google and Microsoft (this repo has no access to your accounts, so this step can't be automated for you):

1. **Google Cloud Console** (console.cloud.google.com):
   - Create or select a project.
   - Enable the **Gmail API** and **Google Calendar API** (APIs & Services → Library).
   - Configure the **OAuth consent screen** (APIs & Services → OAuth consent screen).
   - Create an **OAuth 2.0 Client ID** of type "Web application" (APIs & Services → Credentials).
   - Add `${VITE_APP_URL}/oauth/callback` (e.g. `http://localhost:5173/oauth/callback` in dev) as an **authorized redirect URI**.
   - Copy the **Client ID** and **Client Secret**.

2. **Microsoft Entra (Azure AD) admin center** (entra.microsoft.com):
   - Register a new application (Identity → Applications → App registrations → New registration).
   - Add a **Web** platform redirect URI of `${VITE_APP_URL}/oauth/callback`.
   - Create a **client secret** (Certificates & secrets → New client secret) and copy its value immediately (it's hidden after you leave the page).
   - Add Microsoft Graph **delegated permissions**: `Mail.Read`, `Mail.Send`, `Calendars.ReadWrite`, `offline_access`, `User.Read` (API permissions → Add a permission → Microsoft Graph → Delegated permissions).
   - Copy the **Application (client) ID** and the client secret value.

3. Set the frontend env vars (`.env.local` for dev, your Vercel project's environment variables for prod):
   ```
   VITE_GOOGLE_CLIENT_ID=...
   VITE_MICROSOFT_CLIENT_ID=...
   VITE_APP_URL=http://localhost:5173
   ```
   `VITE_APP_URL` must be the exact origin the app is served from (e.g. your `https://your-app.vercel.app` in production) — it's used to build the `redirect_uri`, which has to match byte-for-byte between the frontend's authorize-URL and what the Edge Function sends during token exchange, or the provider will reject the exchange.

4. Set the matching server-side secrets the Edge Functions need (note these are the **same Client ID values** as above, just without the `VITE_` prefix — Vite only bundles `VITE_`-prefixed vars into the frontend, so Edge Functions need their own copy to read at runtime, plus the client secrets which must never go in a `VITE_` var or anywhere in the frontend bundle):
   ```sh
   npx supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...
   npx supabase secrets set MICROSOFT_CLIENT_ID=... MICROSOFT_CLIENT_SECRET=...
   ```
   Gmail and Google Calendar share the same Google OAuth client — they just request different scopes.

Until `VITE_GOOGLE_CLIENT_ID` / `VITE_MICROSOFT_CLIENT_ID` are set, the Profile page shows the relevant connectors as "not configured" instead of attempting a connection (see `src/lib/connectors.js`).

### WhatsApp

There's no official OAuth for linking a personal WhatsApp account, so this uses the unofficial WhatsApp Web protocol via [Baileys](https://github.com/WhiskeySockets/Baileys), run from a separate always-on bridge service in `/whatsapp-bridge` (see its README). Deploy that service somewhere with a persistent filesystem, then:
```sh
npx supabase secrets set WHATSAPP_BRIDGE_URL=https://your-bridge-host WHATSAPP_BRIDGE_TOKEN=...
```
**This is outside WhatsApp's Terms of Service** and risks the linked number being limited or banned — use a number you're comfortable putting at risk. For a compliant production integration, swap this bridge for the official [WhatsApp Business Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) instead; the rest of the flow (table, functions, UI) stays the same.
