import path from "node:path";
import fs from "node:fs";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";

const SESSIONS_DIR = path.join(process.cwd(), "sessions");
const logger = pino({ level: process.env.LOG_LEVEL || "silent" });

// userId -> { sock, status: "connecting" | "qr" | "connected" | "disconnected", qr, label }
const sessions = new Map();

function authDirFor(userId) {
  return path.join(SESSIONS_DIR, userId);
}

export async function startSession(userId) {
  const existing = sessions.get(userId);
  if (existing && existing.status !== "disconnected") {
    return existing;
  }

  const dir = authDirFor(userId);
  fs.mkdirSync(dir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();

  const entry = { sock: null, status: "connecting", qr: null, label: null };
  sessions.set(userId, entry);

  const sock = makeWASocket({ version, auth: state, logger, printQRInTerminal: false });
  entry.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      entry.qr = await QRCode.toDataURL(qr);
      entry.status = "qr";
    }

    if (connection === "open") {
      entry.status = "connected";
      entry.qr = null;
      entry.label = sock.user?.id?.split(":")[0] || sock.user?.id || null;
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        sessions.delete(userId);
        fs.rmSync(dir, { recursive: true, force: true });
        return;
      }

      // Baileys closes the socket for plenty of non-fatal reasons -- most
      // notably `restartRequired` right after the very first QR scan, before
      // the session ever reaches "connected". Saved creds on disk are still
      // valid here, so reconnect instead of deleting the session, otherwise
      // pairing looks like it silently failed and there's no auto-reconnect
      // after a transient network blip.
      // Delete the map entry first so startSession's own dedupe guard (which
      // skips re-creating a socket while status !== "disconnected") doesn't
      // treat this as a no-op.
      sessions.delete(userId);
      startSession(userId).catch(() => {
        sessions.delete(userId);
      });
    }
  });

  return entry;
}

export async function disconnectSession(userId) {
  const entry = sessions.get(userId);
  if (entry?.sock) {
    try {
      await entry.sock.logout();
    } catch {
      // Socket may already be torn down; fall through to local cleanup.
    }
  }
  sessions.delete(userId);
  fs.rmSync(authDirFor(userId), { recursive: true, force: true });
}

export function getPublicStatus(userId) {
  const entry = sessions.get(userId);
  if (!entry) {
    return { status: "disconnected", qr: null, label: null };
  }
  return {
    status: entry.status === "connecting" ? "connecting" : entry.status,
    qr: entry.qr,
    label: entry.label,
  };
}
