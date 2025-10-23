function handle_htmx_config_request(e) {
    console.log("HTMX config handler");
}

function handle_mousedown(e) {
    // Close modal on backdrop click
    const root = document.getElementById("modal-root");
    if (e.target.id === "modal" && root) {
        const close_btn = document.getElementById("btn-signin-modal-close");
        if (close_btn && !close_btn.classList.contains("hidden")) {
            root.innerHTML = "";
        }
    }

    // Close the account menu if its open and the click is outside of it
    // But don't set hidden if the thing clicked is the button because then the on click signal
    // for the button will toggle it visible again
    const account_menu = document.getElementById("dropdown-menu");
    const account_btn = document.getElementById("account-menu-button");
    if (
        e.target !== account_btn &&
        account_menu &&
        !account_menu.classList.contains("hidden") &&
        account_menu !== e.target &&
        !account_menu.contains(e.target)
    ) {
        account_menu.classList.add("hidden");
    }
}

function handle_click(e) {
    // Close modal on [x]
    if (e.target.id === "btn-signin-modal-close") {
        const root = document.getElementById("modal-root");
        if (root) {
            root.innerHTML = "";
        }
    }

    // If the account menu is clicked, hide it
    const account_menu = document.getElementById("dropdown-menu");
    if (
        account_menu &&
        !account_menu.classList.contains("hidden") &&
        e.target !== account_menu &&
        !e.target.classList.contains("sep")
    ) {
        if (e.target === account_menu || account_menu.contains(e.target)) {
            account_menu.classList.add("hidden");
        }
    }
}

function handle_keydown(e) {
    if (e.key === "Escape") {
        const modal_root = document.getElementById("modal-root");
        if (modal_root) {
            const modal_close_btn = document.getElementById("btn-signin-modal-close");
            if (modal_close_btn && !modal_close_btn.classList.contains("hidden")) {
                modal_root.innerHTML = "";
            }
        }
        const account_menu = document.getElementById("dropdown-menu");
        if (account_menu && !account_menu.classList.contains("hidden")) {
            account_menu.classList.add("hidden");
        }
    }
}

// Focus first form control after the modal swaps in
function handle_htmx_after_swap(e) {
    if (e.target.id === "modal-root") {
        const first = e.target.querySelector("input, select, textarea, button");
        first?.focus();
    }
}

function handle_account_menu_click(e) {
    const account_menu = document.getElementById("dropdown-menu");
    if (account_menu.classList.contains("hidden")) {
        account_menu.classList.remove("hidden");
    } else {
        account_menu.classList.add("hidden");
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

    // Clicking account options when user is logged in
    window.handle_account_menu_click = handle_account_menu_click;
}

client_init();
