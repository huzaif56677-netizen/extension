// ============================================================
// Browser Pet — Phase 1: Basic Pet (Appear + Drag)
// ============================================================
//
// KEY CONCEPTS USED IN THIS FILE:
//
// 1. document.createElement()
//    Creates a brand-new HTML element in memory. It doesn't appear
//    on the page until we append it to the DOM with appendChild().
//
// 2. DOM Manipulation
//    We build the pet entirely in JavaScript — no HTML file needed.
//    The content script runs inside the host webpage, so we inject
//    our own elements into the page's <body>.
//
// 3. position: fixed
//    Makes the pet stay in the same spot on screen even when the
//    user scrolls. The element is positioned relative to the
//    *viewport*, not the page document.
//
// 4. chrome.runtime.getURL()
//    Content scripts can't use relative paths to load extension
//    files. This API converts a path like "assets/Sprites/IDLE/..."
//    into a full chrome-extension://... URL the browser can load.
//
// 5. Mouse Events (mousedown → mousemove → mouseup)
//    - mousedown: fires when the user presses a mouse button.
//      We record the initial offset between the mouse cursor and
//      the pet's top-left corner.
//    - mousemove: fires continuously while the mouse moves.
//      We reposition the pet based on the cursor minus the offset.
//    - mouseup: fires when the button is released.
//      We stop dragging.
//
// 6. Calculating Mouse Offsets
//    When the user clicks the pet, the cursor is usually NOT at
//    the pet's top-left corner. We calculate:
//      offsetX = e.clientX - pet.getBoundingClientRect().left
//      offsetY = e.clientY - pet.getBoundingClientRect().top
//    Then during mousemove we set:
//      pet.style.left = (e.clientX - offsetX) + "px"
//      pet.style.top  = (e.clientY - offsetY) + "px"
//    This makes the pet follow the mouse smoothly without jumping.
//
// 7. Viewport Clamping
//    We clamp the pet's position so it can't be dragged outside
//    the visible browser window:
//      x is clamped to [0, window.innerWidth  - petWidth]
//      y is clamped to [0, window.innerHeight - petHeight]
//
// ============================================================

(function () {
  "use strict";

  // ----------------------------------------------------------
  // CONFIGURATION
  // ----------------------------------------------------------

  // Each sprite sheet is 768 × 80 with 8 frames.
  // So one frame = 96 × 80 pixels.
  const FRAME_WIDTH = 96;
  const FRAME_HEIGHT = 80;

  // How large the pet appears on screen (scaled up 2×
  // because 96px pixel-art looks tiny on modern displays).
  const SCALE = 2;
  const PET_DISPLAY_WIDTH = FRAME_WIDTH * SCALE;   // 192
  const PET_DISPLAY_HEIGHT = FRAME_HEIGHT * SCALE;  // 160

  // Default position — bottom-right of viewport with a small margin
  const MARGIN = 20;

  // ----------------------------------------------------------
  // BUILD THE PET ELEMENT
  // ----------------------------------------------------------

  // We use a <div> as a "viewport" that shows one frame of the
  // sprite sheet at a time. The sprite sheet is set as a
  // background-image, and we shift its background-position to
  // reveal different frames. This avoids <canvas> entirely.

  const pet = document.createElement("div");
  pet.id = "browser-pet";

  // Build the URL to the idle-right sprite sheet.
  // chrome.runtime.getURL() turns a relative extension path
  // into a full chrome-extension://... URL.
  const idleSpriteURL = chrome.runtime.getURL(
    "assets/Sprites/IDLE/idle_right.png"
  );

  // ----------------------------------------------------------
  // APPLY STYLES VIA JAVASCRIPT
  // ----------------------------------------------------------
  // Instead of a CSS file, we set every style property directly.

  Object.assign(pet.style, {
    // --- Positioning ---
    position: "fixed",                          // stays in viewport
    bottom: MARGIN + "px",
    right: MARGIN + "px",
    zIndex: "2147483647",                       // max 32-bit int — above everything

    // --- Dimensions ---
    width: PET_DISPLAY_WIDTH + "px",
    height: PET_DISPLAY_HEIGHT + "px",

    // --- Sprite sheet as background ---
    backgroundImage: `url("${idleSpriteURL}")`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${FRAME_WIDTH * 8 * SCALE}px ${FRAME_HEIGHT * SCALE}px`,
    backgroundPosition: "0 0",                  // show frame 0

    // --- Pixel-art rendering (no blur when scaled) ---
    imageRendering: "pixelated",

    // --- UX ---
    cursor: "grab",
    userSelect: "none",

    // --- Make sure it doesn't affect page layout ---
    pointerEvents: "auto",
    overflow: "hidden",
    border: "none",
    padding: "0",
    margin: "0",
    background_color: "transparent",
  });

  // Append the pet to the page.
  document.body.appendChild(pet);

  // ----------------------------------------------------------
  // DRAGGING LOGIC
  // ----------------------------------------------------------

  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  /**
   * mousedown — start dragging.
   *
   * We record the offset between the cursor and the pet's
   * top-left corner so the pet doesn't "jump" to the cursor.
   */
  pet.addEventListener("mousedown", function (e) {
    // Only respond to left-click (button 0).
    if (e.button !== 0) return;

    isDragging = true;
    pet.style.cursor = "grabbing";

    // getBoundingClientRect() gives the pet's position relative
    // to the viewport — exactly what we need for position:fixed.
    const rect = pet.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    // Once dragging starts we switch from bottom/right to
    // explicit top/left so we can set exact pixel coordinates.
    pet.style.left = rect.left + "px";
    pet.style.top = rect.top + "px";
    pet.style.right = "auto";
    pet.style.bottom = "auto";

    // Prevent the browser from starting a text-selection or
    // image drag while we're moving the pet.
    e.preventDefault();
  });

  /**
   * mousemove — reposition the pet while dragging.
   *
   * We listen on `document` (not the pet) so the drag continues
   * even if the cursor briefly leaves the pet element.
   */
  document.addEventListener("mousemove", function (e) {
    if (!isDragging) return;

    // Raw desired position
    let newX = e.clientX - dragOffsetX;
    let newY = e.clientY - dragOffsetY;

    // Clamp to viewport so the pet can't be dragged off-screen.
    const maxX = window.innerWidth - PET_DISPLAY_WIDTH;
    const maxY = window.innerHeight - PET_DISPLAY_HEIGHT;
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));

    pet.style.left = newX + "px";
    pet.style.top = newY + "px";
  });

  /**
   * mouseup — stop dragging.
   *
   * Also on `document` so we catch the release even if the
   * cursor is outside the pet.
   */
  document.addEventListener("mouseup", function (e) {
    if (!isDragging) return;
    isDragging = false;
    pet.style.cursor = "grab";
  });

  // ----------------------------------------------------------
  // That's it for Phase 1!
  //
  // At this point the pet:
  //  ✓ Appears on every webpage
  //  ✓ Shows the first frame of the idle sprite
  //  ✓ Stays fixed in the viewport (doesn't scroll away)
  //  ✓ Sits above all page content (z-index max)
  //  ✓ Can be dragged with the mouse
  //  ✓ Stays inside the visible viewport while dragging
  //  ✓ Doesn't interfere with the page layout
  // ----------------------------------------------------------
})();
