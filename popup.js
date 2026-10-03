// ============================================================
// Browser Pet — Popup Script
// ============================================================
//
// This script runs inside the extension's popup (the small
// panel that appears when you click the extension icon in
// Chrome's toolbar).
//
// It communicates with the content script (content.js) using
// chrome.tabs.sendMessage(). The content script listens for
// messages via chrome.runtime.onMessage.
//
// Messages:
//   { action: "getPetStatus" }  → response: { visible: bool }
//   { action: "showPet" }       → response: { status: "shown" }
//   { action: "hidePet" }       → response: { status: "hidden" }
//

document.addEventListener("DOMContentLoaded", function () {
  const btn = document.getElementById("toggle-btn");
  const status = document.getElementById("status");

  // Query the currently active tab and ask the content script
  // for the pet's current visibility status.
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs[0] || !tabs[0].id) {
      showUnavailable();
      return;
    }

    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: "getPetStatus" },
      function (response) {
        if (chrome.runtime.lastError || !response) {
          showUnavailable();
          return;
        }
        updateUI(response.visible);
      }
    );
  });

  // Toggle button click — show or hide the pet
  btn.addEventListener("click", function () {
    const isVisible = btn.dataset.petVisible === "true";
    const action = isVisible ? "hidePet" : "showPet";

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs[0] || !tabs[0].id) return;

      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: action },
        function (response) {
          if (chrome.runtime.lastError) return;
          updateUI(action === "showPet");
        }
      );
    });
  });

  function updateUI(visible) {
    btn.disabled = false;
    btn.dataset.petVisible = String(visible);

    if (visible) {
      btn.textContent = "Hide Pet";
      status.textContent = "Your pet is active \uD83D\uDC3E";
      btn.style.background = "rgba(239, 68, 68, 0.25)";
      btn.style.color = "#f87171";
    } else {
      btn.textContent = "Show Pet";
      status.textContent = "Your pet is hidden";
      btn.style.background = "rgba(99, 102, 241, 0.8)";
      btn.style.color = "#fff";
    }
  }

  function showUnavailable() {
    status.textContent = "Pet unavailable on this page";
    btn.textContent = "Not Available";
    btn.disabled = true;
    btn.style.background = "rgba(255,255,255,0.08)";
    btn.style.color = "#666";
  }
});
