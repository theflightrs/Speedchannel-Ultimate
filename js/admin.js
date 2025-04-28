import { Utils } from './utils.js';
import Api from './api.js';

class AdminPanel {
    constructor(app) {
		this.app = app;
        this.currentTab = 'features';
        this.lastUpdate = '2025-04-20';
        this.currentUser = 'user';
        this.refreshInterval = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Feature toggles
        document.querySelectorAll('.feature-toggles input').forEach(toggle => {
            toggle.addEventListener('change', () => this.updateFeatureState(toggle));
        });

        // Session management
        document.getElementById('sessionSearch').addEventListener('input', 
            Utils.debounce(() => this.loadSessions(), 300)
        );
        document.getElementById('sessionSort').addEventListener('change', 
            () => this.loadSessions()
        );

        // User search
        document.getElementById('userSearchInput').addEventListener('input',
            Utils.debounce(() => this.searchUsers(), 300)
        );
        ['userRole', 'userStatus', 'sortBy'].forEach(id => {
            document.getElementById(id).addEventListener('change', () => this.searchUsers());
        });

        // Activity logs
        document.getElementById('logDate').addEventListener('change', () => this.loadLogs());
        document.getElementById('logType').addEventListener('change', () => this.loadLogs());
        document.getElementById('logSeverity').addEventListener('change', () => this.loadLogs());
    }

    show() {
        document.getElementById('adminPanel').hidden = false;
        this.loadInitialData();
        this.startAutoRefresh();
    }

    hide() {
        document.getElementById('adminPanel').hidden = true;
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
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        document.querySelectorAll('.tab-content').forEach(content => {
            content.hidden = !content.id.includes(tabName);
        });

        this.currentTab = tabName;
        this.loadTabData(tabName);
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
            const response = await Api.request('/admin/features.php');
            const features = response.data.features;

            // Update toggle states
            document.getElementById('sessionManagement').checked = features.session_management;
            document.getElementById('userSearch').checked = features.user_search;
            document.getElementById('activityLogging').checked = features.activity_logging;

            // Load initial tab data
            this.loadTabData(this.currentTab);
        } catch (error) {
            console.error('Failed to load admin features:', error);
        }
    }

    async updateFeatureState(toggle) {
        const feature = toggle.id;
        const enabled = toggle.checked;

        try {
            await Api.request('/admin/features.php', {
                method: 'POST',
                body: JSON.stringify({
                    feature,
                    enabled
                })
            });
        } catch (error) {
            console.error('Failed to update feature state:', error);
            toggle.checked = !enabled; // Revert toggle state
            Utils.showError('adminError', 'Failed to update feature settings');
        }
    }

    async loadSessions() {
        const search = document.getElementById('sessionSearch').value;
        const sort = document.getElementById('sessionSort').value;

        try {
            const response = await Api.request(`/sessions.php?search=${encodeURIComponent(search)}&sort=${sort}`);
            const sessions = response.data.sessions;

            const sessionsList = document.getElementById('sessionsList');
            sessionsList.innerHTML = sessions.map(session => `
                <div class="session-item ${session.is_current ? 'current' : ''}">
                    <div class="session-info">
                        <div class="session-user">
                            <span class="username">${Utils.escapeHtml(session.username)}</span>
                            ${session.is_admin ? '<span class="admin-badge">Admin</span>' : ''}
                        </div>
                        <div class="session-details">
                            <span class="browser">${session.browser_info.browser} on ${session.browser_info.platform}</span>
                            <span class="ip-address">${session.ip_address}</span>
                            <span class="last-active">Last active: ${Utils.formatTime(session.last_activity)}</span>
                        </div>
                    </div>
                    ${!session.is_current ? `
                        <button class="terminate-btn" onclick="adminPanel.terminateSession('${session.session_id}')">
                            Terminate
                        </button>
                    ` : ''}
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load sessions:', error);
            Utils.showError('adminError', 'Failed to load active sessions');
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
        const search = document.getElementById('userSearchInput').value;
        const role = document.getElementById('userRole').value;
        const status = document.getElementById('userStatus').value;
        const sort = document.getElementById('sortBy').value;

        try {
            const response = await Api.request(
                `/user_search.php?q=${encodeURIComponent(search)}&role=${role}&status=${status}&sort=${sort}`
            );
            const { users, pagination } = response.data;

            const resultsDiv = document.getElementById('userSearchResults');
            resultsDiv.innerHTML = users.map(user => `
                <div class="user-card ${!user.is_active ? 'inactive' : ''}">
                    <div class="user-info">
                        <div class="user-header">
                            <span class="username">${Utils.escapeHtml(user.username)}</span>
                            ${user.is_admin ? '<span class="admin-badge">Admin</span>' : ''}
                            ${!user.is_active ? '<span class="inactive-badge">Inactive</span>' : ''}
                        </div>
                        <div class="user-stats">
                            <span>Channels: ${user.channel_count}</span>
                            <span>Messages: ${user.message_count}</span>
                            <span>Joined: ${Utils.formatTime(user.created_at)}</span>
                            <span>Last Login: ${user.last_login ? Utils.formatTime(user.last_login) : 'Never'}</span>
                        </div>
                    </div>
                    <div class="user-actions">
                        <button onclick="adminPanel.editUser(${user.id})">Edit</button>
                        ${user.id !== this.currentUser ? `
                            <button class="danger" onclick="adminPanel.deleteUser(${user.id})">Delete</button>
                        ` : ''}
                    </div>
                </div>
            `).join('');

            this.renderPagination(pagination);
        } catch (error) {
            console.error('Failed to search users:', error);
            Utils.showError('adminError', 'Failed to search users');
        }
    }

    async loadLogs() {
        const date = document.getElementById('logDate').value;
        const type = document.getElementById('logType').value;
        const severity = document.getElementById('logSeverity').value;

        try {
            const response = await Api.request(
                `/activity_logs.php?date=${date}&type=${type}&severity=${severity}`
            );
            const { logs, pagination } = response.data;

            const logsDiv = document.getElementById('activityLogs');
            logsDiv.innerHTML = logs.map(log => `
                <div class="log-entry ${log.severity}">
                    <div class="log-header">
                        <span class="log-time">${Utils.formatTime(log.created_at)}</span>
                        <span class="log-user">${Utils.escapeHtml(log.username || 'System')}</span>
                        <span class="log-type">${log.type}</span>
                        <span class="log-severity">${log.severity}</span>
                    </div>
                    <div class="log-action">${Utils.escapeHtml(log.action)}</div>
                    <div class="log-details">
                        <pre>${JSON.stringify(log.details, null, 2)}</pre>
                    </div>
                </div>
            `).join('');

            this.renderPagination(pagination);
        } catch (error) {
            console.error('Failed to load logs:', error);
            Utils.showError('adminError', 'Failed to load activity logs');
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
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            await Api.request(`/users.php?id=${userId}`, {
                method: 'DELETE'
            });
            this.searchUsers();
        } catch (error) {
            console.error('Failed to delete user:', error);
            Utils.showError('adminError', 'Failed to delete user');
        }
    }
}

export default AdminPanel;