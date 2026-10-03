// ============================================================
// Browser Pet — Pet Engine, Animation, Dragging & Lifecycle
// ============================================================

window.BrowserPet = window.BrowserPet || {};

(function (Pet) {
  "use strict";

  const RETRO = Pet.RETRO;
  const state = Pet.state;

  // ============================================================
  // SPRITE URL HELPERS
  // ============================================================

  function getSpriteURL(action, direction) {
    const folder = action.toUpperCase();
    const file = action.toLowerCase() + "_" + direction + ".png";
    return chrome.runtime.getURL("assets/Sprites/" + folder + "/" + file);
  }

  function getAttackSpriteURL(num, direction) {
    const folder = "ATTACK_" + num;
    const file = "attack" + num + "_" + direction + ".png";
    return chrome.runtime.getURL("assets/Sprites/" + folder + "/" + file);
  }

  // ============================================================
  // ANIMATION CORE
  // ============================================================

  function showFrame(frameIndex) {
    if (!state.pet) return;
    const offsetX = -(frameIndex * Pet.FRAME_WIDTH * state.currentScale);
    state.pet.style.backgroundPosition = offsetX + "px 0";
  }

  function setSpriteSheet(action, direction) {
    if (!state.pet) return;
    let url;
    if (action === "attack1" || action === "attack2") {
      url = getAttackSpriteURL(action.charAt(action.length - 1), direction);
    } else {
      url = getSpriteURL(action, direction);
    }
    state.pet.style.backgroundImage = 'url("' + url + '")';
    state.pet.style.backgroundSize =
      (Pet.FRAME_WIDTH * Pet.TOTAL_FRAMES * state.currentScale) + "px " +
      (Pet.FRAME_HEIGHT * state.currentScale) + "px";
    state.currentFrame = 0;
    showFrame(0);
  }

  function startAnimation(frameDuration) {
    stopAnimation();
    state.animationTimer = setInterval(function () {
      state.currentFrame = (state.currentFrame + 1) % Pet.TOTAL_FRAMES;
      showFrame(state.currentFrame);
    }, frameDuration);
  }

  function stopAnimation() {
    if (state.animationTimer !== null) {
      clearInterval(state.animationTimer);
      state.animationTimer = null;
    }
  }

  function setAnimation(action, direction) {
    if (state.isAttacking) return;
    if (action === state.currentAction && direction === state.currentDirection) return;
    state.currentAction = action;
    state.currentDirection = direction;
    setSpriteSheet(action, direction);
    startAnimation(action === "run" ? Pet.RUN_FRAME_DURATION : Pet.IDLE_FRAME_DURATION);
  }

  function getDirection(mouseX, mouseY) {
    const dx = mouseX - state.prevMouseX;
    const dy = mouseY - state.prevMouseY;
    if (Math.abs(dx) < Pet.DIR_THRESHOLD && Math.abs(dy) < Pet.DIR_THRESHOLD) {
      return state.currentDirection;
    }
    return Math.abs(dx) >= Math.abs(dy)
      ? (dx > 0 ? "right" : "left")
      : (dy > 0 ? "down" : "up");
  }

  function applyScale() {
    if (!state.pet) return;
    const w = Pet.FRAME_WIDTH * state.currentScale;
    const h = Pet.FRAME_HEIGHT * state.currentScale;
    state.pet.style.width = w + "px";
    state.pet.style.height = h + "px";
    state.pet.style.backgroundSize =
      (Pet.FRAME_WIDTH * Pet.TOTAL_FRAMES * state.currentScale) + "px " +
      (Pet.FRAME_HEIGHT * state.currentScale) + "px";
    showFrame(state.currentFrame);
  }

  // ============================================================
  // ATTACK ACTION
  // ============================================================

  function doAttack(attackNum) {
    if (state.isAttacking || !state.pet) return;
    state.isAttacking = true;

    const num = (attackNum === 2) ? 2 : 1;
    const action = "attack" + num;

    // Stop idle animation and load attack sprite
    stopAnimation();
    state.currentAction = action;
    setSpriteSheet(action, state.currentDirection);

    // Show first frame immediately
    showFrame(0);

    let frame = 0;
    state.attackTimer = setInterval(function () {
      frame++;
      if (frame >= Pet.TOTAL_FRAMES) {
        clearInterval(state.attackTimer);
        state.attackTimer = null;
        state.isAttacking = false;
        // Return to idle facing front ("down")
        state.currentAction = "idle";
        state.currentDirection = "down";
        setSpriteSheet("idle", "down");
        startAnimation(Pet.IDLE_FRAME_DURATION);
        return;
      }
      showFrame(frame);
    }, Pet.ATTACK_FRAME_DURATION);
  }

  // ============================================================
  // CONTEXT MENU
  // ============================================================

  function createMenu() {
    state.menu = document.createElement("div");
    state.menu.id = "browser-pet-menu";

    Object.assign(state.menu.style, {
      position: "fixed",
      zIndex: "2147483646",
      display: "none",
      flexDirection: "column",
      padding: "3px",
      background: RETRO.bg,
      border: "3px solid " + RETRO.border,
      boxShadow: "3px 3px 0px " + RETRO.border,
      fontFamily: RETRO.font,
      fontSize: "16px",
      minWidth: "160px",
      imageRendering: "pixelated",
      opacity: "0",
      transform: "scale(0.95)",
      transition: "opacity 0.1s, transform 0.1s",
    });

    const menuTitle = document.createElement("div");
    Object.assign(menuTitle.style, {
      padding: "4px 8px",
      background: RETRO.accent,
      color: RETRO.bgLight,
      fontSize: "14px",
      textAlign: "center",
      letterSpacing: "1px",
      marginBottom: "3px",
      fontFamily: RETRO.font,
    });
    menuTitle.textContent = "═ Actions ═";
    state.menu.appendChild(menuTitle);

    const items = [
      { label: "Attack 1", icon: "►", action: function () { doAttack(1); } },
      { label: "Attack 2", icon: "►", action: function () { doAttack(2); } },
      { label: "✎ New Note", icon: "►", action: function () { Pet.doCreateNote(); } },
      { label: "☰ My Notes", icon: "►", action: function () { Pet.doMyNotes(); } },
      { label: "⚙ Settings", icon: "►", action: function () { Pet.doSettings(); } },
      { label: "× Hide Pet", icon: "►", action: hidePet, danger: true },
    ];

    items.forEach(function (item) {
      if (item.danger) {
        const sep = document.createElement("div");
        Object.assign(sep.style, {
          height: "2px",
          background: RETRO.border,
          margin: "2px 0",
        });
        state.menu.appendChild(sep);
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = item.label;

      Object.assign(btn.style, {
        display: "block",
        width: "100%",
        padding: "5px 10px",
        border: "none",
        background: "transparent",
        color: item.danger ? RETRO.danger : RETRO.text,
        fontSize: "16px",
        fontFamily: RETRO.font,
        textAlign: "left",
        cursor: "pointer",
        outline: "none",
        letterSpacing: "0.5px",
        transition: "none",
      });

      btn.addEventListener("mouseenter", function () {
        btn.style.background = item.danger ? RETRO.dangerBg : RETRO.accent;
        btn.style.color = item.danger ? "#fff" : RETRO.bgLight;
      });
      btn.addEventListener("mouseleave", function () {
        btn.style.background = "transparent";
        btn.style.color = item.danger ? RETRO.danger : RETRO.text;
      });

      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        closeMenu();
        item.action();
      });

      state.menu.appendChild(btn);
    });

    document.body.appendChild(state.menu);
  }

  function positionMenu() {
    if (!state.pet || !state.menu) return;
    const petRect = state.pet.getBoundingClientRect();
    let menuX = petRect.left + petRect.width / 2 - 80;
    let menuY = petRect.top - 10;

    state.menu.style.display = "flex";
    const menuRect = state.menu.getBoundingClientRect();
    state.menu.style.display = "none";

    menuY = petRect.top - menuRect.height - 8;
    if (menuY < 8) menuY = petRect.bottom + 8;
    menuX = Math.max(8, Math.min(menuX, window.innerWidth - menuRect.width - 8));

    state.menu.style.left = menuX + "px";
    state.menu.style.top = menuY + "px";
  }

  function openMenu() {
    if (!state.menu) createMenu();
    positionMenu();
    state.menu.style.display = "flex";
    void state.menu.offsetHeight;
    state.menu.style.opacity = "1";
    state.menu.style.transform = "scale(1)";
    state.menuOpen = true;
  }

  function closeMenu() {
    if (!state.menu || !state.menuOpen) return;
    state.menu.style.opacity = "0";
    state.menu.style.transform = "scale(0.95)";
    state.menuOpen = false;
    setTimeout(function () {
      if (!state.menuOpen && state.menu) state.menu.style.display = "none";
    }, 100);
  }

  function toggleMenu() {
    if (state.menuOpen) closeMenu();
    else openMenu();
  }

  // ============================================================
  // DRAG & MOUSE EVENTS
  // ============================================================

  function onPetMouseDown(e) {
    if (e.button !== 0) return;
    state.mouseDownX = e.clientX;
    state.mouseDownY = e.clientY;
    state.hasDragged = false;

    const rect = state.pet.getBoundingClientRect();
    state.dragOffsetX = e.clientX - rect.left;
    state.dragOffsetY = e.clientY - rect.top;

    state.pet.style.left = rect.left + "px";
    state.pet.style.top = rect.top + "px";
    state.pet.style.right = "auto";
    state.pet.style.bottom = "auto";

    state.prevMouseX = e.clientX;
    state.prevMouseY = e.clientY;
    state.isDragging = true;
    e.preventDefault();
  }

  function onDocMouseMove(e) {
    if (!state.isDragging || !state.pet) return;

    const distX = Math.abs(e.clientX - state.mouseDownX);
    const distY = Math.abs(e.clientY - state.mouseDownY);

    if (!state.hasDragged && (distX > Pet.DRAG_THRESHOLD || distY > Pet.DRAG_THRESHOLD)) {
      state.hasDragged = true;
      state.pet.style.cursor = "grabbing";
      closeMenu();
      setAnimation("run", state.currentDirection);
    }

    if (!state.hasDragged) return;

    let newX = e.clientX - state.dragOffsetX;
    let newY = e.clientY - state.dragOffsetY;
    const petW = Pet.FRAME_WIDTH * state.currentScale;
    const petH = Pet.FRAME_HEIGHT * state.currentScale;
    const maxX = window.innerWidth - petW;
    const maxY = window.innerHeight - petH;
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    state.pet.style.left = newX + "px";
    state.pet.style.top = newY + "px";

    const newDir = getDirection(e.clientX, e.clientY);
    setAnimation("run", newDir);

    state.prevMouseX = e.clientX;
    state.prevMouseY = e.clientY;
  }

  function onDocMouseUp(e) {
    if (!state.isDragging) return;
    state.isDragging = false;
    if (state.pet) state.pet.style.cursor = "grab";

    if (state.hasDragged) {
      setAnimation("idle", "down");
    } else {
      toggleMenu();
    }
  }

  function onDocClick(e) {
    if (!state.menuOpen) return;
    if (state.pet && state.pet.contains(e.target)) return;
    if (state.menu && state.menu.contains(e.target)) return;
    closeMenu();
  }

  function onDocMouseDownCapture(e) {
    if (!state.activePanel) return;
    if (state.activePanel.contains(e.target)) return;
    if (state.pet && state.pet.contains(e.target)) return;
    if (state.menu && state.menu.contains(e.target)) return;
    Pet.closePanel();
  }

  // ============================================================
  // LIFECYCLE (INIT & HIDE)
  // ============================================================

  function initPet() {
    if (state.pet) return;

    Pet.injectPixelFont();

    state.abortController = new AbortController();
    const signal = state.abortController.signal;

    // Create pet DOM element
    state.pet = document.createElement("div");
    state.pet.id = "browser-pet";

    const petW = Pet.FRAME_WIDTH * state.currentScale;
    const petH = Pet.FRAME_HEIGHT * state.currentScale;

    Object.assign(state.pet.style, {
      position: "fixed",
      bottom: Pet.MARGIN + "px",
      right: Pet.MARGIN + "px",
      zIndex: "2147483647",
      width: petW + "px",
      height: petH + "px",
      backgroundRepeat: "no-repeat",
      backgroundSize:
        (Pet.FRAME_WIDTH * Pet.TOTAL_FRAMES * state.currentScale) + "px " +
        (Pet.FRAME_HEIGHT * state.currentScale) + "px",
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

    document.body.appendChild(state.pet);

    // Reset state values
    state.currentAction = "idle";
    state.currentDirection = "down";
    state.currentFrame = 0;
    state.isAttacking = false;
    state.menuOpen = false;
    state.isDragging = false;
    state.menu = null;
    state.activePanel = null;

    // Load saved scale
    Pet.storage.getSavedScale(function (savedScale) {
      if (Pet.VALID_SCALES.includes(savedScale)) {
        state.currentScale = savedScale;
        if (state.pet) applyScale();
      }
    });

    // Start idle animation facing front
    setSpriteSheet("idle", "down");
    startAnimation(Pet.IDLE_FRAME_DURATION);

    // Listeners
    state.pet.addEventListener("mousedown", onPetMouseDown);
    document.addEventListener("mousemove", onDocMouseMove, { signal: signal });
    document.addEventListener("mouseup", onDocMouseUp, { signal: signal });
    document.addEventListener("click", onDocClick, { signal: signal });
    document.addEventListener("mousedown", onDocMouseDownCapture, { capture: true, signal: signal });
  }

  function hidePet() {
    stopAnimation();
    if (state.attackTimer) {
      clearInterval(state.attackTimer);
      state.attackTimer = null;
    }
    state.isAttacking = false;

    if (state.menu && state.menu.parentNode) state.menu.parentNode.removeChild(state.menu);
    if (state.activePanel && state.activePanel.parentNode) state.activePanel.parentNode.removeChild(state.activePanel);
    if (state.pet && state.pet.parentNode) state.pet.parentNode.removeChild(state.pet);

    if (state.abortController) {
      state.abortController.abort();
      state.abortController = null;
    }

    state.pet = null;
    state.menu = null;
    state.activePanel = null;
    state.animationTimer = null;
    state.menuOpen = false;
    state.isDragging = false;
  }

  // ============================================================
  // EXTENSION MESSAGING (Popup show/hide)
  // ============================================================

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.action === "getPetStatus") {
      sendResponse({ visible: !!state.pet });
    } else if (msg.action === "showPet") {
      initPet();
      sendResponse({ status: "shown", visible: true });
    } else if (msg.action === "hidePet") {
      hidePet();
      sendResponse({ status: "hidden", visible: false });
    }
  });

  // Export methods
  Pet.pet = {
    initPet: initPet,
    hidePet: hidePet,
    doAttack: doAttack,
    applyScale: applyScale,
    setAnimation: setAnimation,
    openMenu: openMenu,
    closeMenu: closeMenu,
    toggleMenu: toggleMenu,
  };
  Pet.initPet = initPet;
  Pet.hidePet = hidePet;
  Pet.applyScale = applyScale;

  // IMPORTANT:
  // We do NOT call initPet() here!
  // The pet stays dormant and invisible on page load/refresh.
  // It only appears when the user explicitly clicks "Show Pet" in the extension popup!

})(window.BrowserPet);
