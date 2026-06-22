import { corsHeaders } from "../_shared/cors.ts";
import { userClientFromRequest } from "../_shared/supabaseClient.ts";
import { upsertConnection } from "../_shared/connections.ts";

// Polled by the frontend while the QR code is on screen, and once more after
// the user scans it, to learn that pairing succeeded.
const BRIDGE_URL = Deno.env.get("WHATSAPP_BRIDGE_URL");
const BRIDGE_TOKEN = Deno.env.get("WHATSAPP_BRIDGE_TOKEN");

function mapStatus(bridgeStatus: string): string {
  if (bridgeStatus === "connected") return "connected";
  if (bridgeStatus === "disconnected") return "disconnected";
  return "pending";
}

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

    if (!BRIDGE_URL || !BRIDGE_TOKEN) {
      return Response.json({ error: "WhatsApp bridge is not configured" }, { status: 503, headers: corsHeaders });
    }

    const bridgeRes = await fetch(`${BRIDGE_URL}/sessions/${user.id}/status`, {
      headers: { Authorization: `Bearer ${BRIDGE_TOKEN}` },
    });

    if (!bridgeRes.ok) {
      return Response.json({ error: "Failed to read WhatsApp session status" }, { status: 502, headers: corsHeaders });
    }

    const bridgeData = await bridgeRes.json();
    const status = mapStatus(bridgeData.status);
    await upsertConnection(supabase, user.id, "whatsapp", status, bridgeData.label || null);

    return Response.json(
      { status, qr: bridgeData.qr || null, external_label: bridgeData.label || null },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
