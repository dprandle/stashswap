function handle_htmx_config_request(e) {
  if (e.detail.elt.id === "signin-form") {
    console.log("Just seeing if works");
  }
}

function handle_mousedown(e) {
  // Close modal on backdrop click or [x]
  const backdrop = e.target.classList?.contains("modal-backdrop")
    ? e.target
    : null;
  if (backdrop) {
    const root = document.getElementById("modal-root");
    if (root) root.innerHTML = "";
  }
}

function handle_click(e) {
  // Close modal on backdrop click or [x]
  const closeBtn = e.target.closest("[data-close-modal]");
  if (closeBtn) {
    const root = document.getElementById("modal-root");
    if (root) root.innerHTML = "";
  }
}

function handle_keydown(e) {
  if (e.key === "Escape") {
    const root = document.getElementById("modal-root");
    if (root && root.firstChild) root.innerHTML = "";
  }
}

// Focus first form control after the modal swaps in
function handle_htmx_after_swap(e) {
  if (e.target.id === "modal-root") {
    const first = e.target.querySelector("input, select, textarea, button");
    first?.focus();
  }
}

function client_init() {
  if (window.__appInit) return;
  window.__appInit = true;
  document.addEventListener("click", handle_click);
  document.addEventListener("mousedown", handle_mousedown);
  document.addEventListener("keydown", handle_keydown);
  document.body.addEventListener("htmx:afterSwap", handle_htmx_after_swap);
  document.body.addEventListener("htmx:configRequest", handle_htmx_config_request);
}

client_init();
