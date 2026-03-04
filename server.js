require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const BOT_API_SECRET = process.env.BOT_API_SECRET || "";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const DISCORD_BOT_ID = process.env.DISCORD_BOT_ID || "";
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || "";
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "";
const DISCORD_RESULT_CHANNEL_ID =
  process.env.DISCORD_RESULT_CHANNEL_ID || "1478776020151570679";

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "verifications.json");

app.set("trust proxy", true);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf8");
  }
}

function loadVerifications() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveVerifications(list) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf8");
}

function normalizeIp(ip) {
  if (!ip) return "0.0.0.0";
  if (ip === "::1") return "127.0.0.1";
  if (ip.startsWith("::ffff:")) return ip.replace("::ffff:", "");
  return ip;
}

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(xff)
    ? xff[0]
    : (xff || "").split(",")[0].trim();
  return normalizeIp(firstForwarded || req.ip);
}

function requireBotSecret(req, res, next) {
  if (!BOT_API_SECRET) {
    return res.status(500).json({
      ok: false,
      error:
        "BOT_API_SECRET no esta configurado en el servidor. Configuralo para proteger la API del bot."
    });
  }

  const provided = req.headers["x-bot-secret"];
  if (provided !== BOT_API_SECRET) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  next();
}

async function sendDiscordWebhook(payload) {
  if (!DISCORD_WEBHOOK_URL) return;

  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("No se pudo enviar el webhook a Discord:", err.message);
  }
}

async function sendDiscordBotChannelMessage(entry) {
  if (!DISCORD_BOT_TOKEN || !DISCORD_RESULT_CHANNEL_ID) {
    return false;
  }

  const messagePayload = {
    content: `Nueva verificacion web para <@${entry.discordId}>`,
    embeds: [
      {
        title: "Verificacion de IP completada",
        color: 5025616,
        fields: [
          { name: "Discord ID", value: entry.discordId, inline: true },
          { name: "IP", value: entry.ip, inline: true },
          { name: "Fecha", value: entry.verifiedAt, inline: false },
          {
            name: "Bot ID",
            value: DISCORD_BOT_ID || "No configurado",
            inline: true
          },
          {
            name: "Guild ID",
            value: DISCORD_GUILD_ID || "No configurado",
            inline: true
          }
        ]
      }
    ]
  };

  const response = await fetch(
    `https://discord.com/api/v10/channels/${DISCORD_RESULT_CHANNEL_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(messagePayload)
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API ${response.status}: ${text}`);
  }

  return true;
}

app.post("/api/verify", async (req, res) => {
  const discordIdRaw = (req.body?.discordId || "").toString().trim();
  const discordId = discordIdRaw.replace(/[^\d]/g, "");
  const ip = getClientIp(req);

  if (!discordId) {
    return res.status(400).json({
      ok: false,
      error: "Falta discordId. Abre la URL con ?discordId=TU_ID"
    });
  }

  const now = new Date().toISOString();
  const verifications = loadVerifications();

  const filtered = verifications.filter((item) => item.discordId !== discordId);
  const entry = {
    discordId,
    ip,
    verifiedAt: now
  };
  filtered.push(entry);
  saveVerifications(filtered);

  try {
    await sendDiscordBotChannelMessage(entry);
  } catch (err) {
    console.error(
      `No se pudo enviar al canal de resultado ${DISCORD_RESULT_CHANNEL_ID}:`,
      err.message
    );
  }

  await sendDiscordWebhook({
    content: "Nueva verificacion de IP",
    embeds: [
      {
        title: "Usuario verificado",
        color: 5025616,
        fields: [
          { name: "Discord ID", value: discordId, inline: true },
          { name: "IP", value: ip, inline: true },
          { name: "Fecha", value: now, inline: false }
        ]
      }
    ]
  });

  res.json({
    ok: true,
    message: "Verificacion completada",
    discordId,
    ip,
    verifiedAt: now
  });
});

app.get("/api/bot/check-user/:discordId", requireBotSecret, (req, res) => {
  const discordId = (req.params.discordId || "").replace(/[^\d]/g, "");
  const verifications = loadVerifications();
  const user = verifications.find((item) => item.discordId === discordId);

  if (!user) {
    return res.json({
      ok: true,
      verified: false,
      discordId
    });
  }

  res.json({
    ok: true,
    verified: true,
    discordId,
    ip: user.ip,
    verifiedAt: user.verifiedAt
  });
});

app.get("/api/bot/check-ip", requireBotSecret, (req, res) => {
  const ip = normalizeIp((req.query.ip || "").toString().trim());
  const verifications = loadVerifications();
  const matches = verifications.filter((item) => item.ip === ip);

  res.json({
    ok: true,
    ip,
    verified: matches.length > 0,
    count: matches.length,
    users: matches.map((item) => ({
      discordId: item.discordId,
      verifiedAt: item.verifiedAt
    }))
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "discord-ip-verification-web" });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
    console.log(
      `Canal de resultados de verificacion: ${DISCORD_RESULT_CHANNEL_ID}`
    );
  });
}

module.exports = app;
