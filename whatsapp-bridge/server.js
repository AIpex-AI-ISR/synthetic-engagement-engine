import express from "express";
import { startSession, disconnectSession, getPublicStatus } from "./sessions.js";

const PORT = process.env.PORT || 8080;
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN;

if (!BRIDGE_TOKEN) {
  console.error("BRIDGE_TOKEN env var is required");
  process.exit(1);
}

const app = express();

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use((req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token !== BRIDGE_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.post("/sessions/:userId/connect", async (req, res) => {
  try {
    await startSession(req.params.userId);
    res.json(getPublicStatus(req.params.userId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/sessions/:userId/status", (req, res) => {
  res.json(getPublicStatus(req.params.userId));
});

app.post("/sessions/:userId/disconnect", async (req, res) => {
  try {
    await disconnectSession(req.params.userId);
    res.json({ status: "disconnected" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`WhatsApp bridge listening on :${PORT}`);
});
