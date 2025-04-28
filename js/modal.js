class ModalManager {
    constructor() {
        this.activeModals = new Set();
        this.modalContainer = document.getElementById('modalContainer');
    }

    show(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        this.modalContainer.hidden = false;
        modal.hidden = false;
        this.activeModals.add(modalId);
        
        modal.style.zIndex = 1000 + this.activeModals.size;
    }

    hide(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.hidden = true;
        this.activeModals.delete(modalId);
        
        if (this.activeModals.size === 0) {
            this.modalContainer.hidden = true;
        }
    }

    hideAll() {
        this.activeModals.forEach(modalId => this.hide(modalId));
        this.activeModals.clear();
        this.modalContainer.hidden = true;
    }
}