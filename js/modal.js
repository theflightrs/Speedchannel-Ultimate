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
        if (modalId === 'manageUsersModal') {
            this.app.channels.pollUserLists(); // Start polling when the modal is shown
        }
    }

    hide(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        modal.hidden = true;
        this.activeModals.delete(modalId);
        
        if (this.activeModals.size === 0) {
            this.modalContainer.hidden = true;
        }
        if (modalId === 'manageUsersModal') {
            clearInterval(this.pollingInterval); // Stop polling when the modal is hidden
        }
    }

    hideAll() {
        this.activeModals.forEach(modalId => this.hide(modalId));
        this.activeModals.clear();
        this.modalContainer.hidden = true;
    }
}