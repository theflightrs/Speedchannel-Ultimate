const Utils = {
    formatTime(timestamp) {
		
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        
        const options = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        
        if (isToday) {
            return date.toLocaleTimeString([], options);
        }
        
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], options)}`;
    },

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    validateFileUpload(file) {
        if (file.size > window.MAX_FILE_SIZE) {
            throw new Error(`File size exceeds ${Math.floor(window.MAX_FILE_SIZE / 1024 / 1024)}MB limit`);
        }

        if (!window.ALLOWED_MIME_TYPES.includes(file.type)) {
            throw new Error('File type not allowed');
        }

        return true;
    },

    async generateThumbnail(file) {
        if (!file.type.startsWith('image/')) {
            return null;
        }

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const MAX_THUMB_SIZE = 100;

                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_THUMB_SIZE) {
                            height *= MAX_THUMB_SIZE / width;
                            width = MAX_THUMB_SIZE;
                        }
                    } else {
                        if (height > MAX_THUMB_SIZE) {
                            width *= MAX_THUMB_SIZE / height;
                            height = MAX_THUMB_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    },

    showError(elementId, message, duration = 5000) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.hidden = false;
            setTimeout(() => {
                errorElement.hidden = true;
            }, duration);
        }
    },

    showLoading(button, text = 'Loading...') {
        if (!button) return;
        button.disabled = true;
        button.dataset.originalText = button.textContent;
        button.innerHTML = `${text} <span class="loading"></span>`;
    },

    hideLoading(button) {
        if (!button) return;
        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Submit';
    }
};

// Encryption utilities
const CryptoUtils = {
    async generateKey() {
        return CryptoJS.lib.WordArray.random(32).toString();
    },

    encrypt(text, key) {
        try {
            return CryptoJS.AES.encrypt(text, key).toString();
        } catch (e) {
            console.error('Encryption error:', e);
            throw new Error('Message encryption failed');
        }
    },

    decrypt(encryptedText, key) {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedText, key);
            return bytes.toString(CryptoJS.enc.Utf8);
        } catch (e) {
            console.error('Decryption error:', e);
            return '⚠️ [Unable to decrypt message]';
        }
    }
};

export { Utils, CryptoUtils };