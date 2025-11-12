const s = document.createElement("script");

if (document.location.href.startsWith("https://wolt.com")) {
    s.src = chrome.runtime.getURL("content.js");
} else if (
    document.location.href.startsWith("https://consumers.pluxee.co.il/ThirdPartyPurchase/oauth")
) {
    s.src = chrome.runtime.getURL("sibus-content.js");
}
s.onload = function () {
    this.remove();
};

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request?.message == "splitAgain") {
        window.postMessage({"splitAgain": true})
    }
});

s.id = chrome.runtime.id;
(document.head || document.documentElement).appendChild(s);
