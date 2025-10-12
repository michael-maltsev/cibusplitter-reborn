const EXTENSION_ID = document.currentScript.id;
const LANG = {
    participants: {
        he: "משתתפים",
        en: "Participants",
    },
    host: {
        he: "מנהל/ת",
        en: "Host",
    },
};

function getParticipantsContainer() {
    const curLang = document.body.lang ?? "he";
    return Array.from(
        document.querySelectorAll("#mainContent h3")
    ).filter(
        (el) => el?.textContent == LANG.participants[curLang]
    )[0]?.parentElement?.parentElement?.parentElement;
}

function saveParticipants() {
    const curLang = document.body.lang ?? "he";
    const participants = {};
    const container = getParticipantsContainer();

    const tabPanels = container.querySelectorAll("div[id^=tabpanel]");

    // If there are "Not ready" and "Ready" tabs, we want to get the last one
    // (which is the "Ready" tab) to avoid including the "Not ready"
    // participants.
    const lastTabPanel = tabPanels[tabPanels.length - 1];

    // Get all li elements (user details) which are not nested in another li
    // element (e.g. order details).
    lastTabPanel.querySelectorAll("li:not(li li)").forEach((liElement) => {
        const NAME_POSITION = 0;

        const spans = liElement.querySelectorAll("span");
        const name = spans[NAME_POSITION].textContent;
        const isHost =
            spans[NAME_POSITION].nextElementSibling?.textContent ==
            LANG.host[curLang];
        const total = parseFloat(
            [...spans]
                .filter(x => x.textContent.includes('₪'))
                .pop()
                ?.textContent
                ?.replaceAll('₪', '')
            || 0
        );

        participants[name] = {
            total,
            isHost,
        };
    });

    chrome.runtime.sendMessage(EXTENSION_ID, {
        participants,
    });
}

function registerMutationObserver(cnt = 0) {
    if (cnt > 10) {
        return;
    }

    const container = getParticipantsContainer();
    if (!container) {
        setTimeout(() => {
            registerMutationObserver(cnt + 1);
        }, 2000);
        return;
    }

    saveParticipants();

    const observer = new MutationObserver(function (mutations) {
        saveParticipants();
    });

    const config = {
        subtree: true,
        attributes: false,
        childList: true,
        characterData: false,
    };

    observer.observe(container, config);
}

const resetParticipants = () => {
    const participants = {};
    chrome.runtime.sendMessage(EXTENSION_ID, {
        participants,
    });
};

window.addEventListener("load", () => {
    resetParticipants();

    window.history.pushState = new Proxy(window.history.pushState, {
        apply: (target, thisArg, argArray) => {
            if (argArray[2]?.endsWith("/checkout")) {
                setTimeout(registerMutationObserver, 2000);
            } else if (location.href.endsWith("/checkout") && !argArray[2]?.endsWith("/checkout")) {
                resetParticipants();
            }
            return target.apply(thisArg, argArray);
        },
    });

    if (window.location.href.endsWith("/checkout")) {
        setTimeout(registerMutationObserver, 2000);
    }
});
