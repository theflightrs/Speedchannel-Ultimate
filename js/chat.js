class Chat {
    constructor(app) {
        this.app = app;
        this.currentChannel = null;
        this.autoRefreshInterval = null;
        this.messages = new Map();
        this.messageQueue = [];
        this.isProcessingQueue = false;	
		this.addMessageToDisplay = this.addMessageToDisplay.bind(this);
    }

    async init() {
        this.initializeEventListeners();
        document.getElementById('messageInputArea').hidden = true;
        document.getElementById('messageDisplay').innerHTML = '<div class="no-channel-message">Select a channel to start chatting</div>';
        
       
    }

    initializeEventListeners() {
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        const sendButton = document.getElementById('sendMessageBtn');
        if (sendButton) {
            sendButton.addEventListener('click', () => this.sendMessage());
        }


       // Event listener for the delete button in messages
document.addEventListener('click', (event) => {
    if (event.target.classList.contains('delete-btn')) {
        const messageId = event.target.dataset.id;

        // Store the message ID for deletion
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        confirmDeleteBtn.dataset.id = messageId;

        // Open confirmation modal
        modalManager.show('confirmDeleteModal');
    }
});

// Event listener for the delete confirmation button in the modal
document.getElementById('confirmDeleteBtn').addEventListener('click', async (event) => {
    const messageId = event.target.dataset.id; // Retrieve message ID from the button's dataset

    try {
        // Perform the delete action
        const response = await fetch(`./api/messages.php?id=${messageId}`, { method: 'DELETE' });
        const result = await response.json();

        if (result.success) {
            document.querySelector(`.delete-btn[data-id="${messageId}"]`).closest('.message').remove(); // Remove the message from UI
        } else {
            alert(result.error || 'Failed to delete message.');
        }
    } catch (error) {
        console.error('Error deleting message:', error);
    } finally {
        modalManager.hide('confirmDeleteModal'); // Close modal regardless of result
    }
});

      

    }

   


      // Start automatic refreshing of messages
      startAutoRefresh(channelId) {
        if (this.autoRefreshInterval) clearInterval(this.autoRefreshInterval);
    
        this.autoRefreshInterval = setInterval(async () => {
            console.log(`Refreshing messages for channel: ${channelId}`);



/*
            try {
                await fetch('./api/messages.php?action=deleteOld', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}) // No need to send 'age' if default is set in PHP
                });
            } catch (error) {
                console.error('Error during auto-delete:', error);
            }
*/


            await this.loadMessages(channelId);
  
        }, 3000); // Refresh Timer
    }

    

    // Stop automatic refreshing
    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }


    async deleteMessage(messageId, action = 'manual-delete') {
        try {
            const response = await fetch(`./api/messages.php?action=${action}&id=${messageId}`, { method: 'DELETE' });
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Unknown error');
           await this.loadMessages(this.currentChannel);
           this.app.modalManager.hideAll(); // Close the modal

            console.log('Delete result:', result.message);
        } catch (error) {
            console.error('Error deleting message:', error.message);
        }
    }

    
    addMessageToDisplay(message) {
        const messageDisplay = document.getElementById('messageDisplay');
        if (!messageDisplay) return;
    
        const messageDiv = document.createElement('div');
        messageDiv.className = message.is_system ? 'message system-message' : 'message';
    
        // Handle knock messages
      // In addMessageToDisplay method:
  // In addMessageToDisplay method:
if (message.is_system && message.content.includes('is requesting to join')) {
    // Only show knock requests to channel creator or admin
    const channel = this.app.channels.channels.find(ch => ch.id == this.currentChannel);
    const isCreator = channel?.creator_id === this.app.currentUser?.id;
    const isAdmin = this.app.currentUser?.is_admin;

    if (isCreator || isAdmin) {
        const knockTemplate = document.getElementById('knockMessageTemplate');
        if (knockTemplate) {
            const knockMessage = knockTemplate.content.cloneNode(true);
            knockMessage.querySelector('.user').textContent = message.username || message.sender_username;
            
            const acceptBtn = knockMessage.querySelector('.accept');
            const declineBtn = knockMessage.querySelector('.decline');
            
            // In the message creation/display code
             acceptBtn.onclick = () => this.handleKnockResponse(message.id, true);
            declineBtn.onclick = () => this.handleKnockResponse(message.id, false);
            
            messageDiv.appendChild(knockMessage);
            messageDisplay.appendChild(messageDiv);
            return;
        }
    } else {
        // For non-creators, just show their own knock requests
        if (message.sender_id === this.app.currentUser?.id) {
            messageDiv.innerHTML = `<div class="knock-pending">Your join request is pending...</div>`;
            messageDisplay.appendChild(messageDiv);
        }
        return;
    }
}
    
        // Regular message handling (your existing code)
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-author">${this.escapeHtml(message.username || message.sender_username || 'Unknown')}</span>
                <span class="message-time">${this.formatTime(message.created_at)}</span>
                ${message.is_owner || message.is_admin ? '<button class="delete-btn" data-id="'+message.id+'"data-action="open-delete-modal">Delete</button>' : ''}
            </div>
            <div class="message-content">${this.escapeHtml(message.content)}</div>
        `;
        messageDisplay.appendChild(messageDiv);
        messageDisplay.scrollTop = messageDisplay.scrollHeight;
    }


    async handleKnockResponse(messageId, accepted) {
        try {
            const response = await this.app.api.post('/channel_users.php', {
                action: 'knock_response',
                knock_id: messageId,  // Use the actual messageId parameter
                accepted: accepted
            });
    
            if (response.success) {
                // Remove the knock message from display
                const knockMessage = document.querySelector(`[data-message-id="${messageId}"]`);
                if (knockMessage) {
                    knockMessage.remove();
                }
                // Refresh messages
                await this.loadMessages(this.currentChannel);
            }
        } catch (error) {
            this.app.handleError(error);
        }
    }

    async loadMessages(channelId) {
        console.log(`Loading messages for channel ${channelId}`);
    
        try {
            const response = await this.app.api.get(`/messages.php?channel_id=${channelId}`);

            
            if (!response.success) {
                throw new Error(response.error || 'Failed to load messages');
            }
    
            this.displayMessages(response.messages);
          //  this.startAutoRefresh(channelId);
            
        } catch (error) {
            console.error('Error loading messages:', error);
            this.app.handleError(error);
        }
    }

     // Add this method
     displayMessages(messages) {
        const messageDisplay = document.getElementById('messageDisplay');
        if (!messageDisplay) return;

        messageDisplay.innerHTML = ''; // Clear the current messages

        messages.forEach(message => {
            this.addMessageToDisplay(message); // Use the existing method
        });
    }

    async sendMessage() {
        if (!this.currentChannel || !this.app.currentUser) {
            this.app.ui.showError("Please select a channel and ensure you're logged in");
            return;
        }
    
        const messageInput = document.getElementById('messageInput');
        const content = messageInput.value.trim();
    
        if (!content) {
            this.app.ui.showError("Message cannot be empty");
            return;
        }
    
        if (this.messageQueue.length >= 5) {
            this.app.ui.showError("Please wait before sending more messages");
            return;
        }
    
        try {
            this.messageQueue.push({
                channel_id: this.currentChannel,
                content: content,
                timestamp: Date.now()
            });
    
            const response = await this.app.api.post('/messages.php', {
                channel_id: this.currentChannel,
                content: content
            });
    
            if (response.success) {
                messageInput.value = '';
                await this.loadMessages(this.currentChannel); // Refresh messages after sending
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.app.ui.showError('Failed to send message');
        } finally {
            setTimeout(() => this.messageQueue.shift(), 1000);
        }
    }

    async switchChannel(channelId) {
    console.log(`Switching to channel ${channelId}`);
    if (!channelId) return;

    try {
        const channel = this.app.channels.channels.find(ch => ch.id == channelId);
        if (!channel) throw new Error('Channel not found');

        // Handle private channels first, before access check
        if (channel.is_private) {
            const isCreator = channel.creator_id === this.app.currentUser?.id;
            const isAdmin = this.app.currentUser?.is_admin;
            const isMember = Boolean(channel.is_member);

            if (!isCreator && !isAdmin && !isMember) {
                try {
                    const knockResponse = await this.app.api.post('/channel_users.php', {
                        action: 'knock',
                        channel_id: channelId
                    });
                    if (knockResponse.success) {
                        this.app.ui.showMessage('Knock request sent to channel admin');
                        return; // Stop here - don't try to access the channel
                    }
                } catch (error) {
                    if (error.message === 'Already a member') {
                        // Continue with channel access
                    } else {
                        this.app.handleError(error);
                        return;
                    }
                }
            }
        }

        document.getElementById("messageInputArea").style.display = "block";
        this.app.modalManager.hideAll();
        this.currentChannel = channel.id;
        this.app.chat.currentChannel = channel.id;
        document.getElementById('currentChannelTitle').textContent = `# ${this.escapeHtml(channel.name)}`;
        document.getElementById('channelInfo').hidden = false;
        document.getElementById('channel-controls').hidden = false;

        // Load messages first
        await this.app.chat.loadMessages(channel.id);

        // Then set up UI controls and check knocks
        const settingsButton = document.getElementById('channelSettingsBtn');
        const manageUsersButton = document.getElementById('manageUsersBtn');
        settingsButton.disabled = !(isAdmin || isCreator);
        manageUsersButton.disabled = !(isAdmin || isCreator);

        if (isCreator || isAdmin) {
            await this.checkPendingKnocks(this.currentChannel);
        }
    } catch (error) {
        console.error('Channel switch error:', error);
        this.app.handleError(error);
    }
}
    clearMessages() {
        const messageDisplay = document.getElementById('messageDisplay');
        if (messageDisplay) {
            messageDisplay.innerHTML = '';
        }
    }

    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    formatTime(timestamp) {
        const date = new Date(timestamp); // Parse UTC timestamp
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); // Convert to local time
    }
}

export default Chat;