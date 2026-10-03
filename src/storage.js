// ============================================================
// Browser Pet — Storage & Image Optimization
// ============================================================

window.BrowserPet = window.BrowserPet || {};

(function (Pet) {
  "use strict";

  const RETRO = Pet.RETRO;

  /**
   * Optimize image for storage while preserving high resolution.
   * Keeps up to 1600px width with 0.90 quality for crisp text & screenshots.
   */
  function compressImage(dataUrl, callback) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement("canvas");
      const maxW = 1600;
      let w = img.width;
      let h = img.height;
      if (w > maxW) {
        h = Math.round(h * (maxW / w));
        w = maxW;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL("image/jpeg", 0.90));
    };
    img.onerror = function () {
      callback(dataUrl); // fallback to original
    };
    img.src = dataUrl;
  }

  /**
   * Create an image preview element with an X button to remove it.
   */
  function createImagePreview(dataUrl, onRemove) {
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, {
      position: "relative",
      display: "inline-block",
      margin: "4px",
      border: RETRO.borderW + " solid " + RETRO.border,
      background: RETRO.bgLight,
      padding: "2px",
    });

    const img = document.createElement("img");
    img.src = dataUrl;
    Object.assign(img.style, {
      maxWidth: "120px",
      maxHeight: "90px",
      display: "block",
      imageRendering: "auto",
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    Object.assign(removeBtn.style, {
      position: "absolute",
      top: "-6px",
      right: "-6px",
      width: "18px",
      height: "18px",
      background: RETRO.danger,
      color: "#fff",
      border: "1px solid " + RETRO.border,
      fontSize: "12px",
      fontFamily: RETRO.font,
      cursor: "pointer",
      padding: "0",
      lineHeight: "16px",
      textAlign: "center",
      zIndex: "1",
    });
    removeBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (onRemove) onRemove();
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    });

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    return wrapper;
  }

  function getNotes(callback) {
    try {
      chrome.storage.local.get({ petNotes: [] }, function (result) {
        if (callback) callback(result.petNotes || []);
      });
    } catch (e) {
      if (callback) callback([]);
    }
  }

  function saveNote(note, callback) {
    getNotes(function (notes) {
      notes.unshift(note);
      try {
        chrome.storage.local.set({ petNotes: notes }, function () {
          if (callback) callback(notes);
        });
      } catch (e) {
        if (callback) callback(notes);
      }
    });
  }

  function updateNote(note, callback) {
    getNotes(function (notes) {
      const idx = notes.findIndex(function (n) { return String(n.id) === String(note.id); });
      if (idx >= 0) {
        notes[idx] = note;
      } else {
        notes.unshift(note);
      }
      try {
        chrome.storage.local.set({ petNotes: notes }, function () {
          if (callback) callback(notes);
        });
      } catch (e) {
        if (callback) callback(notes);
      }
    });
  }

  function deleteNote(noteId, callback) {
    getNotes(function (notes) {
      const updated = notes.filter(function (n) { return String(n.id) !== String(noteId); });
      try {
        chrome.storage.local.set({ petNotes: updated }, function () {
          if (callback) callback(updated);
        });
      } catch (e) {
        if (callback) callback(updated);
      }
    });
  }

  function clearAllNotes(callback) {
    try {
      chrome.storage.local.set({ petNotes: [] }, function () {
        if (callback) callback();
      });
    } catch (e) {
      if (callback) callback();
    }
  }

  function getStorageBytes(callback) {
    try {
      chrome.storage.local.getBytesInUse(null, function (bytes) {
        if (callback) callback(bytes || 0);
      });
    } catch (e) {
      if (callback) callback(0);
    }
  }

  function getSavedScale(callback) {
    try {
      chrome.storage.local.get({ petScale: Pet.DEFAULT_SCALE }, function (result) {
        const val = result ? result.petScale : Pet.DEFAULT_SCALE;
        if (callback) callback(Pet.VALID_SCALES.includes(val) ? val : Pet.DEFAULT_SCALE);
      });
    } catch (e) {
      if (callback) callback(Pet.DEFAULT_SCALE);
    }
  }

  function saveScale(scale, callback) {
    try {
      chrome.storage.local.set({ petScale: scale }, function () {
        if (callback) callback();
      });
    } catch (e) {
      if (callback) callback();
    }
  }

  Pet.storage = {
    compressImage: compressImage,
    createImagePreview: createImagePreview,
    getNotes: getNotes,
    saveNote: saveNote,
    updateNote: updateNote,
    deleteNote: deleteNote,
    clearAllNotes: clearAllNotes,
    getStorageBytes: getStorageBytes,
    getSavedScale: getSavedScale,
    saveScale: saveScale,
  };

  // Direct shortcuts
  Pet.compressImage = compressImage;
  Pet.createImagePreview = createImagePreview;

})(window.BrowserPet);
