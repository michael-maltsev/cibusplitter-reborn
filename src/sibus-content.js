const EXTENSION_ID = document.currentScript.id;

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
        const pPrice = participant.total;
        const extra = (pPrice / partialCost) * extraCost;

        const totalForParticipant = pPrice + extra;

        participantsCost[name] = totalForParticipant;
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
                document.querySelector("#hSubTitle big").textContent
            );

            // Secret Amiga account that pays for your food
            const amigaAccount = getAmigaAccount(friends);

            const participantsCost = calcParticipantsCost(participants, totalOrderCost, amigaAccount);

            if (!document.getElementById("cbSplit").checked) {
                document.querySelector("label[for=cbSplit]").click();
                document.querySelector("label[for=cbFriendsList]").click();
            }

            // In the first pass we add all of the participants
            document
                .querySelectorAll("#friendsList label span")
                .forEach((el) => {
                    const cibusName = el.textContent;
                    cibusContacts.add(cibusName);
                    if (amigaAccount && cibusName === amigaAccount.name) {
                        el.click();
                    } else if (cibusName in participants) {
                        el.click();
                    } else {
                        for (const [woltNameIter, cibusNameIter] of Object.entries(friends)) {
                            if (cibusName == cibusNameIter && woltNameIter in participants) {
                                el.click();
                                break;
                            }
                        }
                    }
                });

            // We start with all of the participants and remove those that we found one by one
            const missingParticipants = new Set(Object.keys(participants).filter(name => !participants[name].isHost));

            // In the second pass we set the cost of each participant
            document
                .querySelectorAll(
                    "#splitList div:not([class]) span:not([id='lblMyName'])"
                )
                .forEach((el) => {
                    const name = el.textContent;
                    cibusContacts.add(name);
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

                    el.parentElement.querySelector("input").value =
                        cost.toFixed(2).replace(/\.0+$/, "").replace(/(\.[0-9]+?)0+$/, "$1");
                    el.parentElement
                        .querySelector("input")
                        .dispatchEvent(
                            new Event("change", { bubbles: true })
                        );
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

window.addEventListener("load", () => {
    if (
        document.querySelector("h1#hTitle")?.textContent ==
            "הסכום לחיוב בסיבוס:" &&
        !document.querySelector("#pLoginText")
    ) {
        splitCost();
    }
});
