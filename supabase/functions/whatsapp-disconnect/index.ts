import { corsHeaders } from "../_shared/cors.ts";
import { userClientFromRequest } from "../_shared/supabaseClient.ts";
import { upsertConnection } from "../_shared/connections.ts";

const BRIDGE_URL = Deno.env.get("WHATSAPP_BRIDGE_URL");
const BRIDGE_TOKEN = Deno.env.get("WHATSAPP_BRIDGE_TOKEN");

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

    if (BRIDGE_URL && BRIDGE_TOKEN) {
      try {
        await fetch(`${BRIDGE_URL}/sessions/${user.id}/disconnect`, {
          method: "POST",
          headers: { Authorization: `Bearer ${BRIDGE_TOKEN}` },
        });
      } catch {
        // Bridge may already be down or the session may already be gone;
        // we still want to record the disconnect locally below.
      }
    }

    await upsertConnection(supabase, user.id, "whatsapp", "disconnected", null);

    return Response.json({ status: "disconnected" }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
