class UserManager {
    constructor(app) {
        this.app = app;
        this.initTime = new Date('2025-04-20 19:49:26');
        this.currentUser = 'You';
        this.users = new Map();
        this.activeUsers = new Set();
        
		this.initializeEventListeners();
    }

    initializeEventListeners() {
        // User list updates
        const userList = document.getElementById('userList');
        if (userList) {
            userList.addEventListener('click', (e) => {
                const userItem = e.target.closest('[data-user-id]');
                if (userItem) {
                    this.handleUserClick(userItem.dataset.userId);
                }
            });
        }

        // User search in admin panel
        const userSearchInput = document.getElementById('userSearchInput');
        if (userSearchInput) {
            userSearchInput.addEventListener('input', this.debounce(() => {
                this.searchUsers(userSearchInput.value);
            }, 300));
        }

        // User filters in admin panel
        document.querySelectorAll('#userRole, #userStatus, #sortBy').forEach(select => {
            select.addEventListener('change', () => {
                this.applyUserFilters();
            });
        });

        // Manage users modal
        document.getElementById('manageUsersBtn')?.addEventListener('click', () => {
            this.showManageUsers();
        });
    }

   async loadUsers() {
    try {
        this.app.log('[Users] Starting loadUsers...');
        
        if (!this.app.api) {
            this.app.log('[Users] API not available, cannot load users.', 'error');
            return;
        }

        const response = await this.app.api.get('/users.php?action=list');
        
        if (response && response.success && Array.isArray(response.users)) {
            this.users.clear();
            response.users.forEach(user => {
                this.users.set(user.id, user);
            });
            this.app.log(`[Users] Successfully loaded ${this.users.size} users.`);
            
            this.renderUserList();
        } else {
            const errorMsg = response?.error || 'Invalid response format';
            throw new Error(`Failed to load users: ${errorMsg}`);
        }
    } catch (error) {
        this.app.log(`[Users] Error in loadUsers: ${error.message}`, 'error');
        console.error('User loading error:', error);
    }
}


clearUsers() {
    console.log("Clearing local users display.");
    this.users.clear(); // Clear the users Map
    this.activeUsers.clear(); // Clear the active users Set

    const userListElement = document.getElementById('userList');
    if (userListElement) {
        userListElement.innerHTML = ''; // Clear the user list UI
    }

    const userListTitle = document.getElementById('userListTitle');
    if (userListTitle) {
        userListTitle.textContent = 'Users'; // Reset the title
    }
}


  clearChannels() {
        console.log("Clearing local channels display.");
        this.channels = [];
        this.currentChannel = null;
        this.renderChannelList();

        const currentChannelTitle = document.getElementById('currentChannelTitle');
        if (currentChannelTitle) {
            currentChannelTitle.textContent = 'Select a Channel';
        }

        const msgInputArea = document.getElementById('messageInputArea');
        if (msgInputArea) msgInputArea.hidden = true;
    }


// Add or update the renderUserList method
renderUserList() {
    const userListElement = document.getElementById('userList');
    if (!userListElement) return;
    
    let userListHTML = '';
    this.users.forEach(user => {
        const isOnline = user.is_online ? 'online' : 'offline';
        userListHTML += `
            <li data-user-id="${user.id}" class="user-item ${isOnline}">
                <span class="user-name">${this.escapeHtml(user.username)}</span>
                ${user.is_online ? '<span class="online-indicator"></span>' : ''}
            </li>
        `;
    });
    
    if (userListHTML === '') {
        userListHTML = '<li>No users found.</li>';
    }
    
    userListElement.innerHTML = userListHTML;
}




   async showManageUsers() {
    try {
        const channelId = this.app.channelManager.currentChannel;
        if (!channelId) return;

        const response = await this.app.api.get(`/channels.php?action=users&channel_id=${channelId}`);
        if (response.success) {
            this.updateManageUsersContent(response.users);
            this.app.modalManager.show('manageUsersModal');
        }
    } catch (error) {
        this.app.ui.showError('Failed to load channel users');
    }
}

updateManageUsersContent(users) {
    const userList = document.querySelector('#manageUsersModal .user-list');
    if (!userList) return;
    
    userList.innerHTML = users.map(user => `
        <div class="user-item" data-user-id="${user.id}">
            <span class="user-name">${this.escapeHtml(user.username)}</span>
            <select class="user-role" data-user-id="${user.id}">
                <option value="member" ${user.role === 'member' ? 'selected' : ''}>Member</option>
                <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>Moderator</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
            <button class="remove-user" data-user-id="${user.id}">Remove</button>
        </div>
    `).join('');
    this.initializeUserControls();
}

    renderManageUsersModal(users) {
        const modalContent = document.querySelector('#manageUsersModal .modal-content');
        if (!modalContent) return;

        modalContent.innerHTML = `
            <h2>Manage Channel Users</h2>
            <div class="user-list">
                ${users.map(user => `
                    <div class="user-item" data-user-id="${user.id}">
                        <span class="user-name">${this.escapeHtml(user.username)}</span>
                        <select class="user-role" data-user-id="${user.id}">
                            <option value="member" ${user.role === 'member' ? 'selected' : ''}>Member</option>
                            <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>Moderator</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                        <button class="remove-user" data-user-id="${user.id}">Remove</button>
                    </div>
                `).join('')}
            </div>
            <div class="add-user-section">
                <input type="text" id="addUserInput" placeholder="Username">
                <button id="addUserBtn">Add User</button>
            </div>
            <div class="modal-buttons">
                <button data-action="close-modal">Close</button>
            </div>
        `;

        // Add event listeners for the new elements
        this.initializeManageUsersEvents();
    }

    initializeManageUsersEvents() {
        const modal = document.getElementById('manageUsersModal');
        if (!modal) return;

        // Role change handling
        modal.querySelectorAll('.user-role').forEach(select => {
            select.addEventListener('change', async (e) => {
                const userId = e.target.dataset.userId;
                const newRole = e.target.value;
                await this.updateUserRole(userId, newRole);
            });
        });

        // Remove user handling
        modal.querySelectorAll('.remove-user').forEach(button => {
            button.addEventListener('click', async (e) => {
                const userId = e.target.dataset.userId;
                await this.removeUserFromChannel(userId);
            });
        });

        // Add user handling
        const addUserBtn = modal.querySelector('#addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', async () => {
                const username = modal.querySelector('#addUserInput').value;
                await this.addUserToChannel(username);
            });
        }
    }

    async updateUserRole(userId, newRole) {
        try {
            const response = await this.app.api.post('/channels.php', {
                action: 'update_role',
                channel_id: this.app.channelManager.currentChannel,
                user_id: userId,
                role: newRole
            });

            if (response.success) {
                this.app.ui.showSuccess('User role updated');
            }
        } catch (error) {
            this.app.ui.showError(error.message);
        }
    }

    async removeUserFromChannel(userId) {
        try {
            const response = await this.app.api.post('/channels.php', {
                action: 'remove_user',
                channel_id: this.app.channelManager.currentChannel,
                user_id: userId
            });

            if (response.success) {
                this.app.ui.showSuccess('User removed from channel');
                await this.showManageUsers(); // Refresh the modal
            }
        } catch (error) {
            this.app.ui.showError(error.message);
        }
    }

    async addUserToChannel(username) {
        try {
            const response = await this.app.api.post('/channels.php', {
                action: 'add_user',
                channel_id: this.app.channelManager.currentChannel,
                username: username
            });

            if (response.success) {
                this.app.ui.showSuccess('User added to channel');
                await this.showManageUsers(); // Refresh the modal
            }
        } catch (error) {
            this.app.ui.showError(error.message);
        }
    }


   


    updateUserList(users) {
        const userListElement = document.getElementById('userList');
        users.forEach(user => {
            const userItem = document.querySelector(`[data-user-id="${user.id}"]`);
            if (userItem) {
                userItem.className = `user-item ${user.is_online ? 'online' : 'offline'}`;
            } else {
                // Add new user if not present
                userListElement.innerHTML += `
                    <li data-user-id="${user.id}" class="user-item ${user.is_online ? 'online' : 'offline'}">
                        <span class="user-name">${user.username}</span>
                        ${user.is_online ? '<span class="online-indicator"></span>' : ''}
                    </li>`;
            }
        });
    }


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

export default UserManager;