import { createClientFromRequest } from "npm:@base44/sdk";

const BRIDGE_URL = Deno.env.get("WHATSAPP_BRIDGE_URL");
const BRIDGE_TOKEN = Deno.env.get("WHATSAPP_BRIDGE_TOKEN");

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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

    const existing = await base44.asServiceRole.entities.Connection.filter({ user_id: user.id, provider: "whatsapp" });
    const data = { user_id: user.id, provider: "whatsapp", status: "disconnected", external_label: null };
    if (existing.length > 0) {
      await base44.asServiceRole.entities.Connection.update(existing[0].id, data);
    } else {
      await base44.asServiceRole.entities.Connection.create(data);
    }

    return Response.json({ status: "disconnected" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
