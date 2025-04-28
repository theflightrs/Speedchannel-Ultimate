const BASE_URL = window.location.pathname.replace(/\/[^\/]*$/, '');

class ChannelManager {
    constructor(app, autoload = true) {
        this.app = app;
        this.channels = [];
        this.currentChannel = null;
        this.initializeEventListeners();
    }

    
    checkChannelAccess(channel, user) {
        const isAdmin = Boolean(user?.is_admin);
        const isCreator = channel.creator_id === user?.id;
        const isMember = Boolean(channel.is_member);
    
        return { isAdmin, isCreator, isMember };
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
            privateCheckbox.addEventListener('change', function () {
                const discoverableWrapper = document.getElementById('channelDiscoverable')
                    .closest('.checkbox-wrapper');
                discoverableWrapper.style.display = this.checked ? 'inline-flex' : 'none';
                if (!this.checked) {
                    document.getElementById('channelDiscoverable').checked = true;
                }
            });
        }
    }



    
    setupChannelCreation() {
        const createForm = document.getElementById('createChannelForm');
        if (createForm) {
            createForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleChannelCreation();
            });
        }
    }

    setupChannelSettings() {
        const settingsForm = document.getElementById('channelSettingsForm');
        if (settingsForm) {
            settingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveChannelSettings();
            });
        }
    }

    setupChannelList() {
        const channelList = document.getElementById('channelList');
        if (channelList) {
            channelList.addEventListener('click', (e) => {
                const channelItem = e.target.closest('.channel-item');
                if (channelItem?.dataset.channelId) {
                    const channelId = channelItem.dataset.channelId;
                    console.log(`Switching to channel ID: ${channelId}`);
                    this.switchChannel(channelId); // Ensure channelId is passed here
                } else {
                    console.warn('Channel ID missing in clicked element.');
                }
            });
        }
    }

    setupPrivateCheckbox() {
        const privateCheckbox = document.getElementById('channelPrivate');
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
                document.getElementById('channelInfo').hidden = true;
                document.getElementById('messageDisplay').innerHTML = '';
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
                // Silently fail if not authenticated
                if (response.error === "Not authenticated") {
                    this.channels = [];
                    return;
                }
                console.error('Failed to load channels:', response.error);
                this.app.ui.showError('Failed to load channels');
            }
        } catch (error) {
            // Silently fail if not authenticated
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
                const channelIcon = ch.is_private ? '🔒' : '';
                const creatorBadge = isCreator ? ' 👑' : '';
                const adminBadge = isAdmin && !isCreator ? ' 🛡️' : '';
    
                return `
                    <div class="channel-item" 
                         data-channel-id="${ch.id}"
                         data-is-private="${ch.is_private ? 'true' : 'false'}"
                         data-is-creator="${isCreator ? 'true' : 'false'}"
                         data-is-admin="${isAdmin ? 'true' : 'false'}"
                         data-action="switch-channel">
                        ${this.escapeHtml(ch.name)} ${channelIcon}${creatorBadge}${adminBadge}
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
    
            document.getElementById("messageInputArea").style.display = "block";
            this.app.modalManager.hideAll();
            this.currentChannel = channel.id; // Ensure channelId is stored
            this.app.chat.currentChannel = channel.id;
            document.getElementById('currentChannelTitle').textContent = `# ${this.escapeHtml(channel.name)}`;
            document.getElementById('channelInfo').hidden = false;
            document.getElementById('channel-controls').hidden = false;
    
            // Enable or disable buttons based on roles
            const settingsButton = document.getElementById('channelSettingsBtn');
            const manageUsersButton = document.getElementById('manageUsersBtn');
            settingsButton.disabled = !(isAdmin || isCreator);
            manageUsersButton.disabled = !(isAdmin || isCreator);
    
            editChannelPrivate.checked = channel.is_private;
            editChannelDiscoverable.checked = channel.is_discoverable;
            document.getElementById('editChannelName').value = channel.name;
    
            await this.app.chat.loadMessages(channel.id); // Pass channelId
        } catch (error) {
            console.error('Channel switch error:', error);
            this.app.handleError(error);
        }
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