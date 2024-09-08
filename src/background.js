chrome.runtime.onMessageExternal.addListener(function (
    request,
    sender,
    sendResponse
) {
    if (request.participants) {
        chrome.storage.session.set({ participants: request.participants });
    } else if (request.getAllData) {
        chrome.storage.session.get("participants", (sessionRes) => {
            chrome.storage.sync.get("friends", (syncRes) => {
                sendResponse({
                    participants: sessionRes?.participants || {},
                    friends: syncRes?.friends || {},
                });
            });
        });
    }
});
