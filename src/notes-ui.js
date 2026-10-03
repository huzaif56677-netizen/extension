// ============================================================
// Browser Pet — Word-like Notes UI (Inline Flow Images & Rich Text)
// ============================================================

window.BrowserPet = window.BrowserPet || {};

(function (Pet) {
  "use strict";

  const RETRO = Pet.RETRO;

  // Insert HTML at current cursor position in a contenteditable element
  function insertHtmlAtCursor(html) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();

    const el = document.createElement("div");
    el.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node;
    let lastNode;
    while ((node = el.firstChild)) {
      lastNode = frag.appendChild(node);
    }
    range.insertNode(frag);

    // Place cursor after the inserted content
    if (lastNode) {
      const newRange = range.cloneRange();
      newRange.setStartAfter(lastNode);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
  }

  // Create an inline flow image container with an X remove button
  function createInlineImageElement(dataUrl) {
    const wrapper = document.createElement("span");
    wrapper.className = "note-inline-image-wrapper";
    wrapper.contentEditable = "false";
    Object.assign(wrapper.style, {
      display: "block",
      position: "relative",
      margin: "8px 0",
      textAlign: "center",
      userSelect: "none",
    });

    const inner = document.createElement("span");
    Object.assign(inner.style, {
      position: "relative",
      display: "inline-block",
      border: "2px solid " + RETRO.border,
      background: RETRO.bgLight,
      padding: "2px",
      boxShadow: "2px 2px 0px " + RETRO.border,
      maxWidth: "100%",
    });

    const img = document.createElement("img");
    img.src = dataUrl;
    Object.assign(img.style, {
      maxWidth: "100%",
      maxHeight: "220px",
      display: "block",
      borderRadius: "0",
      imageRendering: "auto",
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "×";
    removeBtn.title = "Remove image";
    Object.assign(removeBtn.style, {
      position: "absolute",
      top: "-8px",
      right: "-8px",
      width: "20px",
      height: "20px",
      background: RETRO.danger,
      color: "#ffffff",
      border: "1px solid " + RETRO.border,
      fontSize: "14px",
      fontWeight: "bold",
      fontFamily: RETRO.font,
      cursor: "pointer",
      padding: "0",
      lineHeight: "18px",
      textAlign: "center",
      zIndex: "2",
      boxShadow: "1px 1px 0px #000",
    });

    removeBtn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
    });

    inner.appendChild(img);
    inner.appendChild(removeBtn);
    wrapper.appendChild(inner);

    return wrapper;
  }

  function insertInlineImage(editor, dataUrl) {
    Pet.storage.compressImage(dataUrl, function (compressed) {
      editor.focus();
      const wrapper = createInlineImageElement(compressed);

      // Insert into document flow
      const sel = window.getSelection();
      if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        range.insertNode(wrapper);
        // Move caret after wrapper
        const after = document.createTextNode("\u00A0");
        range.setStartAfter(wrapper);
        range.insertNode(after);
        range.setStartAfter(after);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      } else {
        // Append at end of editor
        editor.appendChild(wrapper);
        editor.appendChild(document.createElement("br"));
      }
    });
  }

  // ---- CREATE / EDIT NOTE (Word-like Interface) ----
  function doCreateNote(existingNote) {
    const isEdit = !!(existingNote && existingNote.id);
    const panel = Pet.createPanel(isEdit ? "Edit Note" : "New Note");

    const body = document.createElement("div");
    Object.assign(body.style, {
      padding: "10px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      overflowY: "auto",
      maxHeight: "390px",
    });

    // Note Title Input
    const titleInput = Pet.retroInput("Note title...");
    if (isEdit && existingNote.title) {
      titleInput.value = existingNote.title;
    }

    // Formatting Toolbar (Bold, Italic, Underline, Strikethrough, Bullet List, Divider, Screenshot, Image)
    const toolbar = document.createElement("div");
    Object.assign(toolbar.style, {
      display: "flex",
      alignItems: "center",
      gap: "4px",
      padding: "4px 6px",
      background: RETRO.bgLight,
      border: RETRO.borderW + " solid " + RETRO.border,
      boxShadow: RETRO.shadowInset,
      flexWrap: "wrap",
    });

    function makeToolBtn(label, title, command, onExec) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = label;
      btn.title = title;
      Object.assign(btn.style, {
        padding: "2px 7px",
        minWidth: "26px",
        height: "26px",
        background: RETRO.bg,
        border: "1px solid " + RETRO.border,
        color: RETRO.text,
        fontSize: "14px",
        fontFamily: RETRO.font,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      });

      btn.addEventListener("mousedown", function (e) {
        e.preventDefault(); // Prevent losing focus in contenteditable
      });

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        editor.focus();
        if (command) {
          document.execCommand(command, false, null);
          updateToolState();
        } else if (onExec) {
          onExec();
        }
      });

      return btn;
    }

    const boldBtn = makeToolBtn("<b>B</b>", "Bold", "bold");
    const italicBtn = makeToolBtn("<i>I</i>", "Italic", "italic");
    const underlineBtn = makeToolBtn("<u>U</u>", "Underline", "underline");
    const strikeBtn = makeToolBtn("<strike>S</strike>", "Strikethrough", "strikeThrough");
    const bulletListSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;display:inline-block;"><line x1="9" y1="6" x2="20" y2="6"></line><line x1="9" y1="12" x2="20" y2="12"></line><line x1="9" y1="18" x2="20" y2="18"></line><circle cx="4" cy="6" r="1.5" fill="currentColor"></circle><circle cx="4" cy="12" r="1.5" fill="currentColor"></circle><circle cx="4" cy="18" r="1.5" fill="currentColor"></circle></svg>';
    const listBtn = makeToolBtn(bulletListSvg, "Bullet List", "insertUnorderedList");

    const sep = document.createElement("div");
    Object.assign(sep.style, {
      width: "1px",
      height: "20px",
      background: RETRO.border,
      margin: "0 3px",
    });

    // Attachment Image button
    const attachSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;display:inline-block;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>';
    const attachBtn = makeToolBtn(attachSvg + "<span>Image</span>", "Attach Image file", null, function () {
      fileInput.click();
    });
    attachBtn.style.padding = "2px 8px";

    // Screenshot button next to Image
    const cameraSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;display:inline-block;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>';
    const screenshotBtn = makeToolBtn(cameraSvg + "<span>Screenshot</span>", "Capture page screenshot into note", null, function () {
      const panel = Pet.state.activePanel;
      if (panel) panel.style.opacity = "0";

      setTimeout(function () {
        chrome.runtime.sendMessage({ action: "captureVisibleTab" }, function (res) {
          if (panel) panel.style.opacity = "1";
          if (chrome.runtime.lastError || !res || !res.success || !res.dataUrl) {
            alert("Could not capture screenshot. You can also paste any image directly with Ctrl+V!");
            return;
          }
          insertInlineImage(editor, res.dataUrl);
        });
      }, 120);
    });
    screenshotBtn.style.padding = "2px 8px";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
          insertInlineImage(editor, e.target.result);
        };
        reader.readAsDataURL(fileInput.files[0]);
      }
      fileInput.value = "";
    });

    function updateToolState() {
      try {
        boldBtn.style.background = document.queryCommandState("bold") ? RETRO.accent : RETRO.bg;
        boldBtn.style.color = document.queryCommandState("bold") ? RETRO.bgLight : RETRO.text;

        italicBtn.style.background = document.queryCommandState("italic") ? RETRO.accent : RETRO.bg;
        italicBtn.style.color = document.queryCommandState("italic") ? RETRO.bgLight : RETRO.text;

        underlineBtn.style.background = document.queryCommandState("underline") ? RETRO.accent : RETRO.bg;
        underlineBtn.style.color = document.queryCommandState("underline") ? RETRO.bgLight : RETRO.text;

        strikeBtn.style.background = document.queryCommandState("strikeThrough") ? RETRO.accent : RETRO.bg;
        strikeBtn.style.color = document.queryCommandState("strikeThrough") ? RETRO.bgLight : RETRO.text;

        listBtn.style.background = document.queryCommandState("insertUnorderedList") ? RETRO.accent : RETRO.bg;
        listBtn.style.color = document.queryCommandState("insertUnorderedList") ? RETRO.bgLight : RETRO.text;
      } catch (e) {}
    }

    toolbar.appendChild(boldBtn);
    toolbar.appendChild(italicBtn);
    toolbar.appendChild(underlineBtn);
    toolbar.appendChild(strikeBtn);
    toolbar.appendChild(listBtn);
    toolbar.appendChild(sep);
    toolbar.appendChild(attachBtn);
    toolbar.appendChild(screenshotBtn);
    toolbar.appendChild(fileInput);

    // Word Document Page (contenteditable)
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    editor.setAttribute("spellcheck", "false");
    Object.assign(editor.style, {
      minHeight: "180px",
      maxHeight: "240px",
      overflowY: "auto",
      padding: "10px",
      background: "#ffffff",
      color: "#1a1a1a",
      fontFamily: "'Courier New', Courier, monospace",
      fontSize: "15px",
      lineHeight: "1.5",
      border: RETRO.borderW + " solid " + RETRO.border,
      boxShadow: "inset 2px 2px 0px rgba(0,0,0,0.15)",
      outline: "none",
    });

    if (isEdit && existingNote.html) {
      editor.innerHTML = existingNote.html;
    } else if (isEdit && existingNote.content) {
      editor.innerText = existingNote.content;
    }

    // Attach remove handlers to existing images if re-opening a note
    editor.querySelectorAll(".note-inline-image-wrapper").forEach(function (wrapper) {
      const btn = wrapper.querySelector("button");
      if (btn) {
        btn.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
        };
      }
    });

    // Update active toolbar buttons on selection change
    editor.addEventListener("keyup", updateToolState);
    editor.addEventListener("mouseup", updateToolState);

    // Paste handler for inline image pasting
    editor.addEventListener("paste", function (e) {
      const items = (e.clipboardData || {}).items || [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();
          const reader = new FileReader();
          reader.onload = function (ev) {
            insertInlineImage(editor, ev.target.result);
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    });

    // Action Buttons Row (Cancel, Export PDF, Save)
    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, {
      display: "flex",
      gap: "6px",
      justifyContent: "flex-end",
      marginTop: "4px",
    });

    const cancelBtn = Pet.retroButton("Cancel", "");
    cancelBtn.addEventListener("click", Pet.closePanel);

    const exportBtn = Pet.retroButton("Export PDF", "success");
    exportBtn.addEventListener("click", function () {
      const t = titleInput.value.trim() || "Untitled Note";
      Pet.exportNoteToPDF(t, editor.innerHTML);
    });

    const saveBtn = Pet.retroButton(isEdit ? "Update" : "Save", "primary");
    saveBtn.addEventListener("click", function () {
      const t = titleInput.value.trim();
      const html = editor.innerHTML.trim();
      const plainText = editor.innerText.trim();

      if (!t && !plainText && editor.querySelectorAll("img").length === 0) {
        titleInput.style.borderColor = RETRO.danger;
        return;
      }

      // Collect image data URLs inside the note for thumbnail previews
      const imgElements = editor.querySelectorAll("img");
      const images = [];
      imgElements.forEach(function (im) {
        if (im.src) images.push(im.src);
      });

      const noteData = {
        id: isEdit ? existingNote.id : Date.now(),
        title: t || "Untitled Note",
        html: html,
        content: plainText,
        images: images,
        createdAt: isEdit ? existingNote.createdAt : new Date().toLocaleString(),
      };

      if (isEdit) {
        // Update in storage
        Pet.storage.updateNote(noteData, function () {
          Pet.closePanel();
          Pet.doMyNotes();
        });
      } else {
        // New note
        Pet.storage.saveNote(noteData, function () {
          Pet.closePanel();
          Pet.doMyNotes();
          const petEl = Pet.state.pet;
          if (petEl) {
            petEl.style.filter = "brightness(1.5)";
            setTimeout(function () {
              if (Pet.state.pet) Pet.state.pet.style.filter = "";
            }, 300);
          }
        });
      }
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(exportBtn);
    btnRow.appendChild(saveBtn);

    body.appendChild(titleInput);
    body.appendChild(toolbar);
    body.appendChild(editor);
    body.appendChild(btnRow);
    panel.appendChild(body);

    setTimeout(function () {
      if (!isEdit) titleInput.focus();
      else editor.focus();
    }, 100);
  }

  // ---- MY NOTES (List & Manage) ----
  function doMyNotes() {
    const panel = Pet.createPanel("My Notes");

    const body = document.createElement("div");
    Object.assign(body.style, {
      padding: "8px",
      overflowY: "auto",
      maxHeight: "390px",
    });

    body.textContent = "Loading...";
    body.style.padding = "12px";
    body.style.color = RETRO.textMuted;
    body.style.fontFamily = RETRO.font;
    panel.appendChild(body);

    Pet.storage.getNotes(function (notes) {
      body.textContent = "";
      body.style.padding = "8px";
      body.style.color = RETRO.text;

      // Top action & search bar
      const topBar = document.createElement("div");
      Object.assign(topBar.style, {
        display: "flex",
        gap: "6px",
        marginBottom: "8px",
        alignItems: "center",
      });

      const searchInput = Pet.retroInput("🔍 Search notes...");
      searchInput.style.flex = "1";

      const newBtn = Pet.retroButton("+ Note", "primary");
      newBtn.style.padding = "4px 10px";
      newBtn.style.fontSize = "15px";
      newBtn.addEventListener("click", function () {
        doCreateNote();
      });

      topBar.appendChild(searchInput);
      topBar.appendChild(newBtn);
      body.appendChild(topBar);

      const listContainer = document.createElement("div");
      body.appendChild(listContainer);

      function renderList(query) {
        listContainer.innerHTML = "";
        const q = (query || "").trim().toLowerCase();
        const filtered = q
          ? notes.filter(function (n) {
              return (
                (n.title && n.title.toLowerCase().includes(q)) ||
                (n.content && n.content.toLowerCase().includes(q))
              );
            })
          : notes;

        if (filtered.length === 0) {
          const empty = document.createElement("div");
          Object.assign(empty.style, {
            textAlign: "center",
            padding: "24px 12px",
            color: RETRO.textMuted,
            fontSize: "16px",
            fontFamily: RETRO.font,
          });
          empty.innerHTML = q
            ? "No notes matching '" + query + "'."
            : "📭<br><br>No notes yet.<br>Click <b>+ Note</b> to start!";
          listContainer.appendChild(empty);
          return;
        }

        filtered.forEach(function (note) {
          const card = document.createElement("div");
          Object.assign(card.style, {
            padding: "8px 10px",
            marginBottom: "6px",
            border: RETRO.borderW + " solid " + RETRO.borderLight,
            background: RETRO.bgLight,
            cursor: "pointer",
            fontFamily: RETRO.font,
          });
          card.addEventListener("mouseenter", function () {
            card.style.background = RETRO.bgDark;
          });
          card.addEventListener("mouseleave", function () {
            card.style.background = RETRO.bgLight;
          });

          // Click card to open in editor
          card.addEventListener("click", function () {
            doCreateNote(note);
          });

          // Card header
          const cardHeader = document.createElement("div");
          Object.assign(cardHeader.style, {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "4px",
          });

          const titleEl = document.createElement("div");
          titleEl.textContent = note.title || "Untitled";
          Object.assign(titleEl.style, {
            fontWeight: "bold",
            fontSize: "16px",
            color: RETRO.text,
            flex: "1",
            marginRight: "6px",
            wordBreak: "break-word",
            fontFamily: RETRO.font,
          });

          // Actions on card
          const actionsRow = document.createElement("div");
          Object.assign(actionsRow.style, {
            display: "flex",
            gap: "4px",
          });

          const editBtn = document.createElement("button");
          editBtn.type = "button";
          editBtn.textContent = "✏";
          editBtn.title = "Edit note";
          Object.assign(editBtn.style, {
            background: RETRO.bgLight,
            border: "1px solid " + RETRO.border,
            cursor: "pointer",
            fontSize: "12px",
            fontFamily: RETRO.font,
            padding: "1px 6px",
            color: RETRO.text,
            boxShadow: "1px 1px 0px " + RETRO.border,
          });
          editBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            doCreateNote(note);
          });

          const exportBtn = document.createElement("button");
          exportBtn.type = "button";
          exportBtn.textContent = "PDF";
          exportBtn.title = "Export note as PDF";
          Object.assign(exportBtn.style, {
            background: RETRO.bgLight,
            border: "1px solid " + RETRO.border,
            cursor: "pointer",
            fontSize: "12px",
            fontFamily: RETRO.font,
            padding: "1px 6px",
            color: RETRO.text,
            boxShadow: "1px 1px 0px " + RETRO.border,
          });
          exportBtn.addEventListener("mouseenter", function () {
            exportBtn.style.background = RETRO.successBg;
          });
          exportBtn.addEventListener("mouseleave", function () {
            exportBtn.style.background = RETRO.bgLight;
          });
          exportBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            Pet.exportNoteToPDF(note.title, note.html || note.content);
          });

          const deleteBtn = document.createElement("button");
          deleteBtn.type = "button";
          deleteBtn.textContent = "DEL";
          deleteBtn.title = "Delete note";
          Object.assign(deleteBtn.style, {
            background: RETRO.bgLight,
            border: "1px solid " + RETRO.border,
            cursor: "pointer",
            fontSize: "12px",
            fontFamily: RETRO.font,
            padding: "1px 6px",
            color: RETRO.danger,
            boxShadow: "1px 1px 0px " + RETRO.border,
          });
          deleteBtn.addEventListener("mouseenter", function () {
            deleteBtn.style.background = RETRO.dangerBg;
          });
          deleteBtn.addEventListener("mouseleave", function () {
            deleteBtn.style.background = RETRO.bgLight;
          });
          deleteBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            Pet.storage.deleteNote(note.id, function () {
              doMyNotes();
            });
          });

          actionsRow.appendChild(editBtn);
          actionsRow.appendChild(exportBtn);
          actionsRow.appendChild(deleteBtn);

          cardHeader.appendChild(titleEl);
          cardHeader.appendChild(actionsRow);
          card.appendChild(cardHeader);

          // Plain text preview
          const previewText = note.content || "";
          if (previewText) {
            const contentEl = document.createElement("div");
            contentEl.textContent = previewText.length > 90
              ? previewText.substring(0, 90) + "..."
              : previewText;
            Object.assign(contentEl.style, {
              fontSize: "14px",
              color: RETRO.textMuted,
              lineHeight: "1.3",
              marginBottom: "4px",
              wordBreak: "break-word",
            });
            card.appendChild(contentEl);
          }

          // Thumbnails of inline images
          if (note.images && note.images.length > 0) {
            const thumbs = document.createElement("div");
            Object.assign(thumbs.style, {
              display: "flex",
              gap: "4px",
              marginTop: "4px",
              flexWrap: "wrap",
            });
            note.images.forEach(function (dataUrl) {
              const thumb = document.createElement("img");
              thumb.src = dataUrl;
              Object.assign(thumb.style, {
                width: "36px",
                height: "28px",
                objectFit: "cover",
                border: "1px solid " + RETRO.border,
                imageRendering: "auto",
              });
              thumbs.appendChild(thumb);
            });
            card.appendChild(thumbs);
          }

          // Timestamp
          const dateEl = document.createElement("div");
          dateEl.textContent = note.createdAt || "";
          Object.assign(dateEl.style, {
            fontSize: "12px",
            color: RETRO.borderLight,
            marginTop: "2px",
          });
          card.appendChild(dateEl);

          listContainer.appendChild(card);
        });
      }

      searchInput.addEventListener("input", function () {
        renderList(searchInput.value);
      });

      renderList("");
    });
  }

  Pet.notes = {
    doCreateNote: doCreateNote,
    doMyNotes: doMyNotes,
  };
  Pet.doCreateNote = doCreateNote;
  Pet.doMyNotes = doMyNotes;

})(window.BrowserPet);
