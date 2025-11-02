
const MODAL_DIALOGS = [
    {
        id: "login-modal",
        close_btn_id: "btn-login-modal-close"
    },
    {
        id: "create_acc"
    }
];


function fade_and_remove_item(id, delay = 1000) {
    const el = document.getElementById(id);
    console.log(`Item ${id} should be removed in ${delay}..`);
    setTimeout(() => {
        el.classList.add("hide");
        el.addEventListener("transitionend", () => el.remove());
        console.log(`Item ${id} should now be removed!`);
    }, delay);
}

function handle_mousedown(e) {
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

function show_sign_in_modal(_e) {
    const dlg = document.getElementById("login-modal");
    console.info("Got element ", dlg);
    if (dlg) {
        dlg.showModal();
    }
}

function handle_click(e) {
    // Close modal on [x]
    if (e.target.id === "btn-login-modal-close") {
        const sign_in_dlg = document.getElementById("login-modal");
        if (sign_in_dlg) {
            sign_in_dlg.close();
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
    //document.body.addEventListener("htmx:configRequest", handle_htmx_config_request);

    // Clicking account options when user is logged in
    window.handle_account_menu_click = handle_account_menu_click;

    // Add fade and remove item util function for elements to be able to use
    window.fade_and_remove_item = fade_and_remove_item;

    // Sign in modal show
    window.show_sign_in_modal = show_sign_in_modal;
}

client_init();
