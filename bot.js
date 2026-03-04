require("dotenv").config();

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "";
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID || "";
const DISCORD_BOT_ID = process.env.DISCORD_BOT_ID || "";
const VERIFICATION_BASE_URL =
  process.env.VERIFICATION_BASE_URL || "http://localhost:3000";
const VERIFY_TRIGGER = (process.env.VERIFY_TRIGGER || "!verificar").trim();
const VERIFY_BUTTON_ID = "verify_here";

if (!DISCORD_BOT_TOKEN || !DISCORD_CHANNEL_ID) {
  console.error(
    "Faltan variables: DISCORD_BOT_TOKEN y DISCORD_CHANNEL_ID son obligatorias."
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

function buildVerificationUrl(userId) {
  const base = VERIFICATION_BASE_URL.endsWith("/")
    ? VERIFICATION_BASE_URL.slice(0, -1)
    : VERIFICATION_BASE_URL;
  return `${base}/?discordId=${userId}`;
}

async function getVerificationChannel() {
  const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
  if (!channel || !channel.isTextBased()) {
    throw new Error("DISCORD_CHANNEL_ID no corresponde a un canal de texto.");
  }
  return channel;
}

function buildPublicVerifyRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(VERIFY_BUTTON_ID)
      .setLabel("Verificate aqui")
      .setStyle(ButtonStyle.Primary)
  );
}

function buildPrivateVerifyRow(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Verificate aqui")
      .setStyle(ButtonStyle.Link)
      .setURL(buildVerificationUrl(userId))
  );
}

async function ensureGlobalVerificationMessage() {
  const channel = await getVerificationChannel();
  let existing = null;
  try {
    const recent = await channel.messages.fetch({ limit: 25 });
    existing = recent.find(
      (msg) =>
        msg.author.id === client.user.id &&
        msg.components.some((row) =>
          row.components.some(
            (component) => component.customId === VERIFY_BUTTON_ID
          )
        )
    );
  } catch (_error) {
    existing = null;
  }

  if (existing) return;

  const embed = new EmbedBuilder()
    .setTitle("Verificacion")
    .setColor(0x4cbca6)
    .setDescription("Verificate aqui para continuar.")
    .setTimestamp();

  await channel.send({
    content: "Verificate aqui",
    embeds: [embed],
    components: [buildPublicVerifyRow()]
  });
}

async function registerSlashCommands() {
  const appId = DISCORD_BOT_ID || client.application?.id;
  if (!appId) {
    console.error("No se pudo resolver el Application ID para slash commands.");
    return;
  }

  const commands = [
    new SlashCommandBuilder()
      .setName("verificar")
      .setDescription("Solicita enlace web de verificacion")
      .toJSON()
  ];

  const rest = new REST({ version: "10" }).setToken(DISCORD_BOT_TOKEN);
  const route = DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(appId, DISCORD_GUILD_ID)
    : Routes.applicationCommands(appId);

  await rest.put(route, { body: commands });
  console.log(
    DISCORD_GUILD_ID
      ? `Slash command /verificar registrado en guild ${DISCORD_GUILD_ID}`
      : "Slash command /verificar registrado globalmente"
  );
}

client.once("ready", async () => {
  console.log(`Bot conectado como ${client.user.tag}`);
  console.log(`Canal de verificacion: ${DISCORD_CHANNEL_ID}`);
  try {
    await registerSlashCommands();
    await ensureGlobalVerificationMessage();
  } catch (err) {
    console.error("Error inicializando verificacion automatica:", err.message);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const content = (message.content || "").trim().toLowerCase();
  if (content !== VERIFY_TRIGGER.toLowerCase()) return;

  if (DISCORD_GUILD_ID && message.guild?.id !== DISCORD_GUILD_ID) return;

  try {
    const row = buildPrivateVerifyRow(message.author.id);
    await message.reply({
      content: "Verificate aqui:",
      components: [row]
    });
  } catch (err) {
    console.error("Error enviando enlace de verificacion:", err.message);
    await message.reply(
      "No pude enviar el enlace de verificacion. Revisa permisos y configuracion."
    );
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton() && interaction.customId === VERIFY_BUTTON_ID) {
    const row = buildPrivateVerifyRow(interaction.user.id);
    await interaction.reply({
      content: "Verificate aqui:",
      components: [row],
      ephemeral: true
    });
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "verificar") return;

  if (DISCORD_GUILD_ID && interaction.guildId !== DISCORD_GUILD_ID) {
    await interaction.reply({
      content: "Este comando no esta habilitado en este servidor.",
      ephemeral: true
    });
    return;
  }

  try {
    const row = buildPrivateVerifyRow(interaction.user.id);
    await interaction.reply({
      content: "Verificate aqui:",
      components: [row],
      ephemeral: true
    });
  } catch (err) {
    console.error("Error enviando enlace de verificacion (slash):", err.message);
    await interaction.reply({
      content:
        "No pude enviar el enlace de verificacion. Revisa permisos y configuracion.",
      ephemeral: true
    });
  }
});

client.on("error", (err) => {
  console.error("Discord client error:", err.message);
});

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error("Unhandled rejection:", msg);
});

client.login(DISCORD_BOT_TOKEN);
