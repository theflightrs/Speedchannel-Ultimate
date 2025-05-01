import AdminPanel from './admin.js';
import Api from './api.js';
import Auth from './auth.js';
import ChannelManager from './channels.js';
import Chat from './chat.js';
import UI from './ui.js';
import UserManager from './users.js';
import FileManager from './files.js';
import ModalManager from './modal-manager.js';

class App {
    constructor() {
        try {
            this.debug = true;
            this.api = new Api();
            this.ui = new UI(this);
            this.currentUser = null;

            this.modalManager = new ModalManager();
            this.auth = new Auth(this);
            this.channels = new ChannelManager(this);
            this.chat = new Chat(this);
            this.userManager = new UserManager(this);
            this.fileManager = new FileManager(this);

            this.log('Application initialized successfully');

            if (this.currentUser?.is_admin) {
                this.admin = new AdminPanel(this);
            }

            this.setupErrorHandling();
            this.setupEventDelegation();

        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.handleError(error);
        }
    }

    async initializeAfterAuth(userData) {
        try {
            this.currentUser = userData;

            await Promise.all([
                this.userManager.loadUsers(),
                this.channels.loadChannels()
            ]);

            this.modalManager.hide('loginModal');
            document.getElementById('chatInterface').hidden = false;

        } catch (error) {
            console.error('Post-auth initialization failed:', error);
            this.handleError(error);
        }
    }

    async init() {
        const spinner = document.getElementById('spinner');
        if (spinner) spinner.style.display = 'block';
    
        try {
            const userResponse = await this.api.get('/users.php', { action: 'current' });
            if (userResponse.success && userResponse.user) {
                this.currentUser = userResponse.user;
                AuthState.getInstance().setAuthState(true, userResponse.user);
                
                // Set channel title if no channel is selected
                if (!this.channels.currentChannel) {
                    document.getElementById('currentChannelTitle').textContent = 'No channel selected';
                    document.getElementById('channelInfo').hidden = false;
                }
                
                await Promise.all([
                    this.userManager.loadUsers(),
                    this.channels.loadChannels(),
                    document.getElementById('userDisplay').textContent = userResponse.user.username,
                ]);
            }
        } catch (error) {
            if (error.message !== "Not authenticated") {
                console.error('Failed to initialize:', error);
            }
            AuthState.getInstance().setAuthState(false);
        } finally {
            if (spinner) spinner.style.display = 'none';
        }
    }

    setupEventDelegation() {
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            e.preventDefault();
            const action = target.dataset.action;

            try {
                switch (action) {
                    case 'switch-channel':
                        const channelId = target.dataset.channelId;
                        if (channelId) {
                            this.channels.switchChannel(channelId);
                        } else {
                            console.warn('Channel ID missing in switch-channel action');
                        }
                        break;

                    case 'login':
                        this.auth.handleLogin();
                        break;

                    case 'register':
                        this.auth.handleRegister();
                        break;

                    case 'toggle-auth':
                        this.auth.toggleAuthForm(target.dataset.form);
                        break;

                    case 'logout':
                        this.auth.logout();
                        this.handleLogout();
                        break;

                    case 'delete-channel':
                        this.modalManager.openModal('deleteChannelConfirmModal');
                        break;

                    case 'confirm-delete-channel':
                        this.channels.deleteChannel();
                        break;

                    case 'show-channel-settings':
                        if (this.chat.currentChannel) {
                            const currentChannel = this.channels.channels.find(ch => ch.id == this.chat.currentChannel);
                            if (currentChannel) {
                                document.getElementById('editChannelName').value = currentChannel.name;
                                document.getElementById('editChannelPrivate').checked = currentChannel.is_private;
                                this.modalManager.hideAll();
                                this.modalManager.openModal('channelSettingsModal');
                            }
                        } else {
                            this.ui.showError('Please select a channel first');
                        }
                        break;

                    case 'save-channel-settings':
                        this.channels.saveChannelSettings({ preventDefault: () => {} });
                        break;

                    case 'manage-users':
                        this.modalManager.hideAll();
                        this.modalManager.openModal('manageUsersModal');
                        break;

                    case 'close-modal':
                        this.modalManager.hideAll();
                        break;

                    case 'show-modal':
                        const modalId = target.dataset.modalId;
                        if (modalId) {
                            this.modalManager.openModal(modalId);
                        }
                        break;

                    case 'create-channel':
                        this.modalManager.hideAll();
                        this.modalManager.openModal('createChannelModal');
                        break;

                    case 'attach-file':
                        this.fileManager.triggerFileInput();
                        break;

                    case 'send-message':
                        if (this.chat.currentChannel) {
                            this.chat.sendMessage();
                        } else {
                            this.ui.showError('No channel selected');
                        }
                        break;
                    
                    case 'open-delete-modal':
                        const messageId = target.dataset.id;
                        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
                        confirmDeleteBtn.dataset.id = messageId;
                        this.modalManager.openModal('confirmDeleteModal');
                        break;

                    case 'manual-delete':
                        const deleteMessageId = target.dataset.id;
                        if (deleteMessageId) {
                            this.chat.deleteMessage(deleteMessageId);
                        } else {
                            console.warn('Message ID is missing for manual-delete action');
                        }
                        break;

                    default:
                        console.warn('Unhandled action:', action);
                }
            } catch (error) {
                console.error('Error handling action:', action, error);
                this.handleError(error);
            }
        });

        document.addEventListener('submit', (e) => {
            const form = e.target;

            try {
                switch (form.id) {
                    case 'loginFormElement':
                        this.auth.handleLogin();
                        break;

                    case 'registerFormElement':
                        this.auth.handleRegister();
                        break;

                    case 'createChannelForm':
                        break;

                    default:
                        console.warn('Unhandled form submission:', form.id);
                }
            } catch (error) {
                console.error('Error handling form submission:', form.id, error);
                this.handleError(error);
            }
        });

        document.addEventListener('keydown', (e) => {
            const messageInput = document.getElementById('messageInput');
            if (e.key === 'Enter' && !e.shiftKey && document.activeElement === messageInput) {
                e.preventDefault();
                if (this.chat.currentChannel) {
                    this.chat.sendMessage();
                } else {
                    this.ui.showError('No channel selected');
                }
            }
        });
    }

    handleLogout() {
        this.log('Ensuring complete logout...');
        if (this.chat) {
            this.chat.currentChannel = null;
        }

        if (this.ui?.showLoginForm) {
            this.ui.showLoginForm();
        }

        setTimeout(() => {
            if (this.ui?.showLoginForm) {
                this.ui.showLoginForm();
            }
        }, 100);
    }

    setupErrorHandling() {
        window.onerror = (msg, url, lineNo, columnNo, error) => {
            this.handleError(error || msg);
            return false;
        };

        window.onunhandledrejection = (event) => {
            this.handleError(event.reason);
        };
    }

    handleError(error) {
        console.error('Application error:', error);
        this.ui.showError(error.message || 'An unexpected error occurred');
    }

    log(message, level = 'info') {
        if (this.debug || level === 'error') {
            console[level](`[${new Date().toISOString()}] ${message}`);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init();
});

export default App;