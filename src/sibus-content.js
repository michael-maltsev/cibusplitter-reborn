const EXTENSION_ID = document.currentScript.id;

function cleanUpName(name) {
    return name.trim().replace(/\s+/g, " ");
}

function calcParticipantsCost(participants, totalOrderCost, amigaAccount) {
    const participantsCost = {};

    // This holds the cost of the order without the shipping, extra distance and minimum per order price
    const partialCost = Object.keys(participants).reduce(
        (accu, name) => {
            return accu + participants[name].total;
        },
        0
    );

    const extraCost = totalOrderCost - partialCost;

    for (const [name, participant] of Object.entries(participants)) {
        participantsCost[name] = participant.total + extraCost / Object.keys(participants).length;
    }

    if (amigaAccount) {
        const totalAmigaAmount = amigaAccount.amount * Object.keys(participants).length;

        let amigaAmountLeft = totalAmigaAmount;
        let participantsLeft = Object.keys(participants).length;

        for (const [name, cost] of Object.entries(participantsCost).sort((a, b) => a[1] - b[1])) {
            // Avoid leaving the host with a zero amount which is unsupported by the Cibus UI
            const minAmountToLeave = participants[name].isHost ? 1 : 0;

            const discount = Math.min(amigaAmountLeft / participantsLeft, Math.max(cost - minAmountToLeave, 0));

            participantsCost[name] -= discount;
            amigaAmountLeft -= discount;
            participantsLeft--;

            if (amigaAmountLeft <= 0) {
                break;
            }
        }

        const totalDiscount = totalAmigaAmount - amigaAmountLeft;
        participantsCost[amigaAccount.name] = totalDiscount;
    }

    return participantsCost;
}

function getAmigaAccount(friends) {
    const currentDate = new Date;
    const currentTime = currentDate.getHours() * 100 + currentDate.getMinutes();

    for (const [woltName, cibusName] of Object.entries(friends)) {
        const match = woltName.match(/^Amiga(\d+)(?:_(\d\d\d\d)-(\d\d\d\d))?$/i);
        if (!match) {
            continue;
        }

        const timeFrom = parseInt(match[2] ?? '1900', 10);
        const timeTo = parseInt(match[3] ?? '0300', 10);
        if (timeFrom <= timeTo) {
            // e.g. 19:00-24:00
            if (currentTime < timeFrom || currentTime >= timeTo) {
                continue;
            }
        } else {
            // e.g. 19:00-03:00
            if (currentTime >= timeTo && currentTime < timeFrom) {
                continue;
            }
        }

        return {
            name: cibusName,
            amount: parseInt(match[1], 10),
        };
    }

    return null;
}

const splitCost = () => {
    chrome.runtime.sendMessage(
        EXTENSION_ID,
        { getAllData: true },
        (response) => {
            const friends = response.friends || {};
            const participants = response.participants || {};
            const cibusContacts = new Set();

            const totalOrderCost = parseFloat(
                document.querySelector(".amount").textContent.replace(/^₪/, "")
            );

            // Secret Amiga account that pays for your food
            const amigaAccount = getAmigaAccount(friends);

            const participantsCost = calcParticipantsCost(participants, totalOrderCost, amigaAccount);

            const splitCheckbox = document.querySelector(
                ".split-wrap app-toggle-button input.ng-toggle-switch-input[type=checkbox]");
            if (!splitCheckbox.checked) {
                splitCheckbox.click();
            }

            // In the first pass we add all of the participants
            let maxIterations = Infinity;
            for (let i = 0; i < maxIterations; i++) {
                // Click to add a participant
                document.querySelector(".split-wrap img.plus").click();
                if (!document.querySelector(".mat-menu-content")) {
                    document.querySelector(".split-wrap .mat-menu-trigger:not(.hid) .dd-arrow").click();
                }

                let elements = document.querySelectorAll("button.friends-menu-item");
                if (i === 0) {
                    maxIterations = elements.length;
                    for (const el of elements) {
                        const cibusName = cleanUpName(el.textContent);
                        cibusContacts.add(cibusName);
                    }
                }

                let matched = false;
                for (const el of elements) {
                    const cibusName = cleanUpName(el.textContent);
                    if (amigaAccount && cibusName === amigaAccount.name) {
                        matched = true;
                    } else if (cibusName in participants) {
                        matched = true;
                    } else {
                        for (const [woltNameIter, cibusNameIter] of Object.entries(friends)) {
                            if (cibusName == cibusNameIter && woltNameIter in participants) {
                                matched = true;
                                break;
                            }
                        }
                    }

                    if (matched) {
                        el.click();
                        break;
                    }
                }

                if (!matched) {
                    break;
                }
            }

            // Close menu if still open
            if (document.querySelector(".mat-menu-content")) {
                document.querySelector(".split-wrap .mat-menu-trigger:not(.hid) .dd-arrow").click();
            }

            // Cancel last addition
            // Seems to cause buggy calculation, commented for now
            // document.querySelector(".split-wrap > table:has(.mat-menu-trigger:not(.hid) .dd-arrow) .plus.del").click();

            // We start with all of the participants and remove those that we found one by one
            const missingParticipants = new Set(Object.keys(participants).filter(name => !participants[name].isHost));

            // In the second pass we set the cost of each participant
            document
                /*
                    # Table row that:
                    table
                    # Has a delete button that is not invisible
                    :has(
                        .plus.del:not(.invisible)
                    )
                    # But does not have a non-hidden arrow button
                    :not(
                        :has(
                            .mat-menu-trigger:not(.hid) .dd-arrow
                        )
                    )
                */
                .querySelectorAll(".split-wrap > table:has(.plus.del:not(.invisible)):not(:has(.mat-menu-trigger:not(.hid) .dd-arrow))")
                .forEach((el) => {
                    const name = [...el.querySelectorAll("span:not(.mat-menu-trigger)")]
                        .map(x => cleanUpName(x.textContent))
                        .filter(x => x)[0];
                    let cost = null;
                    if (name in participantsCost) {
                        cost = participantsCost[name];
                        missingParticipants.delete(name);
                    } else {
                        for (const [woltNameIter, cibusNameIter] of Object.entries(friends)) {
                            if (name == cibusNameIter && woltNameIter in participantsCost) {
                                cost = participantsCost[woltNameIter];
                                missingParticipants.delete(woltNameIter);
                                break;
                            }
                        }

                        if (cost === null) {
                            return;
                        }
                    }

                    const splitPriceInput = el.querySelector(".split-price");
                    splitPriceInput.value =
                        cost.toFixed(2).replace(/\.0+$/, "").replace(/(\.[0-9]+?)0+$/, "$1");
                    splitPriceInput.dispatchEvent(new Event("input", { bubbles: true }));
                });

            chrome.runtime.sendMessage(EXTENSION_ID, {
                cibusContacts: [...cibusContacts].sort(),
            });

            if (missingParticipants.size > 0) {
                alert(`CibuSplitter Reborn: Some participants are missing: ${[...missingParticipants].join(", ")}. Use the extension's icon to add them to the conversion table and split again.`)
            }
        }
    );
};

window.addEventListener("message", (event) => {
    if (event.data?.splitAgain) {
        splitCost();
    }
});

function registerMutationObserver(cnt = 0) {
    if (cnt > 10) {
        return;
    }

    const container = document.querySelector(".oauth-container > .container");
    if (!container) {
        setTimeout(() => {
            registerMutationObserver(cnt + 1);
        }, 2000);
        return;
    }

    if (container.querySelector(":scope > app-oauth-pay")) {
        splitCost();
        return;
    }

    const observer = new MutationObserver(function (mutations) {
        if (container.querySelector(":scope > app-oauth-pay")) {
            splitCost();
            observer.disconnect();
        }
    });

    const config = {
        subtree: true,
        attributes: false,
        childList: true,
        characterData: false,
    };

    observer.observe(container, config);
}

window.addEventListener("load", () => {
    registerMutationObserver();
});
