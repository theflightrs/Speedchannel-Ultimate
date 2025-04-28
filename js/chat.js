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
        if (message.is_system && message.content.includes('is knocking')) {
            const knockTemplate = document.getElementById('knockMessageTemplate');
            if (knockTemplate) {
                const knockMessage = knockTemplate.content.cloneNode(true);
                knockMessage.querySelector('.user').textContent = message.username;
                const acceptBtn = knockMessage.querySelector('.accept');
                const declineBtn = knockMessage.querySelector('.decline');
                if (acceptBtn) acceptBtn.dataset.knockId = message.id;
                if (declineBtn) declineBtn.dataset.knockId = message.id;
                messageDisplay.appendChild(knockMessage);
                return;
            }
        }

        messageDiv.innerHTML = `
        <div class="message-header">
        <span class="message-author">${this.escapeHtml(message.username || message.sender_username || 'Unknown')}</span>
        <span class="message-time">${this.formatTime(message.created_at)}</span>
        ${message.is_owner || message.is_admin ? '<button class="delete-btn" data-id="'+message.id+'"data-action="open-delete-modal">Delete</button>' : ''}    </div>
    <div class="message-content">${this.escapeHtml(message.content)}</div>
        `;
        messageDisplay.appendChild(messageDiv);
        messageDisplay.scrollTop = messageDisplay.scrollHeight; // Auto-scroll to the bottom
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
            // Fetch channel from centralized source
            const channel = this.app.channels.channels.find(ch => ch.id == channelId);
            if (!channel) throw new Error('Channel not found');
    
            // Handle private channels
            if (channel.is_private) {
                try {
                    const knockResponse = await this.app.api.post('/channel_users.php', {
                        action: 'knock',
                        channel_id: channelId
                    });
                    if (knockResponse.success) {
                        this.app.ui.showMessage('Knock request sent to channel admin');
                        return; // Stop further execution if knock is required
                    }
                } catch (error) {
                    if (error.message !== 'Already a member') {
                        this.app.handleError(error);
                        return;
                    }
                }
            }
    
            // Verify access to the channel
            const accessResponse = await this.app.api.get(`/channels.php?action=verify_access&channel_id=${channelId}`);
            if (!accessResponse.success) throw new Error('Access denied');
    
            // Set the current channel and update UI
            this.currentChannel = channelId;
            document.getElementById('messageInputArea').hidden = false;
            document.getElementById('channelInfo').hidden = false;
            document.getElementById('currentChannelTitle').textContent = channel.name;
    
            // Load messages for the channel
            await this.loadMessages(channelId);
        } catch (error) {
            console.error('Error switching channel:', error);
            this.app.ui.showError(error.message);
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