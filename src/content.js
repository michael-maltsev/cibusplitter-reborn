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

function saveParticipants() {
    const curLang = document.body.lang ?? "he";
    const participants = {};
    const container = Array.from(
        document.querySelectorAll("#mainContent h3")
    ).filter((el) => el?.textContent == LANG.participants[curLang])[0]
        ?.parentElement?.parentElement?.parentElement;

    // Get all li elements (user details) which are not nested in another li
    // element (e.g. order details).
    container.querySelectorAll("li:not(li li)").forEach((liElement) => {
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

    const container = Array.from(
        document.querySelectorAll("#mainContent h3")
    ).filter(
        (el) => el?.textContent == LANG.participants[document.body.lang ?? "he"]
    )[0]?.parentElement?.parentElement?.parentElement;

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
