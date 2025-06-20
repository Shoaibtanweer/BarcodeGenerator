document.addEventListener("DOMContentLoaded", () => {
  // Get references to DOM elements
  const form = document.getElementById("barcodeForm");
  const typeSelect = document.getElementById("barcodeType");
  const dataInput = document.getElementById("barcodeData");
  const barcodePreviewContainer = document.getElementById("barcodePreview"); // Renamed for clarity
  const includeTextCheckbox = document.getElementById("includeText"); // Renamed for clarity
  const generateBtn = document.getElementById("generateBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const printBtn = document.getElementById("printBtn");
  const clearBtn = document.getElementById("clearBtn"); // Clear button
  const darkModeToggle = document.getElementById("darkModeToggle");
  const loadingSpinner = document.getElementById("loadingSpinner");
  const noBarcodeMessage = document.getElementById("noBarcodeMessage"); // Message for empty preview

  let currentGeneratedImages = []; // Stores Data URLs of generated images

  /**
   * Converts an SVG element to a Canvas element.
   * This is necessary for downloading and printing JsBarcode generated images.
   * @param {SVGElement} svg - The SVG element to convert.
   * @returns {Promise<HTMLCanvasElement>} A promise that resolves with the generated canvas.
   */
  function createCanvasFromSVG(svg) {
    return new Promise((resolve) => {
      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      // Create a Blob from the SVG data and create an object URL
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement("canvas");
        // Set canvas dimensions to match the SVG image
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        // Draw the SVG image onto the canvas
        ctx.drawImage(img, 0, 0);
        // Revoke the object URL to free up memory
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = (error) => {
        console.error("Error loading SVG image:", error);
        // Fallback or rejection if image fails to load
        resolve(document.createElement("canvas")); // Resolve with an empty canvas or handle error
      };
      img.src = url; // Set the image source to the object URL
    });
  }

  /**
   * Generates a barcode or QR code based on type and data.
   * Returns a promise that resolves with the Data URL of the generated image.
   * @param {string} type - The type of barcode (e.g., 'ean13', 'qrcode').
   * @param {string} data - The data to encode in the barcode.
   * @param {boolean} includeText - Whether to display human-readable text below the barcode (for barcodes).
   * @returns {Promise<string>} A promise that resolves with the Data URL of the generated image.
   */
  async function generateBarcode(type, data, includeText) {
    if (type === "qrcode") {
      return new Promise((resolve, reject) => {
        // Generate QR code using qrcode.js
        QRCode.toDataURL(data, { width: 200, margin: 1 }, (err, url) => {
          if (err) {
            console.error("QR Code generation error:", err);
            reject("Failed to generate QR Code. Please check your data.");
          } else {
            resolve(url);
          }
        });
      });
    } else {
      // Generate standard barcodes using JsBarcode
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      try {
        JsBarcode(svg, data, {
          format: type.toUpperCase(), // JsBarcode format expects uppercase
          displayValue: includeText,
          fontSize: 18,
          height: 80,
          margin: 10,
          // Add error callback for JsBarcode
          valid: function(valid) {
            if (!valid) {
              throw new Error(`Invalid data for ${type.toUpperCase()} barcode.`);
            }
          }
        });
        // Convert the SVG to a PNG Data URL via Canvas
        const canvas = await createCanvasFromSVG(svg);
        return canvas.toDataURL("image/png");
      } catch (e) {
        console.error(`Barcode generation error for ${type}:`, e);
        throw new Error(`Failed to generate ${type.toUpperCase()} barcode: ${e.message || 'Invalid data or unsupported format.'}`);
      }
    }
  }

  // Handle form submission for barcode generation
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // Prevent default form submission

    const type = typeSelect.value;
    // Split input data by new line, trim whitespace, and filter out empty lines
    const lines = dataInput.value.split("\n").map(l => l.trim()).filter(Boolean);

    barcodePreviewContainer.innerHTML = ""; // Clear previous previews
    currentGeneratedImages = []; // Reset stored images
    noBarcodeMessage.classList.add("hidden"); // Hide the 'no barcode' message

    // Disable buttons and show loading spinner
    generateBtn.disabled = true;
    downloadBtn.disabled = true;
    printBtn.disabled = true;
    loadingSpinner.classList.remove("hidden"); // Show spinner

    if (lines.length === 0) {
        noBarcodeMessage.classList.remove("hidden");
        loadingSpinner.classList.add("hidden");
        generateBtn.disabled = false;
        return;
    }

    // Process each line of data
    for (const line of lines) {
      const barcodeWrapper = document.createElement("div");
      barcodeWrapper.className = "flex flex-col items-center justify-center p-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 shadow-sm";

      try {
        const url = await generateBarcode(type, line, includeTextCheckbox.checked);
        const img = document.createElement("img");
        img.src = url;
        img.alt = `Generated ${type} barcode for: ${line}`;
        img.className = "mx-auto max-h-40 object-contain p-2"; // Apply specific styles

        const dataLabel = document.createElement("p");
        dataLabel.textContent = line;
        dataLabel.className = "text-center text-xs text-gray-500 dark:text-gray-400 mt-2 truncate w-full px-1";
        dataLabel.title = line; // Add title for full text on hover

        barcodeWrapper.appendChild(img);
        barcodeWrapper.appendChild(dataLabel);
        barcodePreviewContainer.appendChild(barcodeWrapper);
        currentGeneratedImages.push(url); // Store the Data URL
      } catch (err) {
        console.error(`Error generating barcode for '${line}':`, err);
        const errorDiv = document.createElement("div");
        errorDiv.className = "flex flex-col items-center justify-center p-2 border border-red-400 dark:border-red-600 rounded-md bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300";
        errorDiv.innerHTML = `<i class="fas fa-exclamation-triangle text-xl mb-2"></i><p class="text-center text-sm font-semibold">Error for "${line}":</p><p class="text-center text-xs">${err.message || err}</p>`;
        barcodePreviewContainer.appendChild(errorDiv);
      }
    }

    // After all generations, re-enable buttons and hide spinner
    generateBtn.disabled = false;
    downloadBtn.disabled = currentGeneratedImages.length === 0;
    printBtn.disabled = currentGeneratedImages.length === 0;
    loadingSpinner.classList.add("hidden"); // Hide spinner

    if (currentGeneratedImages.length === 0) {
      noBarcodeMessage.classList.remove("hidden");
    }
  });

  // Handle Download PNG button click
  downloadBtn.addEventListener("click", () => {
    if (currentGeneratedImages.length === 0) return; // Do nothing if no images

    currentGeneratedImages.forEach((url, index) => {
      const a = document.createElement("a");
      a.href = url;
      // Suggest a filename based on type and index
      a.download = `barcode_${typeSelect.value}_${index + 1}.png`;
      document.body.appendChild(a); // Append to body to make it clickable in all browsers
      a.click(); // Programmatically click the link to trigger download
      document.body.removeChild(a); // Clean up the element
    });
  });

  // Handle Print button click
  printBtn.addEventListener("click", () => {
    if (currentGeneratedImages.length === 0) return; // Do nothing if no images

    const printWindow = window.open("", "_blank"); // Open a new window for printing
    printWindow.document.write(`
      <html>
      <head>
        <title>Print Barcodes</title>
        <style>
          body { font-family: sans-serif; display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; padding: 20px; }
          img { max-width: 300px; height: auto; border: 1px solid #ccc; padding: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } /* Ensure backgrounds and colors print */
            img { page-break-inside: avoid; } /* Avoid breaking images across pages */
          }
        </style>
      </head>
      <body>
    `);
    currentGeneratedImages.forEach((url) => {
      printWindow.document.write(`<img src="${url}" alt="Generated Barcode" />`);
    });
    printWindow.document.write(`
      </body>
      </html>
    `);
    printWindow.document.close(); // Close the document to ensure content is rendered
    printWindow.focus(); // Focus on the new window
    printWindow.print(); // Trigger the print dialog
    // Consider closing the window after printing, but often left to user.
    // printWindow.onafterprint = function() { printWindow.close(); };
  });

  // Dark mode toggle functionality
  darkModeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    html.classList.toggle("dark");
    const icon = darkModeToggle.querySelector("i");
    // Toggle between moon and sun icons
    icon.classList.toggle("fa-moon");
    icon.classList.toggle("fa-sun");
    // Store user preference in local storage
    localStorage.setItem("darkMode", html.classList.contains("dark"));
  });

  // Load dark mode preference from local storage on page load
  if (localStorage.getItem("darkMode") === "true") {
    document.documentElement.classList.add("dark");
    darkModeToggle.querySelector("i").classList.replace("fa-moon", "fa-sun");
  } else {
    // Ensure the moon icon is shown if dark mode is not active
    darkModeToggle.querySelector("i").classList.replace("fa-sun", "fa-moon");
  }

  // Clear button functionality
  clearBtn.addEventListener("click", () => {
    dataInput.value = ""; // Clear the text area
    barcodePreviewContainer.innerHTML = ""; // Clear the preview area
    currentGeneratedImages = []; // Clear the stored images array
    downloadBtn.disabled = true; // Disable download button
    printBtn.disabled = true; // Disable print button
    noBarcodeMessage.classList.remove("hidden"); // Show the 'no barcode' message
  });
});