import { Utils } from './utils.js';
import Api from './api.js';

class AdminPanel {
    constructor(app) {
        this.app = app;
        this.app.admin = this;
        this.api = app.api;
        this.currentTab = 'features';
        this.refreshInterval = null;

        this.searchUsers = this.searchUsers.bind(this);
        this.loadSessions = this.loadSessions.bind(this);
        this.loadLogs = this.loadLogs.bind(this);

        window.adminSearchUsers = this.searchUsers;

        document.addEventListener('click', (e) => {
            console.log('Click detected on:', e.target);
        });

        setTimeout(() => this.initializeEventListeners(), 0);
    }


    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    initializeEventListeners() {
        const tabsContainer = document.querySelector('.admin-tabs');
        if (!tabsContainer) {
            console.error('Admin tabs container not found');
            return;
        }
    
        // Single event listener for tabs using event delegation
        tabsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (btn) {
                console.log('Tab clicked:', btn.dataset.tab);
                this.switchTab(btn.dataset.tab);
            }
        });
    
        // Feature toggles
        document.querySelectorAll('.feature-toggles input')?.forEach(toggle => {
            toggle.addEventListener('change', () => this.updateFeatureState(toggle));
        });
    
        // Add optional chaining for all event listeners
        document.getElementById('sessionSearch')?.addEventListener('input', 
            Utils.debounce(() => this.loadSessions(), 300)
        );
        
        document.getElementById('sessionSort')?.addEventListener('change', 
            () => this.loadSessions()
        );  
       
    
        ['userRole', 'userStatus', 'sortBy'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.searchUsers());
        });
    
        ['logDate', 'logType', 'logSeverity'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.loadLogs());
        });

        document.getElementById('userSearchInput')?.addEventListener('input',
        Utils.debounce(() => window.adminSearchUsers(), 300)
    );

    
        
    }

    

    show() {
        this.loadInitialData();
        this.startAutoRefresh();
    }

    hide() {
        this.stopAutoRefresh();
    }

    startAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            if (this.currentTab === 'sessions') {
                this.loadSessions();
            }
        }, 30000); // Refresh every 30 seconds
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }


  switchTab(tabName) {
    console.log('Switching to tab:', tabName); // Debug helper
    
    // Update current tab
    this.currentTab = tabName;
    

    // Show/hide tab content sections
    document.querySelectorAll('.tab-content').forEach(content => {
        content.hidden = content.id !== `${tabName}Tab`;
    });

    // Load tab data
    this.loadTabData(tabName);
}

async loadFeatures() {
    try {
        const response = await this.app.api.get('/settings.php');
        console.log('Features response:', response); // Debug

        if (response.success) {
            // Update toggles based on config
            const features = {
                'sessionManagement': response.data.features.session_management,
                'userSearch': response.data.features.user_search,
                'activityLogging': response.data.features.activity_logging
            };

            Object.entries(features).forEach(([elementId, enabled]) => {
                const toggle = document.getElementById(elementId);
                if (toggle) {
                    toggle.checked = enabled;
                }
            });
        }
    } catch (error) {
        this.app.ui.showError('Failed to load features');
        console.error('Failed to load features:', error);
    }
}

    loadTabData(tabName) {
        switch (tabName) {
            case 'sessions':
                this.loadSessions();
                break;
            case 'search':
                this.searchUsers();
                break;
            case 'logs':
                this.loadLogs();
                break;
        }
    }

    async loadInitialData() {
        try {
            const response = await this.app.api.get('/settings.php');
            if (!response.success) throw new Error('Failed to load settings');
            
            const features = response.data.features;
            Object.entries(features).forEach(([id, enabled]) => {
                const toggle = document.getElementById(id);
                if (toggle) toggle.checked = enabled;
            });
    
            this.loadTabData(this.currentTab);
        } catch (error) {
            this.app.ui.showError('Failed to load admin settings');
            console.error(error);
        }
    }

    async updateFeatureState({ id, checked }) {
        try {
            const response = await this.app.api.post('/settings.php', { // Instead of '/settings.php'
                action: 'update_feature',
                feature: id,
                enabled: checked
            });
            if (!response.success) throw new Error('Update failed');
        } catch (error) {
            this.app.ui.showError('Failed to update feature');
            // Revert toggle
            const toggle = document.getElementById(id);
            if (toggle) toggle.checked = !checked;
        }
    }

    async loadSessions() {
        try {
            const response = await this.app.api.get('/sessions.php', {
                search: document.getElementById('sessionSearch')?.value || '',
                sort: document.getElementById('sessionSort')?.value || 'last_activity'
            });
            console.log('Sessions response:', response);
    
            const sessionsList = document.getElementById('sessionsList');
            if (!sessionsList) return;
    
            if (!response.success) throw new Error(response.message);
            
            // Render sessions list using the class's own escapeHtml method
            sessionsList.innerHTML = response.data.map(session => `
                <div class="session-item ${session.is_current ? 'current' : ''}">
                    <div class="session-info">
                        <span class="username">${this.escapeHtml(session.username)}</span>
                        <span class="browser">${session.browser}</span>
                        <span class="ip">${session.ip_address}</span>
                        <span class="last-active">Last active: ${new Date(session.last_activity).toLocaleString()}</span>
                    </div>
                    ${!session.is_current ? `
                        <button class="terminate-btn" data-session-id="${session.id}">Terminate</button>
                    ` : ''}
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load sessions:', error);
            this.app.ui.showError('Failed to load sessions');
        }
    }

    async terminateSession(sessionId) {
        if (!confirm('Are you sure you want to terminate this session?')) {
            return;
        }

        try {
            await Api.request(`/sessions.php?id=${sessionId}`, {
                method: 'DELETE'
            });
            this.loadSessions();
        } catch (error) {
            console.error('Failed to terminate session:', error);
            Utils.showError('adminError', 'Failed to terminate session');
        }
    }

    async searchUsers() {
        try {
            const params = new URLSearchParams({
                q: document.getElementById('userSearchInput')?.value?.trim() || '',
                role: document.getElementById('userRole')?.value || '',
                status: document.getElementById('userStatus')?.value || '',
                sort: document.getElementById('sortBy')?.value || 'username'
            });
    
            const response = await this.app.api.get(`user_search.php?${params.toString()}`);
            if (!response.success) throw new Error(response.message);
            
            const resultsDiv = document.getElementById('userSearchResults');
            if (resultsDiv && response.data?.users) {
                resultsDiv.innerHTML = response.data.users.map(user => {
                    const isCurrentUser = user.id === this.app.currentUser?.id;
                    
                    return `
                        <div class="channel-user" data-user-id="${user.id}">
                            <div class="user-info">
                                <span>${this.escapeHtml(user.username)}</span>
                                <span class="status ${user.is_active ? 'active' : 'inactive'}">
                                    ${user.is_active ? '●' : '○'}
                                </span>
                                ${user.is_admin ? ' 🛡️' : ''}
                            </div>
                            ${!isCurrentUser ? `
                                <div class="user-actions">
                                    <button class="remove-user" 
                                            data-action="toggle-ban"
                                            data-user-id="${user.id}">
                                        ${user.is_banned ? 'Unban' : 'Ban'}
                                    </button>
                                    <button class="remove-user" 
                                            data-action="delete-user"
                                            data-user-id="${user.id}">
                                        Delete
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('');
    
            resultsDiv.addEventListener('click', async (e) => {
                const button = e.target.closest('button');
                if (!button) return;

                const userId = button.dataset.userId;
                const action = button.dataset.action;

                switch (action) {
                    case 'delete-user':
                        if (await this.confirmDelete(userId)) {
                            await this.deleteUser(userId);
                        }
                        break;
                    case 'toggle-ban':
                        await this.toggleUserBan(userId);
                        break;
                }
            });
            }
        } catch (error) {
            console.error('Failed to search users:', error);
            this.app.ui.showError('Failed to search users');
        }
    }

    async confirmDelete(userId) {
        return confirm('Are you sure you want to delete this user? This action cannot be undone.');
    }
    
    async loadLogs() {
        const logsDiv = document.getElementById('activityLogs');
        if (!logsDiv) return;
    
        try {
            const response = await this.app.api.get('/activity_logs.php', {
                date: document.getElementById('logDate')?.value || '',
                type: document.getElementById('logType')?.value || '',
                severity: document.getElementById('logSeverity')?.value || ''
            });
    
            if (!response.success) {
                if (response.error?.includes('disabled')) {
                    logsDiv.innerHTML = `
                        <div class="feature-disabled">
                            <p>Activity logging is currently disabled.</p>
                            <p>Enable it in the Features tab first.</p>
                        </div>`;
                    return;
                }
                throw new Error(response.message || 'Failed to load logs');
            }
            
            logsDiv.innerHTML = response.data.logs.map(log => `
                <div class="log-entry ${log.severity}">
                    <div class="log-time">${new Date(log.timestamp).toLocaleString()}</div>
                    <div class="log-info">${this.escapeHtml(log.message)}</div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load logs:', error);
            this.app.ui.showError(error.message);
        }
    }
    
    renderPagination(pagination) {
        const { current_page, total_pages, total_results } = pagination;
        
        // Create pagination controls...
        // (Implementation depends on your UI design)
    }

    async editUser(userId) {
        // Implement user edit modal...
    }

    async deleteUser(userId) {
        try {
            const response = await this.app.api.post('user_search.php', {
                action: 'delete',
                user_id: userId
            });
    
            if (response.success) {
                await this.searchUsers(); // Refresh the list
            } else {
                throw new Error(response.message || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Failed to delete user:', error);
            this.app.ui.showError('Failed to delete user');
        }
    }
    
    async toggleUserBan(userId) {
        try {
            const response = await this.app.api.post('user_search.php', {
                action: 'toggle_ban',
                user_id: userId
            });
    
            if (response.success) {
                await this.searchUsers(); // Refresh the list
            } else {
                throw new Error(response.message || 'Failed to toggle user ban status');
            }
        } catch (error) {
            console.error('Failed to toggle user ban:', error);
            this.app.ui.showError('Failed to toggle user ban status');
        }
    }
}

export default AdminPanel;