// ============================================================
// Browser Pet — Popup Script (On-Demand Pet Summoning)
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  const btn = document.getElementById("toggle-btn");
  const statusText = document.getElementById("status-text");
  const statusDot = document.getElementById("status-dot");
  const infoText = document.getElementById("info-text");

  const CONTENT_SCRIPTS = [
    "src/constants.js",
    "src/ui-components.js",
    "src/pdf-export.js",
    "src/storage.js",
    "src/notes-ui.js",
    "src/settings-ui.js",
    "src/pet.js"
  ];

  function isRestrictedUrl(url) {
    if (!url) return true;
    return (
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("devtools://") ||
      url.startsWith("edge://") ||
      url.startsWith("about:") ||
      url.includes("chromewebstore.google.com")
    );
  }

  // Inject content scripts dynamically if not already injected
  function injectScripts(tabId, callback) {
    if (!chrome.scripting) {
      if (callback) callback(false);
      return;
    }
    chrome.scripting.executeScript(
      {
        target: { tabId: tabId },
        files: CONTENT_SCRIPTS,
      },
      function () {
        if (chrome.runtime.lastError) {
          if (callback) callback(false);
        } else {
          if (callback) callback(true);
        }
      }
    );
  }

  function updateUI(visible) {
    btn.disabled = false;
    btn.dataset.petVisible = String(visible);

    if (visible) {
      btn.textContent = "► Hide Pet";
      btn.className = "hide-mode";
      btn.dataset.mode = "hide";
      statusText.textContent = "ACTIVE";
      statusDot.className = "status-dot active";
      infoText.innerHTML = "Pet is active on this tab!<br>Click on the pet to access attacks, notes, and settings.";
    } else {
      btn.textContent = "► Show Pet";
      btn.className = "";
      btn.dataset.mode = "show";
      statusText.textContent = "HIDDEN";
      statusDot.className = "status-dot hidden";
      infoText.innerHTML = "Pet is hidden.<br>Click <b>► Show Pet</b> to summon on this page.";
    }
  }

  function showReadyToSummon() {
    btn.disabled = false;
    btn.dataset.mode = "summon";
    btn.dataset.petVisible = "false";
    btn.textContent = "► Show Pet";
    btn.className = "";
    statusText.textContent = "HIDDEN";
    statusDot.className = "status-dot hidden";
    infoText.innerHTML = "Pet is hidden.<br>Click <b>► Show Pet</b> to summon on this page.";
  }

  function showRestrictedState() {
    statusText.textContent = "RESTRICTED";
    statusDot.className = "status-dot hidden";
    btn.textContent = "► Open Web Page";
    btn.disabled = false;
    btn.className = "";
    btn.dataset.mode = "open-tab";
    infoText.innerHTML = "Chrome blocks extensions on internal pages.<br>Click below to open a website and summon your pet!";
  }

  // Query active tab
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) {
      showRestrictedState();
      return;
    }

    if (isRestrictedUrl(tab.url)) {
      showRestrictedState();
      return;
    }

    // Ping content script to check if pet is currently visible
    chrome.tabs.sendMessage(tab.id, { action: "getPetStatus" }, function (res) {
      if (chrome.runtime.lastError || !res) {
        // Content script not yet injected — ready to summon when clicked!
        showReadyToSummon();
      } else {
        updateUI(res.visible);
      }
    });
  });

  // Toggle button click handler
  btn.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) return;

      if (btn.dataset.mode === "open-tab") {
        chrome.tabs.create({ url: "https://www.google.com" });
        window.close();
        return;
      }

      btn.disabled = true;

      if (btn.dataset.mode === "summon") {
        // Inject scripts first, then send showPet message
        injectScripts(tab.id, function (success) {
          if (success) {
            chrome.tabs.sendMessage(tab.id, { action: "showPet" }, function (res) {
              updateUI(true);
            });
          } else {
            showReadyToSummon();
          }
        });
        return;
      }

      if (btn.dataset.mode === "show") {
        chrome.tabs.sendMessage(tab.id, { action: "showPet" }, function (res) {
          if (chrome.runtime.lastError || !res) {
            // Fallback inject and show
            injectScripts(tab.id, function (success) {
              if (success) {
                chrome.tabs.sendMessage(tab.id, { action: "showPet" }, function () {
                  updateUI(true);
                });
              } else {
                showReadyToSummon();
              }
            });
          } else {
            updateUI(true);
          }
        });
        return;
      }

      if (btn.dataset.mode === "hide") {
        chrome.tabs.sendMessage(tab.id, { action: "hidePet" }, function (res) {
          updateUI(false);
        });
        return;
      }
    });
  });
});
