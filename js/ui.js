class UI {
        constructor(app) {
            this.app = app;
            this.authState = AuthState.getInstance();
            // Only listen for auth state changes, don't manage them
            this.authState.addListener(this.updateAuthState.bind(this));
    }

    
    // Keep all your existing methods unchanged
    initializeEventListeners() {
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.dataset.tab;
                this.switchAdminTab(tabName);
            });
        });

        document.querySelectorAll('.feature-toggles input[type="checkbox"]').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                this.handleFeatureToggle(e.target.id, e.target.checked);
            });
        });
    }
    
    handleFeatureToggle(featureId, enabled) {
        try {
            switch(featureId) {
                case 'sessionManagement':
                    this.app.api.post('/settings.php', {
                        feature: 'session_management',
                        enabled: enabled
                    });
                    break;
                    
                case 'userSearch':
                    this.app.api.post('/settings.php', {
                        feature: 'user_search',
                        enabled: enabled
                    });
                    break;
                    
                case 'activityLogging':
                    this.app.api.post('/settings.php', {
                        feature: 'activity_logging',
                        enabled: enabled
                    });
                    break;
            }
            
            this.showSuccess(`${featureId} has been ${enabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
            this.showError(`Failed to update ${featureId}`);
            document.getElementById(featureId).checked = !enabled;
        }
    }

    initializeToggles() {
        if (!document.querySelector('.feature-toggles')) return;
        
        this.app.api.get('/settings.php')
            .then(response => {
                if (response.success) {
                    for (const [feature, enabled] of Object.entries(response.settings)) {
                        const toggle = document.getElementById(feature);
                        if (toggle) {
                            toggle.checked = enabled;
                        }
                    }
                }
            })
            .catch(() => {/* Silently fail toggle initialization */});
    }

    showLoginForm() {
        this.authState.setAuthState(false);
    }

    updateAuthState(isAuthenticated, user) {
        const elements = {
            'sidebar': isAuthenticated,
            'chatInterface': isAuthenticated,
            'loginForm': !isAuthenticated,
            'modalContainer': !isAuthenticated
        };

        Object.entries(elements).forEach(([id, visible]) => {
            const element = document.getElementById(id) || document.querySelector(`.${id}`);
            if (element) {
                element.style.display = visible ? 'block' : 'none';
            }
        });

        // Update auth button
        const authButton = document.getElementById('logoutBtn');
        if (authButton) {
            authButton.textContent = isAuthenticated ? 'Logout' : 'Login';
            authButton.onclick = isAuthenticated ? 
                () => this.app.auth.logout() : 
                () => this.authState.setAuthState(false);
        }
    }

    toggleAdminPanel() {
        const adminPanel = document.getElementById('adminPanel');
        adminPanel.hidden = !adminPanel.hidden;
    }

    switchAdminTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.hidden = true);
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        
        document.getElementById(`${tabName}Tab`).hidden = false;
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    showModalMessage(message) {
        document.getElementById('messageModalText').textContent = message;
        this.app.modalManager.show('messageModal');
    }


    showModalMessage(message) {
        this.app.modalManager.hideAll();

        document.getElementById('messageModalText').textContent = message;
        this.app.modalManager.show('messageModal');
    }

    // Toast for notifications that auto-dismiss
    showToast(message, type = 'error', duration = 5000) {
        const toastDiv = document.createElement('div');
        toastDiv.className = `toast ${type}-toast`;
        toastDiv.textContent = message;
        document.body.appendChild(toastDiv);

        setTimeout(() => toastDiv.remove(), duration);
    }

    // Helper methods for specific types
    showError(message, isModal = false) {
        this.app.modalManager.hideAll();
        isModal ? this.showModalMessage(message) : this.showToast(message, 'error');
    }

    showSuccess(message) {
        this.showToast(message, 'success', 3000);
    }

}

export default UI;