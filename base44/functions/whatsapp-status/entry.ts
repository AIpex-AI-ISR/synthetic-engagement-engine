import { createClientFromRequest } from "npm:@base44/sdk";

// Polled by the frontend while the QR code is on screen, and once more after
// the user scans it, to learn that pairing succeeded.
const BRIDGE_URL = Deno.env.get("WHATSAPP_BRIDGE_URL");
const BRIDGE_TOKEN = Deno.env.get("WHATSAPP_BRIDGE_TOKEN");

function mapStatus(bridgeStatus: string): string {
  if (bridgeStatus === "connected") return "connected";
  if (bridgeStatus === "disconnected") return "disconnected";
  // "qr" (code is up, waiting for scan) and "connecting" (socket warming up
  // before the QR has been generated yet) both read as "pending" to the user.
  return "pending";
}

async function upsertConnection(base44: any, userId: string, status: string, externalLabel: string | null) {
  const existing = await base44.asServiceRole.entities.Connection.filter({ user_id: userId, provider: "whatsapp" });
  const data: Record<string, any> = { user_id: userId, provider: "whatsapp", status };
  if (externalLabel) data.external_label = externalLabel;
  if (status === "connected") data.connected_at = new Date().toISOString();

  if (existing.length > 0) {
    return base44.asServiceRole.entities.Connection.update(existing[0].id, data);
  }
  return base44.asServiceRole.entities.Connection.create(data);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!BRIDGE_URL || !BRIDGE_TOKEN) {
      return Response.json({ error: "WhatsApp bridge is not configured" }, { status: 503 });
    }

    const bridgeRes = await fetch(`${BRIDGE_URL}/sessions/${user.id}/status`, {
      headers: { Authorization: `Bearer ${BRIDGE_TOKEN}` },
    });

    if (!bridgeRes.ok) {
      return Response.json({ error: "Failed to read WhatsApp session status" }, { status: 502 });
    }

    const bridgeData = await bridgeRes.json();
    const status = mapStatus(bridgeData.status);
    await upsertConnection(base44, user.id, status, bridgeData.label || null);

    return Response.json({
      status,
      qr: bridgeData.qr || null,
      external_label: bridgeData.label || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
