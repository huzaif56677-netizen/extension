// ============================================================
// Browser Pet — Ultra High-Definition (300 DPI) PDF Exporter
// ============================================================

window.BrowserPet = window.BrowserPet || {};

(function (Pet) {
  "use strict";

  /**
   * Builds a valid 100% compliant PDF-1.4 containing
   * 300-DPI high-definition JPEG page images (/DCTDecode).
   * Universally supported by Chrome, Acrobat, Edge, macOS, iOS, Android.
   */
  function buildPdfFromJpegBuffers(pages) {
    const pageW = 612; // 8.5" at 72 DPI (Standard US Letter width in PDF points)
    const objs = [];
    const offsets = [];

    let pdfStr = "%PDF-1.4\n";

    // 1: Catalog
    objs[1] = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";

    // 2: Pages container
    let kids = "";
    for (let i = 0; i < pages.length; i++) {
      kids += (3 + i * 3) + " 0 R ";
    }
    objs[2] = "2 0 obj\n<< /Type /Pages /Kids [" + kids.trim() + "] /Count " + pages.length + " >>\nendobj\n";

    function appendTextObj(num, content) {
      objs[num] = content;
    }

    appendTextObj(1, objs[1]);
    appendTextObj(2, objs[2]);

    for (let i = 0; i < pages.length; i++) {
      const pageNum = 3 + i * 3;
      const imgNum = pageNum + 1;
      const contentNum = pageNum + 2;

      const p = pages[i];
      const pageH = Math.max(792, Math.round(pageW * (p.height / p.width)));

      // Page Object
      objs[pageNum] = pageNum + " 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pageW + " " + pageH + "] /Resources << /XObject << /Im" + (i + 1) + " " + imgNum + " 0 R >> >> /Contents " + contentNum + " 0 R >>\nendobj\n";

      // Image Object Header
      objs[imgNum] = {
        isImage: true,
        imgNum: imgNum,
        header: imgNum + " 0 obj\n<< /Type /XObject /Subtype /Image /Width " + p.width + " /Height " + p.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + p.jpegBytes.length + " >>\nstream\n",
        bytes: p.jpegBytes,
        footer: "\nendstream\nendobj\n"
      };

      // Content stream
      const stream = "q\n" + pageW + " 0 0 " + pageH + " 0 0 cm\n/Im" + (i + 1) + " Do\nQ\n";
      objs[contentNum] = contentNum + " 0 obj\n<< /Length " + stream.length + " >>\nstream\n" + stream + "endstream\nendobj\n";
    }

    const totalObjs = 2 + pages.length * 3;

    const blobParts = [pdfStr];
    let pos = pdfStr.length;

    for (let n = 1; n <= totalObjs; n++) {
      offsets[n] = pos;
      const obj = objs[n];
      if (typeof obj === "string") {
        blobParts.push(obj);
        pos += obj.length;
      } else if (obj && obj.isImage) {
        blobParts.push(obj.header);
        pos += obj.header.length;

        blobParts.push(obj.bytes);
        pos += obj.bytes.length;

        blobParts.push(obj.footer);
        pos += obj.footer.length;
      }
    }

    // XREF Table
    const xrefStart = pos;
    let xref = "xref\n0 " + (totalObjs + 1) + "\n0000000000 65535 f \n";
    for (let n = 1; n <= totalObjs; n++) {
      xref += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
    }
    xref += "trailer\n<< /Size " + (totalObjs + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefStart + "\n%%EOF";
    blobParts.push(xref);

    return new Blob(blobParts, { type: "application/pdf" });
  }

  function dataURLtoUint8Array(dataUrl) {
    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Render note content with 300 DPI high-definition canvas, then export PDF.
   */
  async function exportNoteToPDF(title, htmlOrElement) {
    const titleText = (title || "Untitled Note").trim();
    const dateText = "Created: " + new Date().toLocaleString();

    // Parse elements
    let rootEl;
    if (typeof htmlOrElement === "string") {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlOrElement, "text/html");
      rootEl = doc.body;
    } else if (htmlOrElement && htmlOrElement.nodeType) {
      rootEl = htmlOrElement;
    } else {
      rootEl = document.createElement("div");
      rootEl.textContent = String(htmlOrElement || "");
    }

    // Collect blocks (paragraphs, list items, inline images)
    const blocks = [];

    function processNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) blocks.push({ type: "text", text: text });
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();

        // Check if node is an image
        if (tag === "img") {
          blocks.push({ type: "image", src: node.src });
          return;
        }

        // Image wrapper check
        const imgChild = node.querySelector("img");
        if (imgChild && node.classList && node.classList.contains("note-inline-image-wrapper")) {
          blocks.push({ type: "image", src: imgChild.src });
          return;
        }

        const isBold = tag === "b" || tag === "strong" || node.style.fontWeight === "bold";
        const isItalic = tag === "i" || tag === "em" || node.style.fontStyle === "italic";
        const isUnderline = tag === "u" || (node.style.textDecoration && node.style.textDecoration.includes("underline"));
        const isStrike = tag === "strike" || tag === "s" || (node.style.textDecoration && node.style.textDecoration.includes("line-through"));
        const isListItem = tag === "li";

        if (tag === "p" || tag === "div" || tag === "li" || tag === "h1" || tag === "h2" || tag === "h3") {
          const directImages = node.querySelectorAll("img");
          if (directImages.length > 0) {
            for (let i = 0; i < node.childNodes.length; i++) {
              processNode(node.childNodes[i]);
            }
            return;
          }

          const txt = node.innerText || node.textContent;
          if (txt && txt.trim()) {
            blocks.push({
              type: "text",
              text: txt.trim(),
              isBold: isBold,
              isItalic: isItalic,
              isUnderline: isUnderline,
              isStrike: isStrike,
              isBullet: isListItem,
            });
          }
        } else {
          for (let i = 0; i < node.childNodes.length; i++) {
            processNode(node.childNodes[i]);
          }
        }
      }
    }

    for (let i = 0; i < rootEl.childNodes.length; i++) {
      processNode(rootEl.childNodes[i]);
    }

    // Preload all images at full resolution
    for (let b of blocks) {
      if (b.type === "image") {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise(function (resolve) {
            img.onload = resolve;
            img.onerror = resolve;
            img.src = b.src;
          });
          b.imgElement = img;
        } catch (e) {}
      }
    }

    // High-DPI Scaling Factor (3x = 2400px width = ~300 DPI print quality)
    const SCALE = 3;
    const canvasWidth = 800 * SCALE; // 2400px
    const paddingX = 48 * SCALE;
    const contentWidth = canvasWidth - (paddingX * 2);

    const measureCanvas = document.createElement("canvas");
    const mctx = measureCanvas.getContext("2d");

    function wrapText(ctx, text, maxWidth) {
      const words = text.split(" ");
      const lines = [];
      let currentLine = words[0] || "";

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
          currentLine += " " + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
      return lines;
    }

    const titleFontSize = 26 * SCALE;
    const bodyFontSize = 16 * SCALE;
    const dateFontSize = 13 * SCALE;
    const lineHeight = 26 * SCALE;
    const fontStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

    // Measure total needed height
    let totalHeight = (50 + 35 + 25) * SCALE;

    for (let b of blocks) {
      if (b.type === "text") {
        let fontStyle = "";
        if (b.isItalic) fontStyle += "italic ";
        if (b.isBold) fontStyle += "bold ";
        mctx.font = fontStyle + bodyFontSize + "px " + fontStack;

        const prefix = b.isBullet ? "•   " : "";
        const lines = wrapText(mctx, prefix + b.text, contentWidth);
        b.wrappedLines = lines;
        totalHeight += lines.length * lineHeight + (8 * SCALE);
      } else if (b.type === "image" && b.imgElement && b.imgElement.naturalWidth > 0) {
        let iw = b.imgElement.naturalWidth;
        let ih = b.imgElement.naturalHeight;
        const maxImgW = Math.min(contentWidth, 700 * SCALE);
        if (iw > maxImgW) {
          ih = Math.round(ih * (maxImgW / iw));
          iw = maxImgW;
        } else {
          // If image is high-res, scale nicely into canvas
          const targetW = Math.min(contentWidth, Math.round(iw * (SCALE * 0.8)));
          ih = Math.round(ih * (targetW / iw));
          iw = targetW;
        }
        b.drawW = iw;
        b.drawH = ih;
        totalHeight += ih + (20 * SCALE);
      }
    }

    totalHeight += 50 * SCALE;

    // Minimum standard Letter page height at 3x scale (3100px)
    const canvasHeight = Math.max(3100, totalHeight);

    // Create 300-DPI render canvas
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");

    // Enable high-quality smoothing & anti-aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Clean white page
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Modern document accent top line
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(paddingX, 36 * SCALE, contentWidth, 3 * SCALE);

    // Note Title
    ctx.fillStyle = "#111111";
    ctx.font = "bold " + titleFontSize + "px " + fontStack;
    ctx.fillText(titleText, paddingX, 72 * SCALE);

    // Creation Date
    ctx.fillStyle = "#666666";
    ctx.font = dateFontSize + "px " + fontStack;
    ctx.fillText(dateText, paddingX, 96 * SCALE);

    // Separator line
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1 * SCALE;
    ctx.beginPath();
    ctx.moveTo(paddingX, 110 * SCALE);
    ctx.lineTo(paddingX + contentWidth, 110 * SCALE);
    ctx.stroke();

    // Render blocks in document flow
    let currentY = 135 * SCALE;

    for (let b of blocks) {
      if (b.type === "text" && b.wrappedLines) {
        let fontStyle = "";
        if (b.isItalic) fontStyle += "italic ";
        if (b.isBold) fontStyle += "bold ";
        ctx.font = fontStyle + bodyFontSize + "px " + fontStack;
        ctx.fillStyle = "#1f1f1f";

        for (let line of b.wrappedLines) {
          ctx.fillText(line, paddingX, currentY);

          // Underline / Strikethrough decorations
          if (b.isUnderline || b.isStrike) {
            const lineW = ctx.measureText(line).width;
            ctx.save();
            ctx.strokeStyle = "#1f1f1f";
            ctx.lineWidth = 1.8 * SCALE;
            ctx.beginPath();
            if (b.isUnderline) {
              ctx.moveTo(paddingX, currentY + (3 * SCALE));
              ctx.lineTo(paddingX + lineW, currentY + (3 * SCALE));
            }
            if (b.isStrike) {
              ctx.moveTo(paddingX, currentY - (6 * SCALE));
              ctx.lineTo(paddingX + lineW, currentY - (6 * SCALE));
            }
            ctx.stroke();
            ctx.restore();
          }

          currentY += lineHeight;
        }
        currentY += 8 * SCALE;
      } else if (b.type === "image" && b.imgElement && b.drawW > 0) {
        // Center image horizontally
        const imgX = paddingX + Math.round((contentWidth - b.drawW) / 2);

        // Crisp border frame
        ctx.strokeStyle = "#dddddd";
        ctx.lineWidth = 1.5 * SCALE;
        ctx.strokeRect(imgX - (2 * SCALE), currentY - (2 * SCALE), b.drawW + (4 * SCALE), b.drawH + (4 * SCALE));

        // Draw image at full high-definition resolution
        ctx.drawImage(b.imgElement, imgX, currentY, b.drawW, b.drawH);
        currentY += b.drawH + (20 * SCALE);
      }
    }

    // Document footer
    ctx.fillStyle = "#999999";
    ctx.font = (11 * SCALE) + "px " + fontStack;
    ctx.fillText("Exported from Browser Pet", paddingX, canvasHeight - (20 * SCALE));

    // Convert high-definition canvas to JPEG (0.96 quality)
    const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.96);
    const jpegBytes = dataURLtoUint8Array(jpegDataUrl);

    const pdfBlob = buildPdfFromJpegBuffers([{
      jpegBytes: jpegBytes,
      width: canvasWidth,
      height: canvasHeight,
    }]);

    // Download PDF directly
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (titleText || "Untitled Note").replace(/[^a-zA-Z0-9 ]/g, "").trim() + ".pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  Pet.pdf = {
    exportNoteToPDF: exportNoteToPDF,
  };
  Pet.exportNoteToPDF = exportNoteToPDF;

})(window.BrowserPet);
