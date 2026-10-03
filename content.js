// ============================================================
// Browser Pet — Complete Extension
// ============================================================
// Features:
//   ✓ Animated 2D pet with directional sprites (idle, run, attack)
//   ✓ Draggable with viewport clamping
//   ✓ Click menu with actions
//   ✓ Notes system with chrome.storage.local + direct PDF export
//   ✓ Hide/Show pet (zero CPU when hidden)
//   ✓ Faces front ("down") when idle
//
// Architecture:
//   initPet()  — creates the pet, DOM elements, event listeners
//   hidePet()  — destroys everything, aborts listeners, zero CPU
//   AbortController — used to cleanly remove document-level
//                     event listeners when hiding the pet
//   chrome.runtime.onMessage — listens for show/hide from popup
// ============================================================

(function () {
  "use strict";

  // ============================================================
  // CONSTANTS
  // ============================================================

  const FRAME_WIDTH = 96;
  const FRAME_HEIGHT = 80;
  const TOTAL_FRAMES = 8;
  const SCALE = 2;
  const PET_DISPLAY_WIDTH = FRAME_WIDTH * SCALE;   // 192
  const PET_DISPLAY_HEIGHT = FRAME_HEIGHT * SCALE;  // 160
  const MARGIN = 20;

  const IDLE_FRAME_DURATION = 150;  // ms per frame (~6.7 FPS)
  const RUN_FRAME_DURATION = 100;
  const ATTACK_FRAME_DURATION = 100;

  const DRAG_THRESHOLD = 5;  // px — less = click, more = drag
  const DIR_THRESHOLD = 3;   // px — minimum movement to change direction

  // ============================================================
  // MUTABLE STATE
  // ============================================================

  let pet = null;
  let menu = null;
  let activePanel = null;
  let animationTimer = null;
  let attackTimer = null;
  let isAttacking = false;
  let currentAction = "idle";
  let currentDirection = "down";  // Start facing front
  let currentFrame = 0;
  let menuOpen = false;
  let isDragging = false;
  let hasDragged = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let mouseDownX = 0;
  let mouseDownY = 0;
  let prevMouseX = 0;
  let prevMouseY = 0;
  let abortController = null;

  // ============================================================
  // SPRITE URL HELPERS
  // ============================================================

  function getSpriteURL(action, direction) {
    const folder = action.toUpperCase();
    const file = action.toLowerCase() + "_" + direction + ".png";
    return chrome.runtime.getURL("assets/Sprites/" + folder + "/" + file);
  }

  function getAttackSpriteURL(num, direction) {
    const folder = "ATTACK " + num;
    const file = "attack" + num + "_" + direction + ".png";
    return chrome.runtime.getURL("assets/Sprites/" + folder + "/" + file);
  }

  // ============================================================
  // ANIMATION CORE
  // ============================================================

  function showFrame(frameIndex) {
    if (!pet) return;
    const offsetX = -(frameIndex * FRAME_WIDTH * SCALE);
    pet.style.backgroundPosition = offsetX + "px 0";
  }

  function setSpriteSheet(action, direction) {
    if (!pet) return;
    let url;
    if (action === "attack1" || action === "attack2") {
      url = getAttackSpriteURL(action.charAt(action.length - 1), direction);
    } else {
      url = getSpriteURL(action, direction);
    }
    pet.style.backgroundImage = 'url("' + url + '")';
    currentFrame = 0;
    showFrame(0);
  }

  function startAnimation(frameDuration) {
    stopAnimation();
    animationTimer = setInterval(function () {
      currentFrame = (currentFrame + 1) % TOTAL_FRAMES;
      showFrame(currentFrame);
    }, frameDuration);
  }

  function stopAnimation() {
    if (animationTimer !== null) {
      clearInterval(animationTimer);
      animationTimer = null;
    }
  }

  /**
   * setAnimation — switch the pet's animation.
   * NEVER interrupts an ongoing attack animation.
   */
  function setAnimation(action, direction) {
    if (isAttacking) return;
    if (action === currentAction && direction === currentDirection) return;
    currentAction = action;
    currentDirection = direction;
    setSpriteSheet(action, direction);
    startAnimation(action === "run" ? RUN_FRAME_DURATION : IDLE_FRAME_DURATION);
  }

  function getDirection(mouseX, mouseY) {
    const dx = mouseX - prevMouseX;
    const dy = mouseY - prevMouseY;
    if (Math.abs(dx) < DIR_THRESHOLD && Math.abs(dy) < DIR_THRESHOLD) {
      return currentDirection;
    }
    return Math.abs(dx) >= Math.abs(dy)
      ? (dx > 0 ? "right" : "left")
      : (dy > 0 ? "down" : "up");
  }

  // ============================================================
  // PDF GENERATOR — raw PDF, no libraries, one-click download
  // ============================================================
  //
  // Builds a valid PDF file from scratch using PDF operators:
  //   BT/ET  — Begin/End text block
  //   Tf     — Set font and size
  //   Td     — Move text cursor (relative)
  //   Tj     — Draw text string
  //   rg     — Set fill color (RGB 0-1)
  //
  // Uses Helvetica (built into every PDF reader, no embedding).
  // Text is word-wrapped at ~82 characters per line.
  //
  // The generated PDF has:
  //   - Catalog → Pages → Page → Content Stream + Fonts
  //   - Cross-reference table (xref) with byte offsets
  //   - Trailer pointing to the root catalog
  //

  function generatePDFBlob(title, content) {
    // Escape special characters for PDF strings
    function esc(s) {
      return s
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")
        .replace(/[^\x20-\x7E]/g, ""); // Strip non-ASCII for safety
    }

    // Word-wrap text into lines of maxChars length
    function wordWrap(text, maxChars) {
      const result = [];
      const paragraphs = text.split("\n");
      for (let p = 0; p < paragraphs.length; p++) {
        let para = paragraphs[p];
        if (para.length === 0) { result.push(""); continue; }
        while (para.length > 0) {
          if (para.length <= maxChars) { result.push(para); break; }
          let breakAt = para.lastIndexOf(" ", maxChars);
          if (breakAt < maxChars * 0.4) breakAt = maxChars;
          result.push(para.substring(0, breakAt));
          para = para.substring(breakAt).replace(/^ /, "");
        }
      }
      return result;
    }

    const titleStr = esc(title);
    const dateStr = esc("Created: " + new Date().toLocaleString());
    const lines = wordWrap(content, 82);
    const lineHeight = 15;

    // Calculate page height based on content
    const neededHeight = 100 + 22 + 26 + (lines.length * lineHeight) + 60;
    const pageHeight = Math.max(792, neededHeight);
    const startY = pageHeight - 52;

    // Build text drawing commands (content stream)
    let s = "BT\n";
    // Title
    s += "/F1 20 Tf\n";
    s += "72 " + startY + " Td\n";
    s += "(" + titleStr + ") Tj\n";
    // Date (gray, italic)
    s += "/F2 10 Tf\n";
    s += "0.45 0.45 0.45 rg\n";
    s += "0 -22 Td\n";
    s += "(" + dateStr + ") Tj\n";
    // Body
    s += "0 0 0 rg\n";
    s += "/F1 11 Tf\n";
    s += "0 -26 Td\n";

    for (let i = 0; i < lines.length; i++) {
      s += "0 -" + lineHeight + " Td\n";
      s += "(" + esc(lines[i] || " ") + ") Tj\n";
    }

    // Footer
    s += "/F2 8 Tf\n";
    s += "0.6 0.6 0.6 rg\n";
    s += "0 -30 Td\n";
    s += "(Exported from Browser Pet) Tj\n";
    s += "ET\n";

    // Build PDF objects
    const objs = [];
    objs[1] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
    objs[2] = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
    objs[3] = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 " + pageHeight + "] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n";
    objs[4] = "4 0 obj\n<< /Length " + s.length + " >>\nstream\n" + s + "endstream\nendobj\n";
    objs[5] = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";
    objs[6] = "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>\nendobj\n";

    // Assemble the PDF with cross-reference table
    let pdf = "%PDF-1.4\n";
    const offsets = [];

    for (let n = 1; n <= 6; n++) {
      offsets[n] = pdf.length;
      pdf += objs[n];
    }

    const xrefStart = pdf.length;
    pdf += "xref\n0 7\n";
    pdf += "0000000000 65535 f \n";
    for (let n = 1; n <= 6; n++) {
      pdf += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
    }
    pdf += "trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n" + xrefStart + "\n%%EOF";

    return new Blob([pdf], { type: "application/pdf" });
  }

  /**
   * exportNoteToPDF — one-click PDF download, no print dialog.
   */
  function exportNoteToPDF(title, content) {
    const blob = generatePDFBlob(title || "Untitled Note", content || "");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (title || "Untitled Note").replace(/[^a-zA-Z0-9 ]/g, "").trim() + ".pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // PANEL SYSTEM (floating UI panels near the pet)
  // ============================================================

  function createPanel(title) {
    closePanel();

    const panel = document.createElement("div");
    panel.className = "browser-pet-panel";

    Object.assign(panel.style, {
      position: "fixed",
      zIndex: "2147483646",
      width: "320px",
      maxHeight: "420px",
      padding: "0",
      borderRadius: "16px",
      background: "rgba(18, 18, 30, 0.92)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      boxShadow: "0 12px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.04)",
      fontFamily: "'Segoe UI', 'Inter', system-ui, sans-serif",
      fontSize: "13px",
      color: "#e0e0e0",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      opacity: "0",
      transform: "scale(0.95) translateY(8px)",
      transition: "opacity 0.2s ease, transform 0.2s ease",
    });

    // Header bar
    const header = document.createElement("div");
    Object.assign(header.style, {
      padding: "14px 16px",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexShrink: "0",
    });

    const titleEl = document.createElement("span");
    titleEl.textContent = title;
    Object.assign(titleEl.style, {
      fontSize: "14px",
      fontWeight: "600",
      color: "#ffffff",
      letterSpacing: "0.3px",
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "\u2715";
    Object.assign(closeBtn.style, {
      background: "none",
      border: "none",
      color: "#888",
      fontSize: "16px",
      cursor: "pointer",
      padding: "2px 6px",
      borderRadius: "4px",
      transition: "color 0.15s, background 0.15s",
      fontFamily: "inherit",
    });
    closeBtn.addEventListener("mouseenter", function () {
      closeBtn.style.color = "#fff";
      closeBtn.style.background = "rgba(255,255,255,0.1)";
    });
    closeBtn.addEventListener("mouseleave", function () {
      closeBtn.style.color = "#888";
      closeBtn.style.background = "none";
    });
    closeBtn.addEventListener("click", closePanel);

    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Position near pet
    if (pet) {
      const petRect = pet.getBoundingClientRect();
      let panelX = petRect.left - 340;
      let panelY = petRect.top + petRect.height / 2 - 200;
      if (panelX < 8) panelX = petRect.right + 20;
      panelY = Math.max(8, Math.min(panelY, window.innerHeight - 430));
      panelX = Math.max(8, Math.min(panelX, window.innerWidth - 330));
      panel.style.left = panelX + "px";
      panel.style.top = panelY + "px";
    }

    document.body.appendChild(panel);
    activePanel = panel;

    // Animate in
    void panel.offsetHeight;
    panel.style.opacity = "1";
    panel.style.transform = "scale(1) translateY(0)";

    return panel;
  }

  function closePanel() {
    if (!activePanel) return;
    const p = activePanel;
    activePanel = null;
    p.style.opacity = "0";
    p.style.transform = "scale(0.95) translateY(8px)";
    setTimeout(function () {
      if (p.parentNode) p.parentNode.removeChild(p);
    }, 200);
  }

  function createStyledButton(text, bgColor, textColor) {
    const btn = document.createElement("button");
    btn.textContent = text;
    Object.assign(btn.style, {
      padding: "9px 18px",
      border: "none",
      borderRadius: "8px",
      background: bgColor || "rgba(99, 102, 241, 0.8)",
      color: textColor || "#ffffff",
      fontSize: "13px",
      fontFamily: "inherit",
      cursor: "pointer",
      transition: "opacity 0.15s, transform 0.1s",
      outline: "none",
      fontWeight: "500",
    });
    btn.addEventListener("mouseenter", function () {
      btn.style.opacity = "0.85";
      btn.style.transform = "translateY(-1px)";
    });
    btn.addEventListener("mouseleave", function () {
      btn.style.opacity = "1";
      btn.style.transform = "translateY(0)";
    });
    return btn;
  }

  function createStyledInput(placeholder) {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = placeholder;
    Object.assign(input.style, {
      width: "100%",
      padding: "10px 12px",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "8px",
      background: "rgba(255,255,255,0.06)",
      color: "#e0e0e0",
      fontSize: "13px",
      fontFamily: "inherit",
      outline: "none",
      transition: "border-color 0.15s",
      boxSizing: "border-box",
    });
    input.addEventListener("focus", function () {
      input.style.borderColor = "rgba(99, 102, 241, 0.6)";
    });
    input.addEventListener("blur", function () {
      input.style.borderColor = "rgba(255,255,255,0.1)";
    });
    return input;
  }

  function createStyledTextarea(placeholder) {
    const textarea = document.createElement("textarea");
    textarea.placeholder = placeholder;
    Object.assign(textarea.style, {
      width: "100%",
      height: "120px",
      padding: "10px 12px",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "8px",
      background: "rgba(255,255,255,0.06)",
      color: "#e0e0e0",
      fontSize: "13px",
      fontFamily: "inherit",
      outline: "none",
      resize: "vertical",
      transition: "border-color 0.15s",
      boxSizing: "border-box",
      lineHeight: "1.5",
    });
    textarea.addEventListener("focus", function () {
      textarea.style.borderColor = "rgba(99, 102, 241, 0.6)";
    });
    textarea.addEventListener("blur", function () {
      textarea.style.borderColor = "rgba(255,255,255,0.1)";
    });
    return textarea;
  }

  // ============================================================
  // MENU (glassmorphism floating menu near the pet)
  // ============================================================

  function createMenu() {
    menu = document.createElement("div");
    menu.id = "browser-pet-menu";

    Object.assign(menu.style, {
      position: "fixed",
      zIndex: "2147483646",
      display: "none",
      flexDirection: "column",
      gap: "4px",
      padding: "8px",
      borderRadius: "12px",
      background: "rgba(20, 20, 35, 0.85)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      border: "1px solid rgba(255, 255, 255, 0.12)",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255,255,255,0.05)",
      fontFamily: "'Segoe UI', 'Inter', system-ui, sans-serif",
      fontSize: "13px",
      minWidth: "160px",
      transition: "opacity 0.15s ease, transform 0.15s ease",
      opacity: "0",
      transform: "scale(0.95) translateY(4px)",
    });

    const items = [
      { label: "\u2694\uFE0F  Attack!", action: doAttack },
      { label: "\uD83D\uDCDD  Create New Note", action: doCreateNote },
      { label: "\uD83D\uDCD2  My Notes", action: doMyNotes },
      { label: "\u2699\uFE0F  Settings", action: doSettings },
      { label: "\uD83D\uDC4B  Hide Pet", action: doHidePet },
    ];

    items.forEach(function (item, index) {
      const btn = document.createElement("button");
      btn.textContent = item.label;

      Object.assign(btn.style, {
        display: "block",
        width: "100%",
        padding: "10px 14px",
        border: "none",
        borderRadius: "8px",
        background: "transparent",
        color: "#e0e0e0",
        fontSize: "13px",
        fontFamily: "inherit",
        textAlign: "left",
        cursor: "pointer",
        transition: "background 0.15s ease, color 0.15s ease, transform 0.1s ease",
        outline: "none",
        letterSpacing: "0.3px",
      });

      // Separator line before "Hide Pet" (last item)
      if (index === items.length - 1) {
        const sep = document.createElement("div");
        Object.assign(sep.style, {
          height: "1px",
          background: "rgba(255,255,255,0.08)",
          margin: "4px 0",
        });
        menu.appendChild(sep);

        // Red tint for "Hide Pet"
        btn.style.color = "#f87171";
      }

      btn.addEventListener("mouseenter", function () {
        btn.style.background = "rgba(255, 255, 255, 0.1)";
        btn.style.color = index === items.length - 1 ? "#fca5a5" : "#ffffff";
        btn.style.transform = "translateX(3px)";
      });
      btn.addEventListener("mouseleave", function () {
        btn.style.background = "transparent";
        btn.style.color = index === items.length - 1 ? "#f87171" : "#e0e0e0";
        btn.style.transform = "translateX(0)";
      });

      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        closeMenu();
        item.action();
      });

      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
  }

  function positionMenu() {
    if (!pet || !menu) return;
    const petRect = pet.getBoundingClientRect();
    let menuX = petRect.left + petRect.width / 2 - 80;
    let menuY = petRect.top - 10;

    menu.style.display = "flex";
    const menuRect = menu.getBoundingClientRect();
    menu.style.display = "none";

    menuY = petRect.top - menuRect.height - 10;
    if (menuY < 8) menuY = petRect.bottom + 10;
    menuX = Math.max(8, Math.min(menuX, window.innerWidth - menuRect.width - 8));

    menu.style.left = menuX + "px";
    menu.style.top = menuY + "px";
  }

  function openMenu() {
    if (!menu) createMenu();
    positionMenu();
    menu.style.display = "flex";
    void menu.offsetHeight;
    menu.style.opacity = "1";
    menu.style.transform = "scale(1) translateY(0)";
    menuOpen = true;
  }

  function closeMenu() {
    if (!menu || !menuOpen) return;
    menu.style.opacity = "0";
    menu.style.transform = "scale(0.95) translateY(4px)";
    menuOpen = false;
    setTimeout(function () {
      if (!menuOpen && menu) menu.style.display = "none";
    }, 150);
  }

  function toggleMenu() {
    if (menuOpen) closeMenu();
    else openMenu();
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  // ---- ATTACK (sword swing) ----
  function doAttack() {
    if (isAttacking || !pet) return;
    isAttacking = true;

    // Stop idle animation and load attack sprite
    stopAnimation();
    currentAction = "attack1";
    setSpriteSheet("attack1", currentDirection);

    // Play through all 8 frames once, then return to idle
    let frame = 0;
    attackTimer = setInterval(function () {
      frame++;
      if (frame >= TOTAL_FRAMES) {
        clearInterval(attackTimer);
        attackTimer = null;
        isAttacking = false;
        // Return to idle facing front
        currentAction = "idle";
        currentDirection = "down";
        setSpriteSheet("idle", "down");
        startAnimation(IDLE_FRAME_DURATION);
        return;
      }
      showFrame(frame);
    }, ATTACK_FRAME_DURATION);
  }

  // ---- CREATE NOTE ----
  function doCreateNote() {
    const panel = createPanel("\uD83D\uDCDD Create New Note");

    const body = document.createElement("div");
    Object.assign(body.style, {
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    });

    // Warning banner
    const warning = document.createElement("div");
    Object.assign(warning.style, {
      padding: "10px 12px",
      borderRadius: "8px",
      background: "rgba(245, 158, 11, 0.12)",
      border: "1px solid rgba(245, 158, 11, 0.25)",
      color: "#f59e0b",
      fontSize: "12px",
      lineHeight: "1.4",
      display: "flex",
      alignItems: "flex-start",
      gap: "8px",
    });
    const warningIcon = document.createElement("span");
    warningIcon.textContent = "\u26A0\uFE0F";
    warningIcon.style.flexShrink = "0";
    const warningText = document.createElement("span");
    warningText.textContent = "Your note is not saved automatically. Click Save to keep it, or Export to download as PDF.";
    warning.appendChild(warningIcon);
    warning.appendChild(warningText);

    const titleInput = createStyledInput("Note title...");
    const contentArea = createStyledTextarea("Write your note here...");

    // Buttons
    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, {
      display: "flex",
      gap: "8px",
      justifyContent: "flex-end",
      flexWrap: "wrap",
    });

    const cancelBtn = createStyledButton("Cancel", "rgba(255,255,255,0.08)", "#aaa");
    cancelBtn.addEventListener("click", closePanel);

    const exportBtn = createStyledButton("\uD83D\uDCC4 Export PDF", "rgba(34, 197, 94, 0.25)", "#22c55e");
    exportBtn.addEventListener("click", function () {
      const t = titleInput.value.trim();
      const c = contentArea.value.trim();
      if (!t && !c) { titleInput.style.borderColor = "rgba(239,68,68,0.6)"; return; }
      exportNoteToPDF(t || "Untitled Note", c);
    });

    const saveBtn = createStyledButton("\uD83D\uDCBE Save", "rgba(99, 102, 241, 0.8)", "#fff");
    saveBtn.addEventListener("click", function () {
      const t = titleInput.value.trim();
      const c = contentArea.value.trim();
      if (!t && !c) { titleInput.style.borderColor = "rgba(239,68,68,0.6)"; return; }

      const note = {
        id: Date.now(),
        title: t || "Untitled Note",
        content: c,
        createdAt: new Date().toLocaleString(),
      };

      chrome.storage.local.get({ petNotes: [] }, function (result) {
        const notes = result.petNotes;
        notes.unshift(note);
        chrome.storage.local.set({ petNotes: notes }, function () {
          closePanel();
          if (pet) {
            pet.style.filter = "brightness(1.5)";
            setTimeout(function () { if (pet) pet.style.filter = ""; }, 300);
          }
        });
      });
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(exportBtn);
    btnRow.appendChild(saveBtn);

    body.appendChild(warning);
    body.appendChild(titleInput);
    body.appendChild(contentArea);
    body.appendChild(btnRow);
    panel.appendChild(body);

    setTimeout(function () { titleInput.focus(); }, 100);
  }

  // ---- MY NOTES ----
  function doMyNotes() {
    const panel = createPanel("\uD83D\uDCD2 My Notes");

    const body = document.createElement("div");
    Object.assign(body.style, {
      padding: "8px",
      overflowY: "auto",
      maxHeight: "350px",
      flexGrow: "1",
    });

    body.textContent = "Loading...";
    body.style.padding = "16px";
    body.style.color = "#888";
    panel.appendChild(body);

    chrome.storage.local.get({ petNotes: [] }, function (result) {
      const notes = result.petNotes;
      body.textContent = "";
      body.style.padding = "8px";
      body.style.color = "#e0e0e0";

      if (notes.length === 0) {
        const empty = document.createElement("div");
        Object.assign(empty.style, {
          textAlign: "center",
          padding: "32px 16px",
          color: "#666",
          fontSize: "13px",
        });
        empty.innerHTML = "\uD83D\uDCED<br><br>No notes yet.<br>Click <b>Create New Note</b> to get started!";
        body.appendChild(empty);
        return;
      }

      notes.forEach(function (note) {
        const card = document.createElement("div");
        Object.assign(card.style, {
          padding: "12px 14px",
          marginBottom: "6px",
          borderRadius: "10px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
          cursor: "default",
          transition: "background 0.15s",
        });
        card.addEventListener("mouseenter", function () {
          card.style.background = "rgba(255,255,255,0.08)";
        });
        card.addEventListener("mouseleave", function () {
          card.style.background = "rgba(255,255,255,0.04)";
        });

        // Header row: title + export + delete
        const cardHeader = document.createElement("div");
        Object.assign(cardHeader.style, {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "4px",
        });

        const titleEl = document.createElement("div");
        titleEl.textContent = note.title || "Untitled";
        Object.assign(titleEl.style, {
          fontWeight: "600",
          fontSize: "13px",
          color: "#fff",
          flex: "1",
          marginRight: "8px",
          wordBreak: "break-word",
        });

        // Export button
        const exportBtn = document.createElement("button");
        exportBtn.textContent = "\uD83D\uDCC4";
        exportBtn.title = "Export as PDF";
        Object.assign(exportBtn.style, {
          background: "none", border: "none", cursor: "pointer",
          fontSize: "14px", padding: "2px 4px", borderRadius: "4px",
          transition: "background 0.15s", flexShrink: "0", opacity: "0.5",
          marginRight: "2px",
        });
        exportBtn.addEventListener("mouseenter", function () {
          exportBtn.style.background = "rgba(34,197,94,0.2)";
          exportBtn.style.opacity = "1";
        });
        exportBtn.addEventListener("mouseleave", function () {
          exportBtn.style.background = "none";
          exportBtn.style.opacity = "0.5";
        });
        exportBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          exportNoteToPDF(note.title, note.content);
        });

        // Delete button
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "\uD83D\uDDD1";
        Object.assign(deleteBtn.style, {
          background: "none", border: "none", cursor: "pointer",
          fontSize: "14px", padding: "2px 4px", borderRadius: "4px",
          transition: "background 0.15s", flexShrink: "0", opacity: "0.5",
        });
        deleteBtn.addEventListener("mouseenter", function () {
          deleteBtn.style.background = "rgba(239,68,68,0.2)";
          deleteBtn.style.opacity = "1";
        });
        deleteBtn.addEventListener("mouseleave", function () {
          deleteBtn.style.background = "none";
          deleteBtn.style.opacity = "0.5";
        });
        deleteBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          deleteNote(note.id);
        });

        cardHeader.appendChild(titleEl);
        cardHeader.appendChild(exportBtn);
        cardHeader.appendChild(deleteBtn);
        card.appendChild(cardHeader);

        // Content preview
        if (note.content) {
          const contentEl = document.createElement("div");
          contentEl.textContent = note.content.length > 100
            ? note.content.substring(0, 100) + "..."
            : note.content;
          Object.assign(contentEl.style, {
            fontSize: "12px", color: "#999", lineHeight: "1.4",
            marginBottom: "6px", wordBreak: "break-word",
          });
          card.appendChild(contentEl);
        }

        // Date
        const dateEl = document.createElement("div");
        dateEl.textContent = note.createdAt || "";
        Object.assign(dateEl.style, { fontSize: "11px", color: "#555" });
        card.appendChild(dateEl);

        body.appendChild(card);
      });
    });
  }

  function deleteNote(noteId) {
    chrome.storage.local.get({ petNotes: [] }, function (result) {
      const notes = result.petNotes.filter(function (n) { return n.id !== noteId; });
      chrome.storage.local.set({ petNotes: notes }, function () {
        doMyNotes(); // Refresh
      });
    });
  }

  // ---- SETTINGS ----
  function doSettings() {
    const panel = createPanel("\u2699\uFE0F Settings");

    const body = document.createElement("div");
    Object.assign(body.style, {
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "16px",
    });

    // Pet Scale
    const scaleGroup = document.createElement("div");
    const scaleLabel = document.createElement("label");
    scaleLabel.textContent = "Pet Size";
    Object.assign(scaleLabel.style, {
      fontSize: "13px", fontWeight: "500", color: "#ccc",
      display: "block", marginBottom: "8px",
    });

    const scaleRow = document.createElement("div");
    Object.assign(scaleRow.style, { display: "flex", alignItems: "center", gap: "12px" });

    const scaleSlider = document.createElement("input");
    scaleSlider.type = "range";
    scaleSlider.min = "1"; scaleSlider.max = "4"; scaleSlider.step = "0.5";
    scaleSlider.value = String(SCALE);
    Object.assign(scaleSlider.style, { flex: "1", accentColor: "#6366f1", cursor: "pointer" });

    const scaleValue = document.createElement("span");
    scaleValue.textContent = SCALE + "\u00D7";
    Object.assign(scaleValue.style, { fontSize: "13px", color: "#aaa", minWidth: "30px" });

    scaleSlider.addEventListener("input", function () {
      const ns = parseFloat(scaleSlider.value);
      scaleValue.textContent = ns + "\u00D7";
      if (pet) {
        pet.style.width = (FRAME_WIDTH * ns) + "px";
        pet.style.height = (FRAME_HEIGHT * ns) + "px";
        pet.style.backgroundSize = (FRAME_WIDTH * TOTAL_FRAMES * ns) + "px " + (FRAME_HEIGHT * ns) + "px";
        const offsetX = -(currentFrame * FRAME_WIDTH * ns);
        pet.style.backgroundPosition = offsetX + "px 0";
      }
    });

    scaleRow.appendChild(scaleSlider);
    scaleRow.appendChild(scaleValue);
    scaleGroup.appendChild(scaleLabel);
    scaleGroup.appendChild(scaleRow);
    body.appendChild(scaleGroup);

    // Divider
    const divider = document.createElement("div");
    Object.assign(divider.style, { height: "1px", background: "rgba(255,255,255,0.06)" });
    body.appendChild(divider);

    // Danger zone
    const dangerGroup = document.createElement("div");
    const dangerLabel = document.createElement("label");
    dangerLabel.textContent = "Danger Zone";
    Object.assign(dangerLabel.style, {
      fontSize: "13px", fontWeight: "500", color: "#ef4444",
      display: "block", marginBottom: "8px",
    });

    const clearBtn = createStyledButton("\uD83D\uDDD1 Delete All Notes", "rgba(239,68,68,0.2)", "#ef4444");
    clearBtn.style.width = "100%";
    clearBtn.addEventListener("click", function () {
      if (clearBtn.dataset.confirm === "true") {
        chrome.storage.local.set({ petNotes: [] }, function () {
          clearBtn.textContent = "\u2713 All notes deleted";
          clearBtn.style.background = "rgba(34, 197, 94, 0.2)";
          clearBtn.style.color = "#22c55e";
          setTimeout(closePanel, 1000);
        });
      } else {
        clearBtn.dataset.confirm = "true";
        clearBtn.textContent = "\u26A0\uFE0F Click again to confirm";
        clearBtn.style.background = "rgba(239, 68, 68, 0.35)";
        setTimeout(function () {
          clearBtn.dataset.confirm = "false";
          clearBtn.textContent = "\uD83D\uDDD1 Delete All Notes";
          clearBtn.style.background = "rgba(239,68,68,0.2)";
          clearBtn.style.color = "#ef4444";
        }, 3000);
      }
    });

    dangerGroup.appendChild(dangerLabel);
    dangerGroup.appendChild(clearBtn);
    body.appendChild(dangerGroup);

    // Version
    const ver = document.createElement("div");
    ver.textContent = "Browser Pet v1.0.0";
    Object.assign(ver.style, { fontSize: "11px", color: "#444", textAlign: "center", marginTop: "4px" });
    body.appendChild(ver);

    panel.appendChild(body);
  }

  // ---- HIDE PET ----
  function doHidePet() {
    hidePet();
  }

  // ============================================================
  // EVENT HANDLERS (named functions for AbortController cleanup)
  // ============================================================
  //
  // AbortController lets us register event listeners with a
  // "signal". When we call controller.abort(), ALL listeners
  // attached with that signal are removed in one shot.
  //
  // Pet-element listeners are removed automatically when the
  // element is removed from the DOM and garbage collected.
  // Document-level listeners persist forever unless explicitly
  // removed — that's why we use AbortController for those.
  //

  function onPetMouseDown(e) {
    if (e.button !== 0) return;
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
    hasDragged = false;

    const rect = pet.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    pet.style.left = rect.left + "px";
    pet.style.top = rect.top + "px";
    pet.style.right = "auto";
    pet.style.bottom = "auto";

    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
    isDragging = true;
    e.preventDefault();
  }

  function onDocMouseMove(e) {
    if (!isDragging || !pet) return;

    const distX = Math.abs(e.clientX - mouseDownX);
    const distY = Math.abs(e.clientY - mouseDownY);

    if (!hasDragged && (distX > DRAG_THRESHOLD || distY > DRAG_THRESHOLD)) {
      hasDragged = true;
      pet.style.cursor = "grabbing";
      closeMenu();
      setAnimation("run", currentDirection);
    }

    if (!hasDragged) return;

    let newX = e.clientX - dragOffsetX;
    let newY = e.clientY - dragOffsetY;
    const maxX = window.innerWidth - PET_DISPLAY_WIDTH;
    const maxY = window.innerHeight - PET_DISPLAY_HEIGHT;
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    pet.style.left = newX + "px";
    pet.style.top = newY + "px";

    const newDir = getDirection(e.clientX, e.clientY);
    setAnimation("run", newDir);

    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
  }

  function onDocMouseUp(e) {
    if (!isDragging) return;
    isDragging = false;
    if (pet) pet.style.cursor = "grab";

    if (hasDragged) {
      // Face front when idle — "down" shows the character's face
      setAnimation("idle", "down");
    } else {
      toggleMenu();
    }
  }

  function onDocClick(e) {
    if (!menuOpen) return;
    if (pet && pet.contains(e.target)) return;
    if (menu && menu.contains(e.target)) return;
    closeMenu();
  }

  function onDocMouseDownCapture(e) {
    if (!activePanel) return;
    if (activePanel.contains(e.target)) return;
    if (pet && pet.contains(e.target)) return;
    if (menu && menu.contains(e.target)) return;
    closePanel();
  }

  // ============================================================
  // INIT PET — creates the pet and starts everything
  // ============================================================

  function initPet() {
    if (pet) return; // Already running

    abortController = new AbortController();
    const signal = abortController.signal;

    // Create the pet element
    pet = document.createElement("div");
    pet.id = "browser-pet";

    Object.assign(pet.style, {
      position: "fixed",
      bottom: MARGIN + "px",
      right: MARGIN + "px",
      zIndex: "2147483647",
      width: PET_DISPLAY_WIDTH + "px",
      height: PET_DISPLAY_HEIGHT + "px",
      backgroundRepeat: "no-repeat",
      backgroundSize: (FRAME_WIDTH * TOTAL_FRAMES * SCALE) + "px " + (FRAME_HEIGHT * SCALE) + "px",
      backgroundPosition: "0 0",
      imageRendering: "pixelated",
      cursor: "grab",
      userSelect: "none",
      pointerEvents: "auto",
      overflow: "hidden",
      border: "none",
      padding: "0",
      margin: "0",
    });

    document.body.appendChild(pet);

    // Reset state
    currentAction = "idle";
    currentDirection = "down";
    currentFrame = 0;
    isAttacking = false;
    menuOpen = false;
    isDragging = false;
    menu = null;
    activePanel = null;

    // Start idle animation facing front
    setSpriteSheet("idle", "down");
    startAnimation(IDLE_FRAME_DURATION);

    // Register event listeners
    pet.addEventListener("mousedown", onPetMouseDown);

    // Document-level listeners use the AbortController signal.
    // When hidePet() calls controller.abort(), these are ALL
    // removed instantly — zero overhead after hiding.
    document.addEventListener("mousemove", onDocMouseMove, { signal: signal });
    document.addEventListener("mouseup", onDocMouseUp, { signal: signal });
    document.addEventListener("click", onDocClick, { signal: signal });
    document.addEventListener("mousedown", onDocMouseDownCapture, { capture: true, signal: signal });
  }

  // ============================================================
  // HIDE PET — destroys everything, zero CPU when done
  // ============================================================
  //
  // After hidePet():
  //   - No DOM elements remain
  //   - No timers or intervals are running
  //   - No document event listeners are attached
  //   - The only thing alive is the chrome.runtime.onMessage
  //     listener (negligible — only fires on explicit popup click)
  //

  function hidePet() {
    // Stop all animations and timers
    stopAnimation();
    if (attackTimer) {
      clearInterval(attackTimer);
      attackTimer = null;
    }
    isAttacking = false;

    // Remove all DOM elements
    if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
    if (activePanel && activePanel.parentNode) activePanel.parentNode.removeChild(activePanel);
    if (pet && pet.parentNode) pet.parentNode.removeChild(pet);

    // Abort all document-level event listeners in one shot
    if (abortController) {
      abortController.abort();
      abortController = null;
    }

    // Clear all references
    pet = null;
    menu = null;
    activePanel = null;
    animationTimer = null;
    menuOpen = false;
    isDragging = false;
  }

  // ============================================================
  // MESSAGE LISTENER (always active — handles popup commands)
  // ============================================================
  //
  // chrome.runtime.onMessage receives messages from:
  //   - The extension popup (popup.js)
  //   - Background scripts (if any)
  //
  // This is the ONLY code that runs when the pet is hidden.
  // It costs zero CPU until a message is actually received.

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.action === "showPet") {
      initPet();
      sendResponse({ status: "shown" });
    } else if (msg.action === "hidePet") {
      hidePet();
      sendResponse({ status: "hidden" });
    } else if (msg.action === "getPetStatus") {
      sendResponse({ visible: !!pet });
    }
  });

  // ============================================================
  // AUTO-START — pet appears when the content script loads
  // ============================================================
  initPet();

})();
