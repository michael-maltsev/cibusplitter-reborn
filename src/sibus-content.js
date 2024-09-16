const EXTENSION_ID = document.currentScript.id;

const splitCost = () => {
    chrome.runtime.sendMessage(
        EXTENSION_ID,
        { getAllData: true },
        (response) => {
            const friends = response.friends || {};
            const participants = response.participants || {};
            const cibusContacts = [];

            // This holds the cost of the order without the shipping, extra distance and minimum per order price
            const partialCost = Object.keys(participants).reduce(
                (accu, name) => {
                    return accu + participants[name].total;
                },
                0
            );

            const totalOrderCost = parseFloat(
                document.querySelector("#hSubTitle big").textContent
            );

            const extraCost = totalOrderCost - partialCost;

            if (!document.getElementById("cbSplit").checked) {
                document.querySelector("label[for=cbSplit]").click();
                document.querySelector("label[for=cbFriendsList]").click();
            }

            // In the first pass we add all of the participants
            document
                .querySelectorAll("#friendsList label span")
                .forEach((el) => {
                    const cibusName = el.textContent;
                    cibusContacts.push(cibusName);
                    if (cibusName in participants) {
                        el.click();
                    } else {
                        Object.keys(friends).every((woltName) => {
                            if (cibusName == friends[woltName] && woltName in participants) {
                                el.click();
                                return false;
                            }
                            return true;
                        });
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
                    let p = null;
                    if (name in participants) {
                        p = participants[name];
                        missingParticipants.delete(name);
                    } else {
                        Object.keys(friends).every((woltName) => {
                            if (name == friends[woltName]) {
                                p = participants[woltName];
                                missingParticipants.delete(woltName);
                                return false;
                            }
                            return true;
                        });

                        if (!p) {
                            return;
                        }
                    }

                    const pPrice = p.total;
                    const extra = Math.round(
                        (pPrice / partialCost) * extraCost
                    );

                    const totalForParticipant = pPrice + extra;

                    el.parentElement.querySelector("input").value =
                        totalForParticipant;
                    el.parentElement
                        .querySelector("input")
                        .dispatchEvent(
                            new Event("change", { bubbles: true })
                        );
                });

            chrome.runtime.sendMessage(EXTENSION_ID, {
                cibusContacts,
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
