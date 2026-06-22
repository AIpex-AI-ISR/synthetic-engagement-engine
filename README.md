**Welcome to your Base44 project** 

**About**

View and Edit  your app on [Base44.com](http://Base44.com) 

This project contains everything you need to run your app locally.

**Edit the code in your local development environment**

Any change pushed to the repo will also be reflected in the Base44 Builder.

**Prerequisites:** 

1. Clone the repository using the project's Git URL 
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Create an `.env.local` file and set the right environment variables

```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_backend_url

e.g.
VITE_BASE44_APP_ID=cbef744a8545c389ef439ea6
VITE_BASE44_APP_BASE_URL=https://my-to-do-list-81bfaad7.base44.app
```

Run the app: `npm run dev`

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.

**Profile page connectors**

The Profile page lets a user connect Gmail, Google Calendar, and WhatsApp. Gmail/Calendar use real per-user OAuth; WhatsApp uses an unofficial QR-pairing bridge. Both need manual setup beyond what's in this repo:

1. **Gmail / Google Calendar** — In the Base44 dashboard, go to Workspace Settings → Connectors and register an app-user connector for each service with a Google Cloud OAuth Client ID/Secret. Each registration gives you a connector ID. Set them as backend secrets and frontend env vars:
   ```
   npx base44 secrets set GMAIL_CONNECTOR_ID=... GOOGLE_CALENDAR_CONNECTOR_ID=...
   ```
   ```
   # .env.local
   VITE_GMAIL_CONNECTOR_ID=...
   VITE_GOOGLE_CALENDAR_CONNECTOR_ID=...
   ```

2. **WhatsApp** — there's no official OAuth for linking a personal WhatsApp account, so this uses the unofficial WhatsApp Web protocol via [Baileys](https://github.com/WhiskeySockets/Baileys), run from a separate always-on bridge service in `/whatsapp-bridge` (see its README). Deploy that service somewhere with a persistent filesystem, then:
   ```
   npx base44 secrets set WHATSAPP_BRIDGE_URL=https://your-bridge-host WHATSAPP_BRIDGE_TOKEN=...
   ```
   **This is outside WhatsApp's Terms of Service** and risks the linked number being limited or banned — use a number you're comfortable putting at risk. For a compliant production integration, swap this bridge for the official [WhatsApp Business Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) instead; the rest of the flow (entity, functions, UI) stays the same.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)
