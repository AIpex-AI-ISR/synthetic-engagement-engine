// Direct Google OAuth (Gmail/Calendar) isn't wired up yet -- it needs a
// Google Cloud OAuth client and a token-exchange function. Until
// VITE_GOOGLE_CLIENT_ID is set, the Profile page shows these as
// "not configured" rather than attempting a connection.
export const GOOGLE_OAUTH_CONFIGURED = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

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
  whatsapp: {
    key: 'whatsapp',
    label: 'WhatsApp',
    description: 'Link your WhatsApp account by scanning a QR code.',
  },
};
