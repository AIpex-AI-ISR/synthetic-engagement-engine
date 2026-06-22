import { createClient } from "npm:@supabase/supabase-js@2";

// A client scoped to the calling user's JWT, so every query runs under their
// RLS policies rather than a privileged service-role client.
export function userClientFromRequest(req: Request) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
  );
}

// A privileged client authenticated with the service-role key, which
// Supabase auto-injects into every Edge Function's environment. This
// bypasses RLS entirely, so only use it server-side for tables (like
// `oauth_tokens`) that intentionally have no policy for the
// authenticated/anon role. Never send this key to the browser.
export function serviceRoleClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
