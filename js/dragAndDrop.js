document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("file-input");
  const dragDropZone = document.getElementById("drag-drop-zone");
  const filePreviewRow = document.getElementById("file-preview-row");
  const messageInput = document.getElementById("message-input");
  const sendButton = document.getElementById("send-button");

  // Check if all elements are available
  if (!fileInput || !dragDropZone || !filePreviewRow || !messageInput || !sendButton) {
      console.error("Required elements are missing from the DOM.");
      return;
  }

  // Highlight drag area when a file is dragged over it
  dragDropZone.addEventListener("dragover", (e) => {
      e.preventDefault(); // Prevent default to allow drop
      dragDropZone.classList.add("dragging");
  });

  // Remove highlight when the dragged file leaves the area
  dragDropZone.addEventListener("dragleave", () => {
      dragDropZone.classList.remove("dragging");
  });

  // Handle file drop
  dragDropZone.addEventListener("drop", (e) => {
      e.preventDefault(); // Prevent default browser behavior
      dragDropZone.classList.remove("dragging");
      handleFiles(e.dataTransfer.files); // Process the dropped files
  });

  // Trigger file selection dialog when "Browse" button is clicked
  document.getElementById("file-select-btn").addEventListener("click", () => fileInput.click());

  // Handle file selection
  fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

  // Function to handle selected or dropped files
  const handleFiles = (files) => {
      [...files].forEach((file) => {
          const preview = document.createElement("div");
          preview.classList.add("file-preview");
          if (file.type.startsWith("image/")) {
              const img = document.createElement("img");
              img.src = URL.createObjectURL(file);
              preview.appendChild(img);
          } else {
              const span = document.createElement("span");
              span.textContent = file.name;
              preview.appendChild(span);
          }
          filePreviewRow.appendChild(preview);
      });
  };

  // Send message with files
  sendButton.addEventListener("click", async () => {
      const message = messageInput.value.trim();
      const formData = new FormData();
      formData.append("message", message);
      [...fileInput.files].forEach((file, i) => formData.append(`file_${i}`, file));

      try {
          const response = await fetch("/api/sendMessage.php", {
              method: "POST",
              body: formData,
          });
          if (!response.ok) throw new Error("Upload failed");
          const result = await response.json();
          if (result.success) {
              filePreviewRow.innerHTML = "";
              messageInput.value = "";
          } else {
              console.error(result.message);
          }
      } catch (error) {
          console.error(error.message);
      }
  });
});