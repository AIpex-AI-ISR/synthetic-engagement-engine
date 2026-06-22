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
