// ============================================================
// Browser Pet — Settings UI (Pet Size, Storage, Danger Zone)
// ============================================================

window.BrowserPet = window.BrowserPet || {};

(function (Pet) {
  "use strict";

  const RETRO = Pet.RETRO;

  function doSettings() {
    const panel = Pet.createPanel("Settings");

    const body = document.createElement("div");
    Object.assign(body.style, {
      padding: "12px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      overflowY: "auto",
      maxHeight: "390px",
    });

    // Pet Scale Group
    const scaleGroup = document.createElement("div");
    const scaleLabel = document.createElement("label");
    scaleLabel.textContent = "► Pet Size";
    Object.assign(scaleLabel.style, {
      fontSize: "16px",
      color: RETRO.text,
      display: "block",
      marginBottom: "6px",
      fontFamily: RETRO.font,
    });

    const scaleRow = document.createElement("div");
    Object.assign(scaleRow.style, { display: "flex", alignItems: "center", gap: "10px" });

    // The ONLY allowed resize options: 1.5, 2, 2.5, 3
    const scaleValues = Pet.VALID_SCALES;
    const currentScale = Pet.state.currentScale;

    const scaleSlider = document.createElement("input");
    scaleSlider.type = "range";
    scaleSlider.min = "1.5";
    scaleSlider.max = "3";
    scaleSlider.step = "0.5";
    scaleSlider.value = String(scaleValues.includes(currentScale) ? currentScale : Pet.DEFAULT_SCALE);
    Object.assign(scaleSlider.style, {
      flex: "1",
      cursor: "pointer",
      accentColor: RETRO.accent,
    });

    const scaleValue = document.createElement("span");
    scaleValue.textContent = currentScale + "×";
    Object.assign(scaleValue.style, {
      fontSize: "16px",
      color: RETRO.text,
      minWidth: "36px",
      fontFamily: RETRO.font,
      textAlign: "center",
      border: RETRO.borderW + " solid " + RETRO.border,
      padding: "2px 6px",
      background: RETRO.bgLight,
    });

    // Preset buttons for the 4 resize options: [1.5x] [2x] [2.5x] [3x]
    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, {
      display: "flex",
      gap: "6px",
      marginTop: "6px",
    });

    const buttons = [];
    scaleValues.forEach(function (val) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = val + "×";
      const isSelected = Pet.state.currentScale === val;
      Object.assign(btn.style, {
        flex: "1",
        padding: "5px 2px",
        fontSize: "14px",
        fontFamily: RETRO.font,
        border: RETRO.borderW + " solid " + RETRO.border,
        background: isSelected ? RETRO.accent : RETRO.bgLight,
        color: isSelected ? RETRO.bgLight : RETRO.text,
        cursor: "pointer",
        textAlign: "center",
      });
      btn.addEventListener("click", function () {
        setScale(val);
      });
      btnRow.appendChild(btn);
      buttons.push({ val: val, el: btn });
    });

    function setScale(val) {
      if (!scaleValues.includes(val)) return;
      Pet.state.currentScale = val;
      scaleSlider.value = String(val);
      scaleValue.textContent = val + "×";
      if (Pet.applyScale) Pet.applyScale();
      Pet.storage.saveScale(val);
      if (Pet.onScaleChanged) Pet.onScaleChanged(val);

      // Update button highlights
      buttons.forEach(function (b) {
        const sel = b.val === val;
        b.el.style.background = sel ? RETRO.accent : RETRO.bgLight;
        b.el.style.color = sel ? RETRO.bgLight : RETRO.text;
      });
    }

    scaleSlider.addEventListener("input", function () {
      const ns = parseFloat(scaleSlider.value);
      setScale(ns);
    });

    scaleRow.appendChild(scaleSlider);
    scaleRow.appendChild(scaleValue);
    scaleGroup.appendChild(scaleLabel);
    scaleGroup.appendChild(scaleRow);
    scaleGroup.appendChild(btnRow);
    body.appendChild(scaleGroup);

    // Divider
    const divider1 = document.createElement("div");
    Object.assign(divider1.style, {
      height: "2px",
      background: RETRO.border,
    });
    body.appendChild(divider1);

    // Storage info
    const storageGroup = document.createElement("div");
    const storageLabel = document.createElement("label");
    storageLabel.textContent = "► Storage";
    Object.assign(storageLabel.style, {
      fontSize: "16px",
      color: RETRO.text,
      display: "block",
      marginBottom: "6px",
      fontFamily: RETRO.font,
    });

    const storageInfo = document.createElement("div");
    Object.assign(storageInfo.style, {
      fontSize: "14px",
      color: RETRO.textMuted,
      fontFamily: RETRO.font,
      padding: "4px 6px",
      background: RETRO.bgLight,
      border: RETRO.borderW + " solid " + RETRO.borderLight,
    });
    storageInfo.textContent = "Calculating...";

    Pet.storage.getStorageBytes(function (bytes) {
      const kb = (bytes / 1024).toFixed(1);
      const maxKB = 5120; // 5MB limit
      const pct = ((bytes / (maxKB * 1024)) * 100).toFixed(1);
      storageInfo.textContent = "Used: " + kb + " KB / " + maxKB + " KB (" + pct + "%)";
    });

    storageGroup.appendChild(storageLabel);
    storageGroup.appendChild(storageInfo);
    body.appendChild(storageGroup);

    // Divider
    const divider2 = document.createElement("div");
    Object.assign(divider2.style, {
      height: "2px",
      background: RETRO.border,
    });
    body.appendChild(divider2);

    // Danger zone
    const dangerGroup = document.createElement("div");
    const dangerLabel = document.createElement("label");
    dangerLabel.textContent = "► Danger Zone";
    Object.assign(dangerLabel.style, {
      fontSize: "16px",
      color: RETRO.danger,
      display: "block",
      marginBottom: "6px",
      fontFamily: RETRO.font,
    });

    const clearBtn = Pet.retroButton("DEL All Notes", "danger");
    clearBtn.style.width = "100%";
    clearBtn.addEventListener("click", function () {
      if (clearBtn.dataset.confirm === "true") {
        Pet.storage.clearAllNotes(function () {
          clearBtn.textContent = "✓ All notes deleted";
          clearBtn.style.background = RETRO.successBg;
          clearBtn.style.color = RETRO.success;
          setTimeout(Pet.closePanel, 1000);
        });
      } else {
        clearBtn.dataset.confirm = "true";
        clearBtn.textContent = "⚠ Click again to confirm";
        clearBtn.style.background = "#c06060";
        clearBtn.style.color = "#fff";
        setTimeout(function () {
          clearBtn.dataset.confirm = "false";
          clearBtn.textContent = "DEL All Notes";
          clearBtn.style.background = RETRO.dangerBg;
          clearBtn.style.color = RETRO.danger;
        }, 3000);
      }
    });

    dangerGroup.appendChild(dangerLabel);
    dangerGroup.appendChild(clearBtn);
    body.appendChild(dangerGroup);

    // Version
    const ver = document.createElement("div");
    ver.textContent = "═══ Browser Pet v1.1.0 ═══";
    Object.assign(ver.style, {
      fontSize: "14px",
      color: RETRO.borderLight,
      textAlign: "center",
      marginTop: "4px",
      fontFamily: RETRO.font,
    });
    body.appendChild(ver);

    panel.appendChild(body);
  }

  Pet.settings = {
    doSettings: doSettings,
  };
  Pet.doSettings = doSettings;

})(window.BrowserPet);
