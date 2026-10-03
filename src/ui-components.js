// ============================================================
// Browser Pet — UI Component Factory (Retro Pixel Art)
// ============================================================

window.BrowserPet = window.BrowserPet || {};

(function (Pet) {
  "use strict";

  const RETRO = Pet.RETRO;

  function injectPixelFont() {
    if (document.getElementById("browser-pet-pixel-font")) return;
    const link = document.createElement("link");
    link.id = "browser-pet-pixel-font";
    link.rel = "stylesheet";
    link.href = Pet.PIXEL_FONT_URL;
    document.head.appendChild(link);
  }

  function retroBox(styles) {
    const el = document.createElement("div");
    Object.assign(el.style, {
      background: RETRO.bg,
      border: RETRO.borderW + " solid " + RETRO.border,
      boxShadow: RETRO.shadow,
      fontFamily: RETRO.font,
      color: RETRO.text,
      imageRendering: "pixelated",
    }, styles || {});
    return el;
  }

  function retroButton(text, variant) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = text;

    let bg = RETRO.bgLight;
    let color = RETRO.text;
    let hoverBg = RETRO.bgDark;

    if (variant === "primary") {
      bg = RETRO.accent;
      color = RETRO.bgLight;
      hoverBg = RETRO.accentHover;
    } else if (variant === "danger") {
      bg = RETRO.dangerBg;
      color = RETRO.danger;
      hoverBg = "#b08080";
    } else if (variant === "success") {
      bg = RETRO.successBg;
      color = RETRO.success;
      hoverBg = "#80b080";
    }

    Object.assign(btn.style, {
      padding: "6px 14px",
      border: RETRO.borderW + " solid " + RETRO.border,
      background: bg,
      color: color,
      fontSize: "16px",
      fontFamily: RETRO.font,
      cursor: "pointer",
      boxShadow: "1px 1px 0px " + RETRO.border,
      imageRendering: "pixelated",
      transition: "none",
      outline: "none",
      letterSpacing: "0.5px",
    });

    btn.addEventListener("mousedown", function () {
      btn.style.boxShadow = "none";
      btn.style.transform = "translate(1px, 1px)";
    });
    btn.addEventListener("mouseup", function () {
      btn.style.boxShadow = "1px 1px 0px " + RETRO.border;
      btn.style.transform = "none";
    });
    btn.addEventListener("mouseenter", function () {
      btn.style.background = hoverBg;
    });
    btn.addEventListener("mouseleave", function () {
      btn.style.background = bg;
      btn.style.boxShadow = "1px 1px 0px " + RETRO.border;
      btn.style.transform = "none";
    });

    return btn;
  }

  function retroInput(placeholder) {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    Object.assign(input.style, {
      width: "100%",
      padding: "6px 8px",
      border: RETRO.borderW + " solid " + RETRO.border,
      background: RETRO.bgLight,
      color: RETRO.text,
      fontSize: "16px",
      fontFamily: RETRO.font,
      outline: "none",
      boxSizing: "border-box",
      boxShadow: RETRO.shadowInset,
      imageRendering: "pixelated",
    });
    input.addEventListener("focus", function () {
      input.style.background = "#e8e8d8";
    });
    input.addEventListener("blur", function () {
      input.style.background = RETRO.bgLight;
    });
    return input;
  }

  function retroTextarea(placeholder) {
    const textarea = document.createElement("textarea");
    textarea.placeholder = placeholder;
    Object.assign(textarea.style, {
      width: "100%",
      height: "100px",
      padding: "6px 8px",
      border: RETRO.borderW + " solid " + RETRO.border,
      background: RETRO.bgLight,
      color: RETRO.text,
      fontSize: "16px",
      fontFamily: RETRO.font,
      outline: "none",
      resize: "vertical",
      boxSizing: "border-box",
      boxShadow: RETRO.shadowInset,
      lineHeight: "1.4",
      imageRendering: "pixelated",
    });
    textarea.addEventListener("focus", function () {
      textarea.style.background = "#e8e8d8";
    });
    textarea.addEventListener("blur", function () {
      textarea.style.background = RETRO.bgLight;
    });
    return textarea;
  }

  function createPanel(title) {
    closePanel();

    const panel = document.createElement("div");
    panel.className = "browser-pet-panel";

    Object.assign(panel.style, {
      position: "fixed",
      zIndex: "2147483646",
      width: "350px",
      maxHeight: "480px",
      padding: "0",
      background: RETRO.bg,
      border: "3px solid " + RETRO.border,
      boxShadow: "4px 4px 0px " + RETRO.border,
      fontFamily: RETRO.font,
      fontSize: "16px",
      color: RETRO.text,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      imageRendering: "pixelated",
      opacity: "0",
      transform: "scale(0.95)",
      transition: "opacity 0.15s, transform 0.15s",
    });

    // Title bar — retro window style
    const header = document.createElement("div");
    Object.assign(header.style, {
      padding: "6px 10px",
      background: RETRO.accent,
      color: RETRO.bgLight,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexShrink: "0",
      borderBottom: "2px solid " + RETRO.border,
      cursor: "grab",
      userSelect: "none",
    });

    // Window decorations (retro squares)
    const decoLeft = document.createElement("span");
    decoLeft.textContent = "□■□";
    Object.assign(decoLeft.style, {
      fontSize: "10px",
      letterSpacing: "2px",
      opacity: "0.6",
    });

    const titleEl = document.createElement("span");
    titleEl.textContent = "═ " + title + " ═";
    Object.assign(titleEl.style, {
      fontSize: "16px",
      fontWeight: "normal",
      fontFamily: RETRO.font,
      letterSpacing: "1px",
      flex: "1",
      textAlign: "center",
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.title = "Close";
    Object.assign(closeBtn.style, {
      background: RETRO.bgLight,
      border: "1px solid " + RETRO.border,
      color: RETRO.text,
      fontSize: "14px",
      cursor: "pointer",
      padding: "0px 6px",
      fontFamily: RETRO.font,
      lineHeight: "1.2",
      boxShadow: "1px 1px 0px " + RETRO.border,
    });
    closeBtn.addEventListener("mousedown", function (e) {
      e.stopPropagation();
      closeBtn.style.boxShadow = "none";
      closeBtn.style.transform = "translate(1px, 1px)";
    });
    closeBtn.addEventListener("mouseup", function (e) {
      e.stopPropagation();
      closeBtn.style.boxShadow = "1px 1px 0px " + RETRO.border;
      closeBtn.style.transform = "none";
    });
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      closePanel();
    });

    header.appendChild(decoLeft);
    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Draggable header
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    header.addEventListener("mousedown", function (e) {
      if (e.target === closeBtn) return;
      isDragging = true;
      header.style.cursor = "grabbing";
      const rect = panel.getBoundingClientRect();
      panel.style.left = rect.left + "px";
      panel.style.top = rect.top + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;
      e.preventDefault();
    });

    document.addEventListener("mousemove", function (e) {
      if (!isDragging) return;
      let newLeft = initialLeft + (e.clientX - dragStartX);
      let newTop = initialTop + (e.clientY - dragStartY);
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panel.offsetWidth));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - panel.offsetHeight));
      panel.style.left = newLeft + "px";
      panel.style.top = newTop + "px";
    });

    document.addEventListener("mouseup", function () {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = "grab";
      }
    });

    // Position near pet on page
    const pet = Pet.state.pet;
    if (pet) {
      const petRect = pet.getBoundingClientRect();
      let panelX = petRect.left - 360;
      let panelY = petRect.top + petRect.height / 2 - 240;
      if (panelX < 8) panelX = petRect.right + 20;
      panelY = Math.max(8, Math.min(panelY, window.innerHeight - 490));
      panelX = Math.max(8, Math.min(panelX, window.innerWidth - 360));
      panel.style.left = panelX + "px";
      panel.style.top = panelY + "px";
    } else {
      panel.style.right = "20px";
      panel.style.bottom = "20px";
    }

    document.body.appendChild(panel);
    Pet.state.activePanel = panel;

    // Animate in
    void panel.offsetHeight;
    panel.style.opacity = "1";
    panel.style.transform = "scale(1)";

    return panel;
  }

  function closePanel() {
    if (!Pet.state.activePanel) return;
    const p = Pet.state.activePanel;
    Pet.state.activePanel = null;
    p.style.opacity = "0";
    p.style.transform = "scale(0.95)";
    setTimeout(function () {
      if (p.parentNode) p.parentNode.removeChild(p);
    }, 120);
  }

  // Export to Pet.ui and Pet
  Pet.ui = {
    injectPixelFont: injectPixelFont,
    retroBox: retroBox,
    retroButton: retroButton,
    retroInput: retroInput,
    retroTextarea: retroTextarea,
    createPanel: createPanel,
    closePanel: closePanel,
  };

  // Direct shortcuts
  Pet.injectPixelFont = injectPixelFont;
  Pet.retroBox = retroBox;
  Pet.retroButton = retroButton;
  Pet.retroInput = retroInput;
  Pet.retroTextarea = retroTextarea;
  Pet.createPanel = createPanel;
  Pet.closePanel = closePanel;

})(window.BrowserPet);
