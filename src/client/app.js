const MODAL_DIALOGS = [
    {
        id: "login-modal",
        close_btn_id: "btn-login-modal-close",
    },
    {
        id: "create-account-modal",
        close_btn_id: "btn-create-account-modal-close",
    },
];

const DROPDOWN_MENUS = [
    {
        tbtn_id: "account-menu-button",
        menu_id: "dropdown-menu",
    },
];

const GENERAL_BUTTONS = [
    {
        id: "btn-nav-right-login",
        on_click: (_e) => {
            show_modal(0);
        },
    },
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

function show_modal(ind) {
    const dlg = document.getElementById(MODAL_DIALOGS[ind].id);
    if (dlg) {
        dlg.showModal();
    }
}

function handle_click_general_buttons(e) {
    for (const btn of GENERAL_BUTTONS) {
        // If the target id matches then just do that, otherwise we gotta get the element from the document and see if it contains the target
        // as we might have icons or other such things that got the click
        if (e.target.id === btn.id) {
            btn.on_click(e);
        } else {
            const btn_element = document.getElementById(btn.id);
            if (btn_element && btn_element.contains(e.target)) {
                btn.on_click(e);
            }
        }
    }
}

function handle_click_dropdown_menus(e) {
    for (const dropdown of DROPDOWN_MENUS) {
        const account_menu = document.getElementById(dropdown.menu_id);
        const is_hidden = account_menu ? account_menu.classList.contains("hidden") : true;
        const is_sep = e.target && e.target.classList.contains("sep");
        if (account_menu && e.target.id === dropdown.tbtn_id) {
            // If the target is the toggle button, toggle the menu
            if (is_hidden) {
                account_menu.classList.remove("hidden");
            } else {
                account_menu.classList.add("hidden");
            }
        } else if (
            account_menu &&
            !is_hidden &&
            !is_sep &&
            (e.target.id === dropdown.menu_id || account_menu.contains(e.target))
        ) {
            account_menu.classList.add("hidden");
        }
    }
}

function handle_click_modal_dialogs(e) {
    for (const modal of MODAL_DIALOGS) {
        if (e.target.id === modal.close_btn_id) {
            const dlg = document.getElementById(modal.id);
            if (dlg) {
                dlg.close();
            }
        }
    }
}

function handle_mousedown_dropdown_menus(e) {
    for (const dropdown of DROPDOWN_MENUS) {
        // Close the account menu if its open and the click is outside of it
        // But don't set hidden if the thing clicked is the button because then the on click signal
        // for the button will toggle it visible again
        if (e.target.id !== dropdown.tbtn_id && e.target.id !== dropdown.menu_id) {
            const account_menu = document.getElementById(dropdown.menu_id);
            if (account_menu && !account_menu.classList.contains("hidden") && !account_menu.contains(e.target)) {
                account_menu.classList.add("hidden");
            }
        }
    }
}

function handle_escape_keydown_dropdown_menus(e) {
    for (const dropdown of DROPDOWN_MENUS) {
        const account_menu = document.getElementById(dropdown.menu_id);
        if (account_menu && !account_menu.classList.contains("hidden")) {
            account_menu.classList.add("hidden");
        }
    }
}

function handle_mousedown(e) {
    handle_mousedown_dropdown_menus(e);
}

function handle_click(e) {
    handle_click_modal_dialogs(e);
    handle_click_dropdown_menus(e);
    handle_click_general_buttons(e);
}

function handle_keydown(e) {
    if (e.key === "Escape") {
        handle_escape_keydown_dropdown_menus(e);
    }
}

function handle_htmx_load(e) {
    if (e.target && e.target.classList.contains("temp-item")) {
        fade_and_remove_item(e.target.id);
    }
}

function client_init() {
    if (window.__appInit) return;
    window.__appInit = true;
    document.addEventListener("click", handle_click);
    document.addEventListener("mousedown", handle_mousedown);
    document.addEventListener("keydown", handle_keydown);
    document.addEventListener("htmx:load", handle_htmx_load);
}

client_init();
