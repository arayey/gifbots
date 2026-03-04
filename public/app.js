const button = document.getElementById("verify-btn");
const statusEl = document.getElementById("status");

const params = new URLSearchParams(window.location.search);
const discordId = (params.get("discordId") || "").replace(/[^\d]/g, "");

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`.trim();
}

button.addEventListener("click", async () => {
  if (!discordId) {
    setStatus("Falta discordId en la URL. Usa ?discordId=TU_ID", "err");
    return;
  }

  button.disabled = true;
  setStatus("Verificando...", "");

  try {
    const response = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discordId })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      setStatus(data.error || "No se pudo completar la verificacion", "err");
      return;
    }

    setStatus("Verificacion completada correctamente.", "ok");
  } catch (_error) {
    setStatus("Error de red al verificar. Intenta otra vez.", "err");
  } finally {
    button.disabled = false;
  }
});
