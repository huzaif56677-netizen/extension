// ============================================================
// Browser Pet — Background Service Worker
// ============================================================

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg.action === "captureVisibleTab") {
    const windowId = (sender && sender.tab && sender.tab.windowId) ? sender.tab.windowId : null;
    chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 90 }, function (dataUrl) {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({ success: false, error: chrome.runtime.lastError ? chrome.runtime.lastError.message : "Failed to capture" });
      } else {
        sendResponse({ success: true, dataUrl: dataUrl });
      }
    });
    return true; // Keep message channel open for async response
  }
});
