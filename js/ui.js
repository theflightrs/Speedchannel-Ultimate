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

    showError(message, duration = 5000) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-toast';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);

        setTimeout(() => errorDiv.remove(), duration);
    }

    showSuccess(message, duration = 3000) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-toast';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);

        setTimeout(() => successDiv.remove(), duration);
    }
}

export default UI;