class FileManager {
 constructor(app) {
    this.app = app;
    this.maxFileSize = window.MAX_FILE_SIZE;
    this.allowedTypes = window.ALLOWED_MIME_TYPES;
    this.pendingUpload = null;
    this.initializeEventListeners();
}

    initializeEventListeners() {
        // File input change handler
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e);
            });
        }

        // Attach file button
        document.querySelector('[data-action="attach-file"]')?.addEventListener('click', () => {
            this.triggerFileInput();
        });

        // Preview area
        const attachmentPreview = document.getElementById('attachmentPreview');
        if (attachmentPreview) {
            attachmentPreview.addEventListener('click', (e) => {
                if (e.target.matches('.remove-attachment')) {
                    this.clearAttachment();
                }
            });
        }
    }

    triggerFileInput() {
        document.getElementById('fileInput')?.click();
    }

 async handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        // Add new validation method
        await this.validateFile(file);
        this.pendingUpload = file;
        this.showFilePreview(file);
    } catch (error) {
        this.app.ui.showError(error.message);
        this.clearAttachment();
    }
}

// Add this new method
async validateFile(file) {
    if (file.size > this.maxFileSize) {
        throw new Error(`File size exceeds ${this.formatSize(this.maxFileSize)}`);
    }

    if (!this.allowedTypes.includes(file.type)) {
        throw new Error('File type not allowed');
    }
}

    showFilePreview(file) {
        const preview = document.getElementById('attachmentPreview');
        if (!preview) return;

        preview.innerHTML = `
            <div class="attachment-preview">
                ${this.getFilePreviewContent(file)}
                <button type="button" class="remove-attachment">×</button>
            </div>
        `;
    }

    getFilePreviewContent(file) {
        if (file.type.startsWith('image/')) {
            return `
                <div class="image-preview">
                    <img src="${URL.createObjectURL(file)}" alt="Preview">
                </div>
                <span>${this.escapeHtml(file.name)} (${this.formatSize(file.size)})</span>
            `;
        }
        
        return `
            <div class="file-preview">
                <span class="file-icon">📎</span>
                <span>${this.escapeHtml(file.name)} (${this.formatSize(file.size)})</span>
            </div>
        `;
    }

    async uploadFile(messageId) {
        if (!this.pendingUpload) return null;

        const formData = new FormData();
        formData.append('file', this.pendingUpload);
        formData.append('message_id', messageId);

        try {
            const response = await fetch('/files.php', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRF-Token': this.app.api.csrfToken
                }
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Upload failed');
            }

            this.clearAttachment();
            return result.file_id;
        } catch (error) {
            this.app.ui.showError('Failed to upload file: ' + error.message);
            return null;
        }
    }

    clearAttachment() {
        this.pendingUpload = null;
        document.getElementById('fileInput').value = '';
        document.getElementById('attachmentPreview').innerHTML = '';
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

export default FileManager;