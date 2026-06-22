// Gmail / Google Calendar OAuth needs a Google Cloud OAuth client. Until
// VITE_GOOGLE_CLIENT_ID is set, the Profile page shows these as
// "not configured" rather than attempting a connection.
export const GOOGLE_OAUTH_CONFIGURED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

// Outlook (Microsoft Graph: Mail + Calendar) OAuth needs a Microsoft Entra
// (Azure AD) app registration. Until VITE_MICROSOFT_CLIENT_ID is set, the
// Profile page shows it as "not configured" rather than attempting a
// connection.
export const MICROSOFT_OAUTH_CONFIGURED = Boolean(import.meta.env.VITE_MICROSOFT_CLIENT_ID);

export const PROVIDERS = {
  gmail: {
    key: 'gmail',
    label: 'Gmail',
    description: 'Read and send email on your behalf.',
  },
  google_calendar: {
    key: 'google_calendar',
    label: 'Google Calendar',
    description: 'View and schedule meetings on your calendar.',
  },
  outlook: {
    key: 'outlook',
    label: 'Outlook',
    description: 'Read and send email and manage your calendar.',
  },
  whatsapp: {
    key: 'whatsapp',
    label: 'WhatsApp',
    description: 'Link your WhatsApp account by scanning a QR code.',
  },
};

// The exact redirect_uri used for every provider's Authorization Code flow.
// It must match byte-for-byte between this frontend authorize-URL builder
// and the oauth-callback Edge Function's token-exchange call, since OAuth
// providers reject a mismatched redirect_uri.
export function getOAuthRedirectUri() {
  return `${import.meta.env.VITE_APP_URL}/oauth/callback`;
}

// sessionStorage key the OAuthCallback page checks the `state` query param
// against, to defend against CSRF on the redirect back from the IdP.
export const OAUTH_STATE_STORAGE_KEY = 'oauth_state';

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const MICROSOFT_AUTHORIZE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

// `email` is appended to every Google scope set (on top of the
// product-specific scopes the task asked for) because oauth-callback calls
// the userinfo endpoint to populate `external_label`, and that endpoint
// needs the `email` scope granted on the token to return one -- without it
// the connected account's address wouldn't come back at all.
const GOOGLE_SCOPES = {
  gmail: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send email',
  google_calendar: 'https://www.googleapis.com/auth/calendar email',
};

const OUTLOOK_SCOPES = 'offline_access Mail.Read Mail.Send Calendars.ReadWrite User.Read';

function randomState() {
  return crypto.randomUUID();
}

// Builds the provider-specific authorize URL for the Authorization Code
// flow, stashes a CSRF `state` token in sessionStorage (with the provider
// encoded alongside it so OAuthCallback.jsx knows which token endpoint and
// scopes were used), and returns the URL the caller should redirect to.
export function buildAuthorizeUrl(provider) {
  const state = randomState();
  sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, JSON.stringify({ state, provider }));
  const redirectUri = getOAuthRedirectUri();

  if (provider === 'gmail' || provider === 'google_calendar') {
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES[provider],
      access_type: 'offline',
      prompt: 'consent',
      state: `${provider}:${state}`,
    });
    return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
  }

  if (provider === 'outlook') {
    const params = new URLSearchParams({
      client_id: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: OUTLOOK_SCOPES,
      state: `${provider}:${state}`,
    });
    return `${MICROSOFT_AUTHORIZE_URL}?${params.toString()}`;
  }

  throw new Error(`No OAuth authorize URL builder for provider "${provider}"`);
}
