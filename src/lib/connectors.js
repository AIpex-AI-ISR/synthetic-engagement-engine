// App-user OAuth connector IDs.
// These come from Base44 Workspace Settings -> Connectors, after registering
// OAuth credentials for each service there. See README.md for setup steps.
export const CONNECTOR_IDS = {
  gmail: import.meta.env.VITE_GMAIL_CONNECTOR_ID || '',
  google_calendar: import.meta.env.VITE_GOOGLE_CALENDAR_CONNECTOR_ID || '',
};

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
