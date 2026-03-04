# Web de verificacion IP para bot de Discord

Web simple con un boton central de **Verificar**.  
Cuando el usuario pulsa el boton:
1. se registra su IP publica,
2. se asocia a su `discordId`,
3. y el bot puede consultarlo por API.

## Requisitos

- Node.js 18+

## Instalacion

```bash
npm install
```

## Configuracion

1. Copia `.env.example` a `.env`.
2. Define:

- `PORT`: puerto del servidor
- `BOT_API_SECRET`: secreto que usara tu bot en header `x-bot-secret`
- `DISCORD_BOT_TOKEN`: token del bot (se usa para enviar mensaje al canal)
- `DISCORD_BOT_ID`: ID del bot (opcional, solo informativo en el embed)
- `DISCORD_GUILD_ID`: ID del servidor (opcional, informativo en el embed)
- `DISCORD_CHANNEL_ID`: ID del canal donde se publicara la verificacion
- `VERIFICATION_BASE_URL`: URL base de la web (ej: `http://localhost:3000`)
- `VERIFY_TRIGGER`: comando para pedir verificacion (default: `!verificar`)
- `DISCORD_WEBHOOK_URL` (opcional): fallback por webhook

## Ejecutar

```bash
npm start
```

Web en `http://localhost:3000`

Iniciar bot:

```bash
npm run bot:start
```

Iniciar web + bot a la vez:

```bash
npm run start:all
```

Uso del bot:

1. Un usuario escribe `!verificar` o `/verificar`.
2. El bot publica un embed en `DISCORD_CHANNEL_ID`.
3. El embed envia su ID de usuario y boton a la web con `?discordId=<id>`.

Notas:

- Si `!verificar` no responde, usa `/verificar` (no depende de Message Content intent).
- El bot registra automaticamente el slash command al iniciar.

## Uso desde frontend

Abre la web con el ID de Discord en query param:

```text
http://localhost:3000/?discordId=123456789012345678
```

Pulsa el boton **Verificar**.

## Endpoints

- `POST /api/verify`
  - body JSON: `{ "discordId": "123..." }`
  - guarda `{ discordId, ip, verifiedAt }`

- `GET /api/bot/check-user/:discordId`
  - requiere header `x-bot-secret`
  - devuelve si el usuario esta verificado y su IP

- `GET /api/bot/check-ip?ip=1.2.3.4`
  - requiere header `x-bot-secret`
  - devuelve usuarios que verificaron con esa IP

- `GET /api/health`
  - healthcheck publico

## Aviso de seguridad

Si compartiste el token del bot en texto plano, **regenéralo de inmediato** en Discord Developer Portal y usa solo el token nuevo en `.env`.

## Ejemplo rapido para tu bot (discord.js)

```js
const result = await fetch(
  `http://localhost:3000/api/bot/check-user/${discordUserId}`,
  { headers: { "x-bot-secret": process.env.BOT_API_SECRET } }
);
const data = await result.json();

if (data.verified) {
  // Usuario verificado
  console.log(data.ip, data.verifiedAt);
} else {
  // Pedir al usuario abrir la web y verificar
  console.log("No verificado");
}
```
