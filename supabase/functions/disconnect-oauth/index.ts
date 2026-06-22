import { corsHeaders } from "../_shared/cors.ts";
import { serviceRoleClient, userClientFromRequest } from "../_shared/supabaseClient.ts";
import { upsertConnection } from "../_shared/connections.ts";

const VALID_PROVIDERS = ["gmail", "google_calendar", "outlook"];

// Disconnects a Gmail / Google Calendar / Outlook connection: deletes the
// raw tokens from the service-role-only `oauth_tokens` lockbox and flips the
// user-visible `connections` row back to disconnected. WhatsApp has its own
// dedicated whatsapp-disconnect function (it also has to tear down the
// bridge session) and doesn't go through this one.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = userClientFromRequest(req);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { provider } = await req.json();
    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return Response.json({ error: "Invalid or missing provider" }, { status: 400, headers: corsHeaders });
    }

    const serviceClient = serviceRoleClient();
    const { error: deleteError } = await serviceClient
      .from("oauth_tokens")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider);
    if (deleteError) throw deleteError;

    await upsertConnection(supabase, user.id, provider, "disconnected", null);

    return Response.json({ status: "disconnected" }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
