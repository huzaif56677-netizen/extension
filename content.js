// ============================================================
// Browser Pet — Phase 1 + Phase 2: Pet with Sprite Animation
// ============================================================
//
// PHASE 1 CONCEPTS (still used):
//   document.createElement(), DOM manipulation, position:fixed,
//   chrome.runtime.getURL(), mouse events, offset calculation,
//   viewport clamping.
//
// PHASE 2 — NEW CONCEPTS:
//
// 1. Sprite Sheet Animation
//    A sprite sheet is a single image containing multiple frames
//    laid out in a row. Our sheets are 768×80 with 8 frames,
//    so each frame is 96×80.
//
//    To animate, we change `background-position` over time:
//      Frame 0 → background-position: 0px 0
//      Frame 1 → background-position: -96px 0   (at 2× scale: -192px)
//      Frame 2 → background-position: -192px 0  (at 2× scale: -384px)
//      ...
//    The negative offset slides the sheet left, revealing the
//    next frame through the fixed-size "window" (the div).
//
// 2. setInterval / clearInterval
//    setInterval(fn, ms) calls `fn` every `ms` milliseconds.
//    We use it to advance sprite frames at a steady rate
//    (e.g. 150ms per frame ≈ 6.67 FPS — good for pixel art).
//    clearInterval() stops it. We only run the timer when
//    animation is needed → saves CPU when the pet is still.
//
// 3. Directional Sprites
//    The sprite pack has 4 directions: right, left, up, down.
//    We track the pet's facing direction and load the matching
//    sprite sheet (e.g. idle_left.png vs idle_right.png).
//    During dragging, we determine direction from the delta
//    between the current and previous mouse position.
//
// 4. Animation State Machine
//    The pet has an animation state:
//      "idle"  → plays idle_<direction>.png in a loop
//      "run"   → plays run_<direction>.png in a loop
//    Transitions:
//      idle → run   (when drag starts)
//      run  → idle  (when drag ends)
//    Only one animation timer runs at a time.
//
// ============================================================

(function () {
  "use strict";

  // ----------------------------------------------------------
  // CONFIGURATION
  // ----------------------------------------------------------

  const FRAME_WIDTH = 96;
  const FRAME_HEIGHT = 80;
  const TOTAL_FRAMES = 8;
  const SCALE = 2;
  const PET_DISPLAY_WIDTH = FRAME_WIDTH * SCALE;   // 192
  const PET_DISPLAY_HEIGHT = FRAME_HEIGHT * SCALE;  // 160
  const MARGIN = 20;

  // Animation speed: milliseconds per frame.
  // 150ms ≈ 6.67 FPS — a good speed for pixel-art animation.
  const IDLE_FRAME_DURATION = 150;
  const RUN_FRAME_DURATION = 100;  // Slightly faster for running

  // ----------------------------------------------------------
  // SPRITE URL HELPER
  // ----------------------------------------------------------
  // Builds the full chrome-extension:// URL for a sprite sheet.
  // Example: getSpriteURL("IDLE", "right") →
  //   chrome-extension://…/assets/Sprites/IDLE/idle_right.png

  function getSpriteURL(action, direction) {
    const folder = action.toUpperCase();
    const file = action.toLowerCase() + "_" + direction + ".png";
    return chrome.runtime.getURL("assets/Sprites/" + folder + "/" + file);
  }

  // Special handling for attack folders which have a space + number
  function getAttackSpriteURL(attackNum, direction) {
    const folder = "ATTACK " + attackNum;
    const file = "attack" + attackNum + "_" + direction + ".png";
    return chrome.runtime.getURL("assets/Sprites/" + folder + "/" + file);
  }

  // ----------------------------------------------------------
  // BUILD THE PET ELEMENT
  // ----------------------------------------------------------

  const pet = document.createElement("div");
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

  // ----------------------------------------------------------
  // ANIMATION STATE
  // ----------------------------------------------------------

  let currentAction = "idle";       // "idle" or "run"
  let currentDirection = "right";   // "right", "left", "up", "down"
  let currentFrame = 0;             // 0–7
  let animationTimer = null;        // setInterval ID

  /**
   * setSpriteSheet — load a new sprite sheet onto the pet.
   *
   * Changes the background-image to the correct sheet for the
   * given action + direction. Resets the frame to 0.
   */
  function setSpriteSheet(action, direction) {
    let url;
    if (action === "attack1" || action === "attack2") {
      const num = action.charAt(action.length - 1);
      url = getAttackSpriteURL(num, direction);
    } else {
      url = getSpriteURL(action, direction);
    }
    pet.style.backgroundImage = 'url("' + url + '")';
    currentFrame = 0;
    showFrame(0);
  }

  /**
   * showFrame — display a specific frame (0–7) of the current
   * sprite sheet by shifting background-position.
   *
   * Frame N is at horizontal offset -(N * frameWidth * scale)px.
   * The background slides left so the Nth frame is visible
   * through the div's fixed-size "window".
   */
  function showFrame(frameIndex) {
    const offsetX = -(frameIndex * FRAME_WIDTH * SCALE);
    pet.style.backgroundPosition = offsetX + "px 0";
  }

  /**
   * startAnimation — begin looping through frames.
   *
   * Uses setInterval to call advanceFrame at a steady rate.
   * We always clear any existing timer first to prevent
   * multiple timers from stacking up.
   */
  function startAnimation(frameDuration) {
    stopAnimation();
    animationTimer = setInterval(function () {
      currentFrame = (currentFrame + 1) % TOTAL_FRAMES;
      showFrame(currentFrame);
    }, frameDuration);
  }

  /**
   * stopAnimation — stop the frame-advance timer.
   *
   * Called when we switch animations or when we want the
   * pet to freeze (e.g. before switching sheets).
   */
  function stopAnimation() {
    if (animationTimer !== null) {
      clearInterval(animationTimer);
      animationTimer = null;
    }
  }

  /**
   * setAnimation — high-level function to switch the pet's
   * animation state (action + direction).
   *
   * Only changes the sprite sheet if something actually changed
   * (avoids unnecessary image loads and timer restarts).
   */
  function setAnimation(action, direction) {
    if (action === currentAction && direction === currentDirection) {
      return; // nothing changed
    }

    currentAction = action;
    currentDirection = direction;
    setSpriteSheet(action, direction);

    const duration = action === "run" ? RUN_FRAME_DURATION : IDLE_FRAME_DURATION;
    startAnimation(duration);
  }

  // ----------------------------------------------------------
  // INITIAL ANIMATION — start idle facing right
  // ----------------------------------------------------------

  setSpriteSheet("idle", "right");
  startAnimation(IDLE_FRAME_DURATION);

  // ----------------------------------------------------------
  // DIRECTION DETECTION
  // ----------------------------------------------------------
  // When the pet is being dragged, we determine direction from
  // the mouse movement delta. We track the previous mouse
  // position and compare it to the current one.
  //
  // We use a threshold to avoid flickering when the mouse
  // barely moves — small movements are ignored.

  let prevMouseX = 0;
  let prevMouseY = 0;
  const DIR_THRESHOLD = 3; // pixels of movement required

  /**
   * getDirection — determine facing direction from mouse delta.
   *
   * We compare the absolute horizontal vs vertical movement.
   * Whichever axis has more movement wins:
   *   |deltaX| > |deltaY| → left or right
   *   |deltaY| > |deltaX| → up or down
   *
   * Returns the current direction if movement is below threshold.
   */
  function getDirection(mouseX, mouseY) {
    const dx = mouseX - prevMouseX;
    const dy = mouseY - prevMouseY;

    // Ignore tiny movements to prevent flicker
    if (Math.abs(dx) < DIR_THRESHOLD && Math.abs(dy) < DIR_THRESHOLD) {
      return currentDirection;
    }

    // Horizontal movement dominates
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx > 0 ? "right" : "left";
    }
    // Vertical movement dominates
    return dy > 0 ? "down" : "up";
  }

  // ----------------------------------------------------------
  // DRAGGING LOGIC (updated for Phase 3 — click vs drag)
  // ----------------------------------------------------------
  //
  // PHASE 3 — NEW CONCEPTS:
  //
  // 1. Click vs Drag Detection
  //    A "click" and a "drag" both start with mousedown. We need
  //    to tell them apart. Our approach:
  //      - On mousedown, record the position but DON'T start
  //        dragging yet.
  //      - On mousemove, if the mouse has moved more than a small
  //        threshold (5px), THEN start dragging.
  //      - On mouseup, if we never started dragging, treat it
  //        as a click → toggle the menu.
  //
  // 2. Dynamic Menu Creation
  //    The menu is a <div> with child <button> elements, all
  //    created with document.createElement(). Styles are applied
  //    via JavaScript. The menu is positioned near the pet using
  //    getBoundingClientRect().
  //
  // 3. Closing on Outside Click
  //    We listen for clicks on the document. If the click target
  //    is NOT inside the pet or the menu, we close the menu.
  //    event.target + element.contains() are used for this check.
  //

  let isDragging = false;
  let hasDragged = false;    // true if mouse moved enough to be a drag
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let mouseDownX = 0;
  let mouseDownY = 0;
  const DRAG_THRESHOLD = 5; // px — movement below this = click

  pet.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;

    // Record where the mouse went down
    mouseDownX = e.clientX;
    mouseDownY = e.clientY;
    hasDragged = false;

    const rect = pet.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    // Convert to top/left positioning for dragging
    pet.style.left = rect.left + "px";
    pet.style.top = rect.top + "px";
    pet.style.right = "auto";
    pet.style.bottom = "auto";

    // Record for direction detection
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;

    isDragging = true;
    e.preventDefault();
  });

  document.addEventListener("mousemove", function (e) {
    if (!isDragging) return;

    // Check if mouse has moved enough to count as a drag
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
  });

  document.addEventListener("mouseup", function (e) {
    if (!isDragging) return;
    isDragging = false;
    pet.style.cursor = "grab";

    if (hasDragged) {
      // Was a drag — go back to idle
      setAnimation("idle", currentDirection);
    } else {
      // Was a click — toggle the menu
      toggleMenu();
    }
  });

  // ----------------------------------------------------------
  // PHASE 3 — PET INTERACTION MENU
  // ----------------------------------------------------------
  //
  // The menu is a floating panel that appears next to the pet
  // when clicked. It contains action buttons styled with a
  // glassmorphism aesthetic (semi-transparent background, blur,
  // rounded corners).

  let menu = null;       // DOM element, created lazily
  let menuOpen = false;

  /**
   * createMenu — build the menu DOM structure.
   *
   * We create it once and reuse it. The menu is a <div>
   * containing styled <button> elements.
   */
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

    // Menu items
    const items = [
      { label: "⚔️  Attack!", action: doAttack },
      { label: "📝  Create New Note", action: doCreateNote },
      { label: "📒  My Notes", action: doMyNotes },
      { label: "⚙️  Settings", action: doSettings },
    ];

    items.forEach(function (item) {
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

      btn.addEventListener("mouseenter", function () {
        btn.style.background = "rgba(255, 255, 255, 0.1)";
        btn.style.color = "#ffffff";
        btn.style.transform = "translateX(3px)";
      });
      btn.addEventListener("mouseleave", function () {
        btn.style.background = "transparent";
        btn.style.color = "#e0e0e0";
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

  /**
   * positionMenu — place the menu above or beside the pet,
   * keeping it within the viewport.
   */
  function positionMenu() {
    const petRect = pet.getBoundingClientRect();

    // Try to position above the pet, centered horizontally
    let menuX = petRect.left + petRect.width / 2 - 80;
    let menuY = petRect.top - 10; // 10px gap above pet

    // Show briefly to measure
    menu.style.display = "flex";
    const menuRect = menu.getBoundingClientRect();
    menu.style.display = "none";

    // Position above the pet
    menuY = petRect.top - menuRect.height - 10;

    // If above the pet goes off-screen, position below
    if (menuY < 8) {
      menuY = petRect.bottom + 10;
    }

    // Keep horizontally in viewport
    menuX = Math.max(8, Math.min(menuX, window.innerWidth - menuRect.width - 8));

    menu.style.left = menuX + "px";
    menu.style.top = menuY + "px";
  }

  /**
   * openMenu / closeMenu / toggleMenu — control menu visibility.
   *
   * We use a short delay with opacity + transform for a smooth
   * appear/disappear animation.
   */
  function openMenu() {
    if (!menu) createMenu();
    positionMenu();
    menu.style.display = "flex";

    // Force a reflow so the transition actually plays
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

    // Hide after transition completes
    setTimeout(function () {
      if (!menuOpen && menu) {
        menu.style.display = "none";
      }
    }, 150);
  }

  function toggleMenu() {
    if (menuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  // Close the menu when clicking anywhere outside pet + menu
  document.addEventListener("click", function (e) {
    if (!menuOpen) return;
    if (pet.contains(e.target)) return;
    if (menu && menu.contains(e.target)) return;
    closeMenu();
  });

  // ----------------------------------------------------------
  // PHASE 3.5 — SWORD SWING (Attack Animation)
  // ----------------------------------------------------------
  //
  // Plays the ATTACK 1 sprite sheet once (8 frames), then
  // returns to idle. We use a one-shot animation approach:
  // setInterval runs but after exactly TOTAL_FRAMES we stop
  // and switch back to idle.

  let isAttacking = false;

  function doAttack() {
    if (isAttacking) return;
    isAttacking = true;

    // Stop current animation and load attack sheet
    stopAnimation();
    currentAction = "attack1";
    setSpriteSheet("attack1", currentDirection);

    let frame = 0;
    const attackTimer = setInterval(function () {
      frame++;
      if (frame >= TOTAL_FRAMES) {
        // Attack animation complete — return to idle
        clearInterval(attackTimer);
        isAttacking = false;
        currentAction = "idle";
        setSpriteSheet("idle", currentDirection);
        startAnimation(IDLE_FRAME_DURATION);
        return;
      }
      showFrame(frame);
    }, 100); // 100ms per frame — fast and snappy
  }

  // ----------------------------------------------------------
  // PHASE 3 — MENU ACTION STUBS (Phase 4 will implement these)
  // ----------------------------------------------------------

  function doCreateNote() {
    // Will be implemented in Phase 4
    console.log("[Browser Pet] Create New Note — coming in Phase 4");
  }

  function doMyNotes() {
    // Will be implemented in Phase 4
    console.log("[Browser Pet] My Notes — coming in Phase 4");
  }

  function doSettings() {
    // Will be implemented in Phase 4
    console.log("[Browser Pet] Settings — coming soon");
  }

  // ----------------------------------------------------------
  // All phases so far:
  //
  //  ✓ Pet appears on every webpage (Phase 1)
  //  ✓ Stays fixed in the viewport (Phase 1)
  //  ✓ Sits above all page content (Phase 1)
  //  ✓ Can be dragged with the mouse (Phase 1)
  //  ✓ Stays inside the visible viewport (Phase 1)
  //  ✓ Plays IDLE animation when standing still (Phase 2)
  //  ✓ Plays RUN animation while being dragged (Phase 2)
  //  ✓ Faces the correct direction (Phase 2)
  //  ✓ Click opens interaction menu (Phase 3)
  //  ✓ Menu closes on outside click (Phase 3)
  //  ✓ ⚔️ Attack swings sword (Phase 3.5)
  //  ✓ Click vs drag properly distinguished (Phase 3)
  // ----------------------------------------------------------
})();

