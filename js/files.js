class FileManager {
    constructor(app) {
        this.app = app;
        this.maxFileSize = window.MAX_FILE_SIZE;
        this.allowedTypes = window.ALLOWED_MIME_TYPES;
        this.pendingFiles = new Map(); // Using Map to store multiple files
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Standard file input handling
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', e => this.handleFileSelect(e));
        }

        // Attach file button
        document.querySelector('[data-action="attach-file"]')?.addEventListener('click', () => {
            fileInput?.click();
        });

        // Setup drag and drop
        this.setupDragAndDrop();

        // Preview area event delegation
        document.getElementById('attachmentPreview')?.addEventListener('click', e => {
            if (e.target.closest('.remove-attachment')) {
                const fileId = e.target.closest('.attachment-preview').dataset.fileId;
                this.removeFile(fileId);
            }
        });
    }

    setupDragAndDrop() {
        const messageInput = document.getElementById('messageInput');
        if (!messageInput) return;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            messageInput.addEventListener(eventName, e => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        messageInput.addEventListener('dragenter', () => messageInput.classList.add('drag-active'));
        messageInput.addEventListener('dragleave', () => messageInput.classList.remove('drag-active'));
        messageInput.addEventListener('drop', e => {
            messageInput.classList.remove('drag-active');
            const files = Array.from(e.dataTransfer.files);
            files.forEach(file => this.processFile(file));
        });
    }

    async processFile(file) {
        try {
            await this.validateFile(file);
            const fileId = crypto.randomUUID();
            this.pendingFiles.set(fileId, file);
            this.updatePreview();
        } catch (error) {
            this.app.ui.showError(error.message);
        }
    }

    async handleFileSelect(event) {
        const files = Array.from(event.target.files);
        files.forEach(file => this.processFile(file));
        event.target.value = ''; // Reset input
    }

    async validateFile(file) {
        if (file.size > this.maxFileSize) {
            throw new Error(`File size exceeds ${this.formatSize(this.maxFileSize)}`);
        }

        if (!this.allowedTypes.includes(file.type)) {
            throw new Error('File type not allowed');
        }

        if (this.pendingFiles.size >= 10) {
            throw new Error('Maximum 10 files can be attached at once');
        }
    }

    updatePreview() {
        const preview = document.getElementById('attachmentPreview');
        if (!preview) return;

        preview.innerHTML = Array.from(this.pendingFiles.entries())
            .map(([fileId, file]) => `
                <div class="attachment-preview" data-file-id="${fileId}">
                    ${this.getFilePreviewContent(file)}
                    <button type="button" class="remove-attachment" aria-label="Remove file">×</button>
                </div>
            `).join('');
    }

    getFilePreviewContent(file) {
        if (file.type.startsWith('image/')) {
            return `
                <div class="image-preview">
                    <img src="${URL.createObjectURL(file)}" alt="${this.escapeHtml(file.name)}">
                </div>
                <span class="file-info">${this.escapeHtml(file.name)} (${this.formatSize(file.size)})</span>
            `;
        }

        const fileIcon = this.getFileIcon(file.type);
        return `
            <div class="file-preview">
                <span class="file-icon">${fileIcon}</span>
                <span class="file-info">${this.escapeHtml(file.name)} (${this.formatSize(file.size)})</span>
            </div>
        `;
    }

    getFileIcon(mimeType) {
        const icons = {
            'audio/': '🎵',
            'image/': '🖼️',
            'video/': '🎥',
            'application/pdf': '📄',
            'text/': '📝'
        };
        return Object.entries(icons).find(([key]) => mimeType.startsWith(key))?.[1] || '📎';
    }

    removeFile(fileId) {
        if (this.pendingFiles.has(fileId)) {
            this.pendingFiles.delete(fileId);
            this.updatePreview();
        }
    }

    async uploadFiles(messageId) {
        if (this.pendingFiles.size === 0) return [];
    
        const uploadPromises = Array.from(this.pendingFiles.values()).map(async file => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('message_id', messageId);
    
            try {
                // Fix the endpoint path
                const response = await fetch('./api/files.php', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-CSRF-Token': this.app.api.csrfToken
                    }
                });
    
                const result = await response.json();
                if (!result.success) throw new Error(result.error || 'Upload failed');
                return result.file_id;
            } catch (error) {
                throw new Error(`Failed to upload ${file.name}: ${error.message}`);
            }
        });
    
        try {
            const fileIds = await Promise.all(uploadPromises);
            this.clearAttachments();
            return fileIds;
        } catch (error) {
            this.app.ui.showError(error.message);
            return [];
        }
    }

    clearAttachments() {
        this.pendingFiles.clear();
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