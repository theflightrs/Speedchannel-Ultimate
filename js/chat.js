class Chat {
    constructor(app) {
        this.app = app;
        this.currentChannel = null;
        this.messages = new Map();
        this.messageQueue = [];
        this.isProcessingQueue = false;	
        this.lastMessageTimestamp = 0;
        this.pollingInterval = null;
        this.pollTimeoutId = null
        this.FAST_POLL_RATE = 100;    // 100ms during active chat
        this.SLOW_POLL_RATE = 5000;   // 5s during inactive chat
        this.ACTIVE_DURATION = 60000;  // 60s of fast polling after activity
        this.lastActivityTime = 0;
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
    
        // Handle system messages
        if (message.is_system) {
            try {
                const content = JSON.parse(message.content);
                
                if (content.type === 'user_joined') {
                    messageDiv.innerHTML = `
                        <div class="system-notification">
                            <span class="username">${this.escapeHtml(content.user)}</span> joined the channel
                        </div>`;
                    messageDisplay.appendChild(messageDiv);
                    return;
                }
    
                // Handle knock messages
                if (message.content.includes('is requesting to join')) {
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
                            
                            acceptBtn.onclick = () => this.handleKnockResponse(message.id, true);
                            declineBtn.onclick = () => this.handleKnockResponse(message.id, false);
                            
                            messageDiv.appendChild(knockMessage);
                            messageDisplay.appendChild(messageDiv);
                            return;
                        }
                    } else if (message.sender_id === this.app.currentUser?.id) {
                        messageDiv.innerHTML = `<div class="knock-pending">Your join request is pending...</div>`;
                        messageDisplay.appendChild(messageDiv);
                        return;
                    }
                }
            } catch (e) {
                console.error('Error processing system message:', e);
            }
        }
    
        // Regular message handling
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


    async checkNewMessages(channelId) {
        try {
            const headers = {
                'Cache-Control': 'no-cache',
                'If-Modified-Since': this.lastMessageTimestamp
            };
    
            const response = await this.app.api.get(
                `/messages.php?channel_id=${channelId}&after=${this.lastMessageTimestamp}`, 
                { headers }
            );
            
            if (response.status === 304) { // Not Modified
                return; // No data transfer needed
            }
    
            if (response.success && response.messages.length > 0) {
                this.lastActivityTime = Date.now();
                this.lastMessageTimestamp = Math.max(...response.messages.map(m => new Date(m.created_at).getTime()));
                response.messages.forEach(message => this.addMessageToDisplay(message));
            }
        } catch (error) {
            console.error('Error checking new messages:', error);
        }
    }


    startPolling(channelId) {
        if (this.pollingInterval) this.stopPolling();
        
        const poll = async () => {
            await this.checkNewMessages(channelId);
            
            // Calculate polling rate based on activity
            const timeSinceActivity = Date.now() - this.lastActivityTime;
            const nextPollRate = timeSinceActivity < this.ACTIVE_DURATION 
                ? this.FAST_POLL_RATE 
                : this.SLOW_POLL_RATE;
            
            this.pollingInterval = setTimeout(poll, nextPollRate);
        };

        poll();
    }


    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
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

        // Update lastMessageTimestamp before starting polling
        if (response.messages.length > 0) {
            this.lastMessageTimestamp = Math.max(...response.messages.map(m => new Date(m.created_at).getTime()));
        }

        this.displayMessages(response.messages);
        this.startPolling(channelId);

    } catch (error) {
        console.error('Error loading messages:', error);
        this.app.handleError(error);
    }
}

  
     displayMessages(messages) {
        const messageDisplay = document.getElementById('messageDisplay');
        if (!messageDisplay) return;

        messageDisplay.innerHTML = ''; 

        messages.forEach(message => {
            this.addMessageToDisplay(message); 
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
    this.stopPolling(channelId);
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
        // this.app.chat.currentChannel = channel.id;
        document.getElementById('currentChannelTitle').textContent = `# ${this.escapeHtml(channel.name)}`;
        document.getElementById('channelInfo').hidden = false;
        document.getElementById('channel-controls').hidden = false;

        // Load messages first
        await this.loadMessages(channel.id);
       
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