const BASE_URL = window.location.pathname.replace(/\/[^\/]*$/, '');

class ChannelManager {
    constructor(app, autoload = true) {
        this.app = app;
        this.channels = [];
        this.currentChannel = null;

        this.etags = {
            channels: null,
            users: null,
            invitations: null
        };
        this.cache = {
            channels: [],
            users: new Map(),
            availableUsers: new Map(),
            invitations: []
        };


        this.initializeEventListeners();
        this.initializeInvitationEvents(); // Add this line

      //  if (autoload) {
      //      setInterval(() => this.loadPendingInvitations(), 1000);
      //  }
    }

    checkChannelAccess(channel, user) {
        const isAdmin = Boolean(user?.is_admin);
        const isCreator = channel.creator_id === user?.id;
        const isMember = Boolean(channel.is_member);
        return { isAdmin, isCreator, isMember };
    }

     debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    async loadCurrentUser() {
        try {
            const response = await this.app.api.get('/users.php', { action: 'current' });
            if (response.success) {
                this.app.currentUser = response.user;
                console.log('Current user loaded:', this.app.currentUser);
            } else {
                console.warn('Failed to load current user:', response.error);
                this.app.currentUser = null;
            }
        } catch (error) {
            console.error('Error loading current user:', error);
            this.app.currentUser = null;
        }
    }

    initializeEventListeners() {
        const createForm = document.getElementById('createChannelForm');
        const settingsForm = document.getElementById('channelSettingsForm');
        const channelList = document.getElementById('channelList');
        const privateCheckbox = document.getElementById('channelPrivate');
        const manageUsersBtn = document.getElementById('manageUsersBtn');

        if (createForm) {
            createForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleChannelCreation();
            });
        }

        if (settingsForm) {
            settingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveChannelSettings();
            });
        }

        if (channelList) {
            channelList.addEventListener('click', (e) => {
                const channelItem = e.target.closest('.channel-item');
                if (channelItem?.dataset.channelId) {
                    const channelId = channelItem.dataset.channelId;
                    if (channelId !== this.currentChannel) {
                        this.switchChannel(channelId);
                    }
                    e.stopPropagation();
                }
            });
        }

        if (privateCheckbox) {
            privateCheckbox.addEventListener('change', function() {
                const discoverableWrapper = document.getElementById('channelDiscoverable')
                    .closest('.checkbox-wrapper');
                discoverableWrapper.style.display = this.checked ? 'inline-flex' : 'none';
                if (!this.checked) {
                    document.getElementById('channelDiscoverable').checked = true;
                }
            });
        }

        if (manageUsersBtn) {
            manageUsersBtn.addEventListener('click', () => {
                this.app.modalManager.hideAll();
                this.app.modalManager.openModal('manageUsersModal');

                // Use the debounced version of loadChannelUsers
                if (!this.modalLoaded) {
                    this.debounce(() => this.loadChannelUsers(), 300)();
                    this.modalLoaded = true; // Prevent multiple calls
                    
                }
            });
    }

       

       
        document.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            const button = e.target;
            const userId = button.dataset.userId;
        
            if (!action || !userId) return;
        
            if (action === 'add-user') {
                await this.inviteUserToChannel(userId);
                button.textContent = 'Pending';
                button.dataset.action = 'retract-invite';
                button.classList.add('pending-invite');  // Just add pending-invite, keep add-user
            } else if (action === 'retract-invite') {
                await this.retractInvitation(userId);
                button.textContent = 'Add';
                button.dataset.action = 'add-user';
                button.classList.remove('pending-invite');  // Just remove pending-invite
            }
        });
    } // End of initializeEventListeners


    initializeUserEvents() {
     
    
        // Handle "Add User" actions
        document.querySelectorAll('.add-user').forEach(button => {
            button.addEventListener('click', async (e) => {
                const userId = e.target.dataset.userId;
                const action = e.target.dataset.action;
    
                if (action === 'add-user') {
                    await this.app.channels.inviteUserToChannel(userId);
                } else if (action === 'retract-invite') {
                    await this.app.channels.retractInvitation(userId);
                }
            });
        });

       
    }


  

    
    
    updateButtonState(button, isPending) {
        if (!button) return;
        button.textContent = isPending ? 'Pending' : 'Add';
        button.classList.toggle('pending', isPending);
        button.dataset.action = isPending ? 'retract-invite' : 'add-user';
        button.disabled = isPending;
    }
    
    updateAllButtonStates(invitations) {
        const pendingUsers = new Set(invitations.map(inv => inv.recipient_id));
        document.querySelectorAll('.add-user').forEach(button => {
            const userId = button.dataset.userId;
            const isPending = pendingUsers.has(userId);
            this.updateButtonState(button, isPending);
        });
    }

    async handleChannelCreation() {
        const channelName = document.getElementById('channelName').value.trim();
        const isPrivate = document.getElementById('channelPrivate').checked;
        const isDiscoverable = document.getElementById('channelDiscoverable').checked;

        try {
            const response = await this.createChannel({
                name: channelName,
                is_private: isPrivate,
                is_discoverable: isDiscoverable
            });

            if (response.success) {
                this.app.modalManager.hideAll('createChannelModal');
                await this.loadChannels();
                document.getElementById('channelName').value = '';
            }
        } catch (error) {
            this.app.handleError(error);
        }
    }

    async saveChannelSettings() {
        if (!this.app.chat.currentChannel) return;
        
        const name = document.getElementById('editChannelName').value.trim();
        const isPrivate = document.getElementById('editChannelPrivate').checked;
        const isDiscoverable = document.getElementById('editChannelDiscoverable').checked;

        try {
            const response = await this.app.api.post('/channels.php', {
                action: 'update',
                channel_id: this.app.chat.currentChannel,
                name: name,
                is_private: isPrivate,
                is_discoverable: isDiscoverable
            });

            if (response.success) {
                const channel = this.channels.find(ch => ch.id == this.app.chat.currentChannel);
                if (channel) {
                    channel.name = name;
                    channel.is_private = isPrivate;
                    channel.is_discoverable = isDiscoverable;
                    this.renderChannelList();
                }
                this.app.modalManager.hideAll();
            }
        } catch (error) {
            this.app.handleError(error);
        }
    }

    async deleteChannel() {
        if (!this.app.chat.currentChannel) return;
        
        try {
            const response = await this.app.api.post('/channels.php', {
                action: 'delete',
                channel_id: this.app.chat.currentChannel
            });

            if (response.success) {
                this.channels = this.channels.filter(ch => ch.id != this.app.chat.currentChannel);
                this.renderChannelList();
                this.app.modalManager.hideAll();
                this.app.chat.currentChannel = null;
                document.getElementById('currentChannelTitle').textContent = 'No channel selected';
                document.getElementById('channelInfo').hidden = true;
                document.getElementById('messageDisplay').innerHTML = '';
            }
        } catch (error) {
            this.app.handleError(error);
        }
    }

    async loadChannelUsers() {
        try {
            const response = await this.app.api.get(`/channel_users.php?action=list&channel_id=${this.currentChannel}`);
    
            console.log('loadChannelUsers Response:', response);
    
            if (response.success) {
                // Update Current Users List
                const currentUsersList = document.getElementById('channelUsersList');
                if (currentUsersList) {
                    currentUsersList.innerHTML = response.data.users.map(user => {
                        const isCreator = user.is_creator; // Check if the user is the creator
                        const isCurrentUser = user.id === this.app.currentUser?.id; // Check if the user is the current user
    
                        // Don't render the remove button for the creator or the current user
                        const removeButton = (isCreator || isCurrentUser) ? '' : `
                            <button class="remove-user"
                                    data-action="remove-user"
                                    data-user-id="${user.id}">
                                Remove
                            </button>
                        `;
    
                        return `
                            <div class="channel-user" data-user-id="${user.id}">
                                <div class="user-info">
                                    <span>${user.username}</span>
                                    ${user.is_creator ? ' 👑' : ''}
                                    ${user.is_admin ? ' 🛡️' : ''}
                                </div>
                                ${removeButton}
                            </div>
                        `;
                    }).join('');
                }
    
                // Update Available Users List
                const availableList = document.getElementById('availableUsersList');
                if (availableList) {
                    availableList.innerHTML = response.data.available_users.map(user => `
                        <div class="available-user" data-user-id="${user.id}">
                            <div class="user-info">
                                <span>${user.username}</span>
                                ${user.is_admin ? ' 🛡️' : ''}
                            </div>
                            <button class="add-user ${user.pending ? 'pending-invite' : ''}"
                                    data-action="${user.pending ? 'retract-invite' : 'add-user'}"
                                    data-user-id="${user.id}">
                                ${user.pending ? 'Pending' : 'Add'}
                            </button>
                        </div>
                    `).join('');
                }
            }
        } catch (error) {
            console.error('Error loading channel users:', error);
            this.app.handleError(error);
        }
    }

    // js/channels.js
    async removeUserFromChannel(userId) {
        try {
            const response = await this.app.api.post('/channel_users.php', { //Fixed endpoint
                action: 'remove',
                channel_id: this.currentChannel,
                user_id: userId
            });
    
            if (response.success) {
                this.app.ui.showSuccess('User removed successfully');
    
                // Immediately remove the user's element from the list
                const userElement = document.querySelector(`#channelUsersList div[data-user-id="${userId}"]`);
                if (userElement) {
                    userElement.remove();
                }
            }
        } catch (error) {
            this.app.ui.showError(error.message);
        }
    }

    async handleInvitationResponse(messageId, accepted) {
        try {
            const response = await this.app.api.post('/channel_users.php', {
                action: 'invitation_response',
                message_id: messageId,
                accepted: accepted
            });
    
            if (response.success) {
                this.app.ui.showSuccess(accepted ? 'Joined channel' : 'Invitation declined');
                if (accepted) {
                    await this.loadChannels();
                    await this.loadChannelUsers(); // Refresh users list
                }
            }
        } catch (error) {
            this.app.handleError(error);
        }
    }


    

    async createChannel(data) {
        return await this.app.api.post('/channels.php', {
            action: 'create',
            name: data.name,
            is_private: data.is_private,
            is_discoverable: data.is_discoverable
        });
    }

    async loadChannels() {
        const response = await this.app.api.get('/channels.php');
        const spinner = document.querySelector('.spinner');
        try {
            if (response.success) {
                this.channels = response.channels || [];
                console.log('Loaded channels:', this.channels);
                this.renderChannelList();
                if (spinner) {
                    spinner.style.display = 'none';
                }
            } else {
                if (response.error === "Not authenticated") {
                    this.channels = [];
                    return;
                }
                console.error('Failed to load channels:', response.error);
                this.app.ui.showError('Failed to load channels');
            }
        } catch (error) {
            if (error.message === "Not authenticated") {
                this.channels = [];
                return;
            }
            console.error('Error loading channels:', error);
            this.app.handleError(error);
        }
    }

    renderChannelList() {
        const list = document.getElementById('channelList');
        if (!list) return;
    
        list.innerHTML = this.channels
            .map(ch => {
                if (!ch || !ch.id) return '';
    
                const isAdmin = this.app.currentUser?.is_admin;
                const isCreator = ch.creator_id === this.app.currentUser?.id;
                const lockIcon = ch.is_private && !ch.has_access ? '🔒' : '';
                const creatorBadge = isCreator ? ' 👑' : '';
                const adminBadge = isAdmin && !isCreator ? ' 🛡️' : '';
    
                // Fixing template literal syntax
                return `
                    <div class="channel-item" 
                        data-channel-id="${ch.id}"
                        data-is-private="${ch.is_private ? 'true' : 'false'}"
                        data-is-creator="${isCreator ? 'true' : 'false'}"
                        data-is-admin="${isAdmin ? 'true' : 'false'}"
                        data-action="switch-channel">
                        ${this.escapeHtml(ch.name)} ${lockIcon}${creatorBadge}${adminBadge}
                    </div>
                `;
            })
            .filter(html => html)
            .join('');
    }

    clearChannels() {
        console.log("Clearing local channels display.");
        this.channels = [];
        this.currentChannel = null;
        this.renderChannelList();

        const currentChannelTitle = document.getElementById('currentChannelTitle');
        if (currentChannelTitle) {
            currentChannelTitle.textContent = 'No channel selected';
            document.getElementById('channel-controls').hidden = true;
            document.getElementById('messageInputArea').hidden = true;
            document.getElementById('channelSettingsBtn').disabled = true;
            document.getElementById('manageUsersBtn').disabled = true;
        }
    }

    

    async switchChannel(channelId) {
        console.log(`Attempting to switch to channel ${channelId}`);

        try {
            if (!channelId || !this.app?.currentUser) {
                console.error('Cannot switch channel: missing channel ID or user');
                return;
            }

            const channel = this.channels.find(ch => ch.id === parseInt(channelId));
            if (!channel) {
                console.error('Channel not found');
                return;
            }

            const isAdmin = this.app.currentUser?.is_admin;
            const isCreator = channel.creator_id === this.app.currentUser?.id;
            const isMember = Boolean(channel.is_member);

            if (channel.is_private && !isAdmin && !isCreator && !isMember) {
                const knockResponse = await this.app.api.post('/channel_users.php', {
                    action: 'knock',
                    channel_id: channelId,
                    type: 'knock',
                    user_id: this.app.currentUser.id  // Add user_id
                });
        
                if (knockResponse.success) {
                 //   this.app.ui.showMessage('Request sent to channel creator');
                    return;
                }
            }

            document.getElementById("messageInputArea").style.display = "block";
            this.app.modalManager.hideAll();
            this.currentChannel = channel.id;
            this.app.chat.currentChannel = channel.id;
            document.getElementById('currentChannelTitle').textContent = `# ${this.escapeHtml(channel.name)}`;
            document.getElementById('channelInfo').hidden = false;
            document.getElementById('channel-controls').hidden = false;

            const settingsButton = document.getElementById('channelSettingsBtn');
            const manageUsersButton = document.getElementById('manageUsersBtn');
            settingsButton.disabled = !(isAdmin || isCreator);
            manageUsersButton.disabled = !(isAdmin || isCreator);

            if (isCreator || isAdmin) {
                await this.checkPendingKnocks(channelId);
            }

            await this.app.chat.loadMessages(channel.id);
        } catch (error) {
            console.error('Channel switch error:', error);
            this.app.handleError(error);
        }
    }

    async checkPendingKnocks(channelId) {
        if (!channelId) return;

        try {
            const params = new URLSearchParams({
                type: 'knock',
                channel_id: channelId
            });

            const response = await this.app.api.get(`/messages.php?${params.toString()}`);
            if (response.success && response.messages?.length > 0) {
                response.messages.forEach(message => {
                    this.app.chat.addMessageToDisplay(message);
                });
            }
        } catch (error) {
            console.error('Error checking knocks:', error);
        }
    }

    initializeInvitationEvents() {
        // Add event listener to the document for invitation responses
        document.addEventListener('click', async (e) => {
            const button = e.target;
            if (!button.matches('[data-action="accept-invitation"], [data-action="decline-invitation"]')) {
                return;
            }
    
            const messageId = button.dataset.messageId;
            if (!messageId) return;
    
            const accepted = button.dataset.action === 'accept-invitation';
            await this.handleInvitationResponse(messageId, accepted);
            
            // Remove the invitation item from the list
            const invitationItem = button.closest('.invitation-item');
            if (invitationItem) {
                invitationItem.remove();
            }
    
            // Reload channels if accepted
            if (accepted) {
                await this.loadChannels();
            }
        });
    }


    async inviteUserToChannel(userId) {
        try {
            await this.app.api.post('/channel_users.php', {
                action: 'invite',
                channel_id: this.currentChannel,
                user_id: userId
            });
    
            // Update button immediately
            const button = document.querySelector(`button[data-user-id="${userId}"]`);
            if (button) {
                button.textContent = 'Pending';
                button.dataset.action = 'retract-invite';
                button.classList.add('pending');
                button.disabled = false;
            }
        } catch (error) {
            this.app.handleError(error);
        }
    }

    async loadPendingInvitations() {
        
        try {
              if (this.app.currentUser) { // Only poll if user is authenticated
            const response = await this.app.api.get('/channel_users.php?action=list_invites');
            if (response.success && response.invitations) { 
                
              
                    this.renderInvitationsList(response.invitations);
                }

                
            }
        } catch (error) {
            console.error('Error loading invitations:', error);
        }
    }


    async retractInvitation(userId) {
        try {
            await this.app.api.post('/channel_users.php', {
                action: 'retract_invite',
                channel_id: this.currentChannel,
                user_id: userId
            });
    
            // Update button immediately, don't wait for refresh
            const button = document.querySelector(`button[data-user-id="${userId}"]`);
            if (button) {
                button.textContent = 'Add';
                button.dataset.action = 'add-user';
                button.classList.remove('pending');
                button.disabled = false;
            }
        } catch (error) {
            this.app.handleError(error);
        }
    }


renderInvitationsList(invitations) {
    const list = document.getElementById('invitationList');
    if (!list) return;
    
    list.innerHTML = invitations.map(inv => `
        <div class="invitation-item" data-message-id="${inv.id}">
           <div class="chanName">${this.escapeHtml(inv.channel_name)}</div><br>
            <div class="invitation-buttons"> 
                <button class="accept-invite" data-action="accept-invitation" data-message-id="${inv.id}">Accept</button>
                <button class="decline-invite" data-action="decline-invitation" data-message-id="${inv.id}">Decline</button>
            </div>
        </div>
    `).join('') || '<p class="no-invites">No pending invitations</p>';
}


async pollUserLists() {
    const manageUsersModal = document.getElementById('manageUsersModal');
    if (!manageUsersModal || manageUsersModal.style.display !== 'block') return;

    try {
        const channelId = this.currentChannel;
        if (!channelId) return;

        const headers = {};
        if (this.lastEtag) {
            headers['If-None-Match'] = this.lastEtag;
        }

        const response = await this.app.api.get(
            `/channel_users.php?action=list&channel_id=${channelId}`,
            { headers }
        );

        if (response.status === 304) return; // No changes

        if (response.success) {
            await this.loadChannelUsers();
            this.lastEtag = response.headers?.get('ETag');
        }
    } catch (error) {
        console.error('Error polling user lists:', error);
    }
}

async pollChannels() {
    try {
        const headers = this.etags.channels ? { 'If-None-Match': this.etags.channels } : {};
        const response = await this.app.api.get('/channels.php', { headers });

        if (response.status === 304) return; // No changes

        if (response.success) {
            this.channels = response.channels || [];
            this.renderChannelList();
            this.etags.channels = response.headers?.get('ETag');
        }
    } catch (error) {
        console.error('Error polling channels:', error);
    }
}


async pollInvitations() {
    const headers = this.etags.invitations ? { 'If-None-Match': this.etags.invitations } : {};
    
    const response = await this.app.api.get('/channel_users.php?action=list_invites', { headers });
    if (response.status === 304) return;

    if (response.success && response.invitations) {
        if (this.hasInvitationsChanged(response.invitations)) {
            this.cache.invitations = response.invitations;
            this.renderInvitationsList(response.invitations);
        }
        this.etags.invitations = response.headers?.get('ETag');
    }
}

hasChannelsChanged(newChannels) {
    return JSON.stringify(this.sortAndSimplify(this.cache.channels)) !== 
           JSON.stringify(this.sortAndSimplify(newChannels));
}

hasInvitationsChanged(newInvitations) {
    return JSON.stringify(this.cache.invitations) !== JSON.stringify(newInvitations);
}


async pollUpdates() {
    if (!this.app.currentUser) return;

    try {
        // 1. Poll Channels
        await this.pollChannels();

        // 2. Poll User Lists (only if in a channel)
        if (this.currentChannel) {
            await this.pollUserLists();
        }

        // 3. Poll Invitations
        await this.pollInvitations();
        
    } catch (error) {
        console.error('Error in polling updates:', error);
    }
}

hasUserListsChanged(newUsers, newAvailableUsers) {
    // Compare with cached data
    const changesInUsers = this.hasArrayChanged(
        Array.from(this.userListsCache.channelUsers.values()),
        newUsers
    );
    
    const changesInAvailable = this.hasArrayChanged(
        Array.from(this.userListsCache.availableUsers.values()),
        newAvailableUsers
    );

    return changesInUsers || changesInAvailable;
}

hasArrayChanged(oldArray, newArray) {
    if (oldArray.length !== newArray.length) return true;
    
    return JSON.stringify(this.sortAndSimplify(oldArray)) !== 
           JSON.stringify(this.sortAndSimplify(newArray));
}

sortAndSimplify(users) {
    // Create a simplified version of users for comparison
    return users
        .map(u => ({
            id: u.id,
            username: u.username,
            is_online: u.is_online
        }))
        .sort((a, b) => a.id - b.id);
}


updateUserList(containerId, users) {
    const container = document.querySelector(containerId);
    if (!container) return;

    // Different templates for each list
    if (containerId === '#channelUsersList') {
        container.innerHTML = users.map(user => `
            <div class="channel-user" data-user-id="${user.id}">
                <div class="user-info">
                    <span>${user.username}</span>
                    ${user.is_creator ? ' 👑' : ''}
                    ${user.is_admin ? ' 🛡️' : ''}
                </div>
                <button class="remove-user" data-action="remove-user" data-user-id="${user.id}">
                    Remove
                </button>
            </div>
        `).join('');
    } else if (containerId === '#availableUsersList') {
        container.innerHTML = users.map(user => `
            <div class="available-user" data-user-id="${user.id}">
                <div class="user-info">
                    <span>${user.username}</span>
                    ${user.is_admin ? ' 🛡️' : ''}
                </div>
                <button class="add-user ${user.pending ? 'pending-invite' : ''}"
                        data-action="${user.pending ? 'retract-invite' : 'add-user'}"
                        data-user-id="${user.id}">
                    ${user.pending ? 'Pending' : 'Add'}
                </button>
            </div>
        `).join('');
    }

    // Reattach event listeners
    this.initializeUserEvents();
}

    escapeHtml(unsafe) {
        if (typeof unsafe !== "string") return "";
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

export default ChannelManager;