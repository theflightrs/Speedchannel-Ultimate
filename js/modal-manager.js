class ModalManager {
    constructor() {
        this.overlay = document.querySelector('.modal-overlay');
        if (this.overlay) this.overlay.style.display = 'none'; // Ensure the overlay is initially hidden
    }

    // Open a specific modal
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.hidden = false; // Remove hidden attribute
            modal.style.display = 'block'; // Ensure modal is visible
            if (this.overlay) this.overlay.style.display = 'block'; // Show the overlay
        } else {
            console.warn(`Modal with ID '${modalId}' not found.`);
        }
    }

    // Close a specific modal
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.hidden = true; // Add hidden attribute
            modal.style.display = 'none'; // Hide the modal
            if (this.overlay) this.overlay.style.display = 'none'; // Hide the overlay
        }
    }

    // Close all modals
    hideAll() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.hidden = true; // Add hidden attribute
            modal.style.display = 'none'; // Ensure modal is hidden
        });

        if (this.overlay) {
            this.overlay.style.display = 'none'; // Hide the overlay
        }
    }
}

export default ModalManager;