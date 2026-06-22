import { corsHeaders } from "../_shared/cors.ts";
import { serviceRoleClient, userClientFromRequest } from "../_shared/supabaseClient.ts";
import { upsertConnection } from "../_shared/connections.ts";

// Gmail and Google Calendar share one Google OAuth client (same Client
// ID/Secret), they just request different scopes -- see buildAuthorizeUrl
// in src/lib/connectors.js.
//
// NOTE: these are intentionally NOT the VITE_-prefixed env vars. Vite only
// bundles VITE_-prefixed vars into the frontend bundle, which would expose
// the client secret to every browser; Edge Functions run server-side, so
// they read their own plain (non-VITE_) copies set via
// `npx supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...`.
// VITE_GOOGLE_CLIENT_ID / GOOGLE_CLIENT_ID (and the Microsoft equivalents
// below) must be set to the same value -- the client ID isn't a secret, but
// it still needs its own server-side copy since Edge Functions can't read
// import.meta.env.
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const MICROSOFT_CLIENT_ID = Deno.env.get("MICROSOFT_CLIENT_ID");
const MICROSOFT_CLIENT_SECRET = Deno.env.get("MICROSOFT_CLIENT_SECRET");

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MICROSOFT_GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me";

const VALID_PROVIDERS = ["gmail", "google_calendar", "outlook"];

function providerConfig(provider: string) {
  if (provider === "gmail" || provider === "google_calendar") {
    return {
      tokenUrl: GOOGLE_TOKEN_URL,
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
    };
  }
  if (provider === "outlook") {
    return {
      tokenUrl: MICROSOFT_TOKEN_URL,
      clientId: MICROSOFT_CLIENT_ID,
      clientSecret: MICROSOFT_CLIENT_SECRET,
    };
  }
  return null;
}

async function fetchExternalLabel(provider: string, accessToken: string): Promise<string | null> {
  if (provider === "gmail" || provider === "google_calendar") {
    const res = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.email || null;
  }

  if (provider === "outlook") {
    const res = await fetch(MICROSOFT_GRAPH_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.mail || data.userPrincipalName || null;
  }

  return null;
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

    const { provider, code, redirect_uri } = await req.json();
    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return Response.json({ error: "Invalid or missing provider" }, { status: 400, headers: corsHeaders });
    }
    if (!code || !redirect_uri) {
      return Response.json({ error: "code and redirect_uri are required" }, { status: 400, headers: corsHeaders });
    }

    const config = providerConfig(provider);
    if (!config || !config.clientId || !config.clientSecret) {
      return Response.json(
        { error: `${provider} OAuth is not configured on the server` },
        { status: 503, headers: corsHeaders },
      );
    }

    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      return Response.json(
        { error: `Token exchange failed: ${detail}` },
        { status: 502, headers: corsHeaders },
      );
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokenData;
    if (!access_token) {
      return Response.json({ error: "Token exchange returned no access_token" }, { status: 502, headers: corsHeaders });
    }

    const externalLabel = await fetchExternalLabel(provider, access_token);
    const expiresAt = typeof expires_in === "number"
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null;

    // Raw tokens go in the service-role-only lockbox table -- never in
    // `connections`, which the browser can select directly with the
    // anon/publishable key.
    const serviceClient = serviceRoleClient();
    const { error: tokenSaveError } = await serviceClient
      .from("oauth_tokens")
      .upsert(
        {
          user_id: user.id,
          provider,
          access_token,
          // Google only returns refresh_token on the first consent; preserve
          // the previously stored one on re-connects where it's omitted.
          ...(refresh_token ? { refresh_token } : {}),
          expires_at: expiresAt,
        },
        { onConflict: "user_id,provider" },
      );
    if (tokenSaveError) throw tokenSaveError;

    // The row Profile.jsx actually displays -- status + label only, no token
    // material.
    await upsertConnection(supabase, user.id, provider, "connected", externalLabel);

    return Response.json({ status: "connected", external_label: externalLabel }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
});
