const statusEl = document.getElementById("status");

const params = new URLSearchParams(window.location.search);
const discordId = (params.get("discordId") || "").replace(/[^\d]/g, "");
const username = (params.get("username") || "").trim();
let verified = false;

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`.trim();
}

async function runAutoVerification() {
  if (verified) return;

  if (!discordId) {
    setStatus("Falta discordId en la URL. Usa ?discordId=TU_ID", "err");
    return;
  }

  setStatus("Verificando cuenta...", "");

  try {
    const response = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordId, username })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      setStatus(data.error || "No se pudo completar la verificacion", "err");
      return;
    }

    verified = true;
    setStatus("Verificacion completada. Puedes volver a Discord.", "ok");
  } catch (_error) {
    setStatus("Error de red al verificar. Intenta otra vez.", "err");
  }
}

runAutoVerification();
