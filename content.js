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
  // DRAGGING LOGIC (updated for Phase 2)
  // ----------------------------------------------------------

  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  pet.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;

    isDragging = true;
    pet.style.cursor = "grabbing";

    const rect = pet.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    pet.style.left = rect.left + "px";
    pet.style.top = rect.top + "px";
    pet.style.right = "auto";
    pet.style.bottom = "auto";

    // Record initial mouse position for direction detection
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;

    // Switch to RUN animation
    setAnimation("run", currentDirection);

    e.preventDefault();
  });

  document.addEventListener("mousemove", function (e) {
    if (!isDragging) return;

    let newX = e.clientX - dragOffsetX;
    let newY = e.clientY - dragOffsetY;

    const maxX = window.innerWidth - PET_DISPLAY_WIDTH;
    const maxY = window.innerHeight - PET_DISPLAY_HEIGHT;
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    pet.style.left = newX + "px";
    pet.style.top = newY + "px";

    // Determine which direction the pet should face
    const newDir = getDirection(e.clientX, e.clientY);
    setAnimation("run", newDir);

    // Update previous mouse position for next comparison
    prevMouseX = e.clientX;
    prevMouseY = e.clientY;
  });

  document.addEventListener("mouseup", function (e) {
    if (!isDragging) return;
    isDragging = false;
    pet.style.cursor = "grab";

    // Switch back to IDLE animation, keeping last direction
    setAnimation("idle", currentDirection);
  });

  // ----------------------------------------------------------
  // Phase 1 + Phase 2 complete!
  //
  // The pet now:
  //  ✓ Appears on every webpage (Phase 1)
  //  ✓ Stays fixed in the viewport (Phase 1)
  //  ✓ Sits above all page content (Phase 1)
  //  ✓ Can be dragged with the mouse (Phase 1)
  //  ✓ Stays inside the visible viewport (Phase 1)
  //  ✓ Plays IDLE animation when standing still (Phase 2)
  //  ✓ Plays RUN animation while being dragged (Phase 2)
  //  ✓ Faces the correct direction (Phase 2)
  //  ✓ Animation only runs when needed (Phase 2)
  //  ✓ Smooth, lightweight frame timing (Phase 2)
  // ----------------------------------------------------------
})();
