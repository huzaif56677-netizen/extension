// ============================================================
// Browser Pet — Constants & Global State
// ============================================================

window.BrowserPet = window.BrowserPet || {};

(function (Pet) {
  "use strict";

  // Sprite & Frame Dimensions
  Pet.FRAME_WIDTH = 96;
  Pet.FRAME_HEIGHT = 80;
  Pet.TOTAL_FRAMES = 8;
  Pet.DEFAULT_SCALE = 2;
  Pet.VALID_SCALES = [1.5, 2, 2.5, 3];

  // Animation Timings (ms)
  Pet.IDLE_FRAME_DURATION = 150;  // ~6.7 FPS
  Pet.RUN_FRAME_DURATION = 100;
  Pet.ATTACK_FRAME_DURATION = 100;

  // Interaction Thresholds
  Pet.DRAG_THRESHOLD = 5;  // px — less = click, more = drag
  Pet.DIR_THRESHOLD = 3;   // px — minimum movement to change direction
  Pet.MARGIN = 20;

  // Font Configuration
  Pet.PIXEL_FONT_URL = "https://fonts.googleapis.com/css2?family=VT323&display=swap";

  // Retro Theme Palette
  Pet.RETRO = {
    bg: "#c0c0b0",
    bgDark: "#a8a898",
    bgLight: "#d8d8c8",
    text: "#1a1a1a",
    textMuted: "#4a4a3a",
    border: "#2a2a2a",
    borderLight: "#8a8a7a",
    accent: "#1a1a1a",
    accentHover: "#3a3a2a",
    danger: "#8a2a2a",
    dangerBg: "#c09090",
    success: "#2a6a2a",
    successBg: "#90c090",
    warning: "#6a5a1a",
    warningBg: "#c0b880",
    shadow: "2px 2px 0px #2a2a2a",
    shadowInset: "inset 1px 1px 0px #d8d8c8, inset -1px -1px 0px #8a8a7a",
    font: "'VT323', 'Courier New', monospace",
    borderW: "2px",
  };

  // Shared Mutable State
  Pet.state = {
    pet: null,
    menu: null,
    activePanel: null,
    animationTimer: null,
    attackTimer: null,
    isAttacking: false,
    currentAction: "idle",
    currentDirection: "down", // Start facing front
    currentFrame: 0,
    currentScale: Pet.DEFAULT_SCALE,
    menuOpen: false,
    isDragging: false,
    hasDragged: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    mouseDownX: 0,
    mouseDownY: 0,
    prevMouseX: 0,
    prevMouseY: 0,
    abortController: null,
  };

})(window.BrowserPet);
