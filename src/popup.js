const d = document;

const generateNodes = (type) => {
    const ret = {
        row: d.createElement("div"),
        woltName: d.createElement("div"),
        cibusName: d.createElement("div"),
        action: d.createElement("div"),
    };

    ret["row"].setAttribute("class", "row");
    ret["woltName"].setAttribute("class", "col wolt");
    ret["cibusName"].setAttribute("class", "col cibus");
    ret["action"].setAttribute("class", "col actions");

    switch (type) {
        case "conversion":
            const removeIcon = d.createElement("img");
            removeIcon.setAttribute(
                "src",
                chrome.runtime.getURL("images/trash.png")
            );
            removeIcon.setAttribute("class", "remove");
            ret["action"].appendChild(removeIcon);
            break;
        case "order":
            const add = d.createElement("img");
            add.setAttribute("src", chrome.runtime.getURL("images/add.png"));
            add.setAttribute("class", "add");
            ret["action"].appendChild(add);
            break;
    }

    return ret;
};

const addRow = (table, type, woltNameStr, cibusNameData) => {
    const { row, woltName, cibusName, action } = generateNodes(type);

    woltName.textContent = woltNameStr;
    row.appendChild(woltName);

    if (cibusNameData) {
        if (Array.isArray(cibusNameData)) {
            if (cibusNameData.length > 0) {
                const comboBox = document.createElement("select");

                const placeholderOption = document.createElement("option");
                placeholderOption.textContent = "שם ב-Cibus";
                placeholderOption.value = "";
                comboBox.appendChild(placeholderOption);

                for (const name of cibusNameData) {
                    const option = document.createElement("option");
                    option.textContent = name;
                    option.value = name;
                    comboBox.appendChild(option);
                }

                cibusName.appendChild(comboBox);
            }
        } else {
            cibusName.textContent = cibusNameData;
        }

        row.appendChild(cibusName);
        row.appendChild(action);
    }

    table.appendChild(row);
};

const fillConversionTable = () => {
    const table = d.querySelector("#conversion-table");
    table.querySelectorAll("div.row").forEach( e => e.remove());

    chrome.storage.sync.get("friends", function (result) {
        if (!result.friends) {
            return;
        }
        Object.keys(result.friends).forEach((friend) => {
            addRow(table, "conversion", friend, result.friends[friend]);
        });
    });
};

const fillOrderTable = () => {
    const table = d.querySelector("#current-order");
    table.querySelectorAll("div.row").forEach( e => e.remove());
    chrome.storage.session.get(["participants", "cibusContacts"], function (sessionRes) {
        chrome.storage.sync.get("friends", function (resultFriends) {
            const friends = resultFriends?.friends || {};
            const participants = sessionRes?.participants || {};
            const cibusContacts = sessionRes?.cibusContacts || [];
            if (
                Object.keys(participants).length == 0
            ) {
                document.querySelector("#current-order-container").remove();
                return;
            }

            Object.keys(participants).forEach((participant) => {
                if (!participants[participant].isHost && !(participant in friends)) {
                    addRow(table, "order", participant, cibusContacts);
                }
            });
        })
    });
};

const handleRemoveFriend = (el) => {
    const rowElement = el.parentElement.parentElement;
    const name = rowElement.querySelector("div.wolt").textContent;

    chrome.storage.sync.get("friends", function (result) {
        const friends = result.friends;
        delete friends[name];

        chrome.storage.sync.set({ friends });
        rowElement.remove();
        fillTables();
    });
};

const handleAddFriend = (name, selectedCibusName) => {
    let woltName = name;
    if (!woltName) {
        woltName = prompt("Please enter Wolt name");
        if (!woltName) {
            return;
        }
    }

    let cibusName = selectedCibusName;
    if (!cibusName) {
        cibusName = prompt("Please enter Cibus name");
        if (!cibusName) {
            return;
        }
    }

    chrome.storage.sync.get("friends", function (result) {
        const table = d.querySelector("#conversion-table");
        const friends = result.friends || {};
        friends[woltName] = cibusName;
        chrome.storage.sync.set({ friends });

        addRow(table, "conversion", woltName, cibusName);
        fillTables();
    });
};

const registerClickHandlers = () => {
    d.querySelector("#conversion-table").addEventListener("click", (ev) => {
        if (ev.target.classList.contains("add")) {
            handleAddFriend();
        } else if (ev.target.classList.contains("remove")) {
            handleRemoveFriend(ev.target);
        }
    });

    d.querySelector("#current-order").addEventListener("click", (ev) => {
        if (ev.target.classList.contains("add")) {
            const name =
                ev.target.parentElement.parentElement.querySelector(
                    ".wolt"
                ).textContent;
            const selectedCibusName =
                ev.target.parentElement.parentElement.querySelector(
                    ".cibus > select"
                )?.value;
            handleAddFriend(name, selectedCibusName);
        }
    });
};

const fillTables = () => {
    fillConversionTable();
    fillOrderTable();
}

const exportFriends = () => {
    chrome.storage.sync.get("friends", function (result) {
        if (!result.friends) {
            alert("Friends list is empty");
            return;
        }
        navigator.clipboard.writeText(JSON.stringify(result.friends)).then(() => {
            alert("Friends list copied to clipboard");
        }
        );
    });
};

const importFriends = () => {
    const friends = prompt("Please paste the friends list here:");
    if (!friends) {
        return;
    }

    let parsed = {};

    try {
        parsed = JSON.parse(friends);
        // TODO: Validate friends list structure
    } catch (e) {
        if (e instanceof SyntaxError) {
            alert("Friends list is invalid.");
        } else {
            alert("Error: " + e);
        }
        return;
    }
    chrome.storage.sync.set({ "friends": parsed });
    fillTables();
};

window.addEventListener("load", () => {
    fillTables();
    registerClickHandlers();

    document
        .getElementById("split-again")
        .addEventListener("click", () => {
            chrome.tabs.query({currentWindow: true, active: true}, function (tabs){
                const activeTab = tabs[0];
                chrome.tabs.sendMessage(activeTab.id, {"message": "splitAgain"});
            });
        })
    
        document
        .getElementById("import-friends")
        .addEventListener("click", () => {
            importFriends();
        })

        document
        .getElementById("export-friends")
        .addEventListener("click", () => {
            exportFriends();
        })
});
