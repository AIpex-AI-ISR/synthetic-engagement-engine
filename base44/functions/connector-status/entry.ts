import { createClientFromRequest } from "npm:@base44/sdk";

// Maps our provider keys to the app-user connector IDs registered in
// Base44 Workspace Settings -> Connectors. Set these with:
//   npx base44 secrets set GMAIL_CONNECTOR_ID=... GOOGLE_CALENDAR_CONNECTOR_ID=...
const GOOGLE_CONNECTOR_IDS: Record<string, string | undefined> = {
  gmail: Deno.env.get("GMAIL_CONNECTOR_ID"),
  google_calendar: Deno.env.get("GOOGLE_CALENDAR_CONNECTOR_ID"),
};

const PROFILE_URLS: Record<string, string> = {
  gmail: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
  google_calendar: "https://www.googleapis.com/calendar/v3/calendars/primary",
};

async function fetchExternalLabel(provider: string, accessToken: string): Promise<string | null> {
  const url = PROFILE_URLS[provider];
  if (!url) return null;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.emailAddress || data.id || null;
  } catch {
    return null;
  }
}

async function upsertConnection(base44: any, userId: string, provider: string, status: string, externalLabel: string | null) {
  const existing = await base44.asServiceRole.entities.Connection.filter({ user_id: userId, provider });
  const data: Record<string, any> = { user_id: userId, provider, status };
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

    const results: Record<string, { status: string; external_label: string | null }> = {};

    for (const provider of Object.keys(GOOGLE_CONNECTOR_IDS)) {
      const connectorId = GOOGLE_CONNECTOR_IDS[provider];
      if (!connectorId) {
        results[provider] = { status: "not_configured", external_label: null };
        continue;
      }
      try {
        const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(connectorId);
        const label = await fetchExternalLabel(provider, accessToken);
        await upsertConnection(base44, user.id, provider, "connected", label);
        results[provider] = { status: "connected", external_label: label };
      } catch {
        await upsertConnection(base44, user.id, provider, "disconnected", null);
        results[provider] = { status: "disconnected", external_label: null };
      }
    }

    const whatsappConnections = await base44.asServiceRole.entities.Connection.filter({ user_id: user.id, provider: "whatsapp" });
    const whatsapp = whatsappConnections[0];
    results.whatsapp = {
      status: whatsapp?.status || "disconnected",
      external_label: whatsapp?.external_label || null,
    };

    return Response.json({ connections: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
