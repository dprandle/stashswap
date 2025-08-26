function client_init() {
  if (window.__appInit) return;
  window.__appInit = true;

  // Close modal on backdrop click or [x]
  document.addEventListener("click", (e) => {
    const closeBtn = e.target.closest("[data-close-modal]");
    const backdrop = e.target.classList?.contains("modal-backdrop")
      ? e.target
      : null;
    if (closeBtn || backdrop) {
      const root = document.getElementById("modal-root");
      if (root) root.innerHTML = "";
    }
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const root = document.getElementById("modal-root");
      if (root && root.firstChild) root.innerHTML = "";
    }
  });

  // Optional: focus first form control after the modal swaps in
  document.body.addEventListener("htmx:afterSwap", (e) => {
    if (e.target.id === "modal-root") {
      const first = e.target.querySelector("input, select, textarea, button");
      first?.focus();
    }
  });
}
client_init();
