class Chat {
    constructor(app) {
        this.app = app;
        this.currentChannel = null;
        this.messages = new Map();
        this.messageQueue = [];
        this.isProcessingQueue = false;	
        this.lastMessageTimestamp = 0;
      //  this.pollingInterval = null;
      //  this.pollTimeoutId = null

    /* Polling: Accelerates polling, if a message was received, for
       a certain duration (ACTIVE_DURATION), then throttles it down.
       Creates more efficiency for users who rely on mobile data etc. */

      //  this.FAST_POLL_RATE = 1000;    // ms during active chat
      //  this.SLOW_POLL_RATE = 5000;   // ms during inactive chat
      //  this.ACTIVE_DURATION = 30000;  // ms of fast polling after activity
    

        this.lastActivityTime = 0;
		this.addMessageToDisplay = this.addMessageToDisplay.bind(this);

        this.imageLoadQueue = [];
    this.isProcessingImageQueue = false;
    
    this.imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    this.imageLoadQueue.push(img);
                    this.imageObserver.unobserve(img);
                    if (!this.isProcessingImageQueue) {
                        this.processImageQueue();
                    }
                }
            }
        });
    }, {
        root: document.getElementById('messageDisplay'),
        rootMargin: '50px'
    });
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



      
// End of EventListeners

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
        // Keep system message handling
        if (message.type === 'invitation' || (message.is_system && !message.encrypted_content)) {
            return;
        }
        const messageDisplay = document.getElementById('messageDisplay');
        if (!messageDisplay) return;
    
        const messageDiv = document.createElement('div');
        messageDiv.className = message.is_system ? 'message system-message' : 'message';
    
        // Handle knock requests
        if (message.is_system && message.content.includes('is requesting to join')) {
            this.handleKnockMessage(message, messageDiv, messageDisplay);
            return;
        }
    
        // Handle regular system messages
        if (message.is_system) {
            messageDiv.innerHTML = `<div class="system-notification">${this.escapeHtml(message.content)}</div>`;
            messageDisplay.appendChild(messageDiv);
            return;
        }
    
        // Add file_id check and display
        const fileContent = message.files?.length ? `
        <div class="message-files">
            ${message.files.map(file => this.getFileDisplay(file)).join('')}
        </div>
        ` : '';
    
        // Regular message handling with files
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-author">${this.escapeHtml(message.username || message.sender_username || 'Unknown')}</span>
                <span class="message-time">${this.formatTime(message.created_at)}</span>
                ${message.is_owner || message.is_admin ? '<button class="delete-btn" data-id="'+message.id+'"data-action="open-delete-modal">Delete</button>' : ''}
            </div>
            <div class="message-content">${this.escapeHtml(message.content)}</div>
            ${fileContent}
        `;
        
        messageDisplay.appendChild(messageDiv);
    
        // Initialize lazy loading for new images
        const lazyImages = messageDiv.querySelectorAll('img[data-src]');
        lazyImages.forEach(img => {
            if (this.imageObserver) {
                this.imageObserver.observe(img);
            }
        });
    
        messageDisplay.scrollTop = messageDisplay.scrollHeight;
    }


initializeImageObserver() {
    this.imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            }
        });
    }, {
        root: document.getElementById('messageDisplay'),
        rootMargin: '50px',
        threshold: 0.1
    });
}


getFileDisplay(file) {
    if (!file) return '';

    const isImage = file.mime_type?.startsWith('image/');
    
    if (isImage) {
        const imgPath = `./api/files.php?path=${encodeURIComponent(file.stored_name)}`;
        // Use data-src for lazy loading
        return `<img 
            src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
            data-src="${imgPath}"
            class="message-image lazy" 
            onclick="app.chat.showLightbox('${file.stored_name}')"
            data-action="open-lightbox">`;
    } else {
        return `
            <div class="file-icon" data-file-id="${file.id}" 
                 onclick="app.modalManager.show({
                     title: 'Download File',
                     content: 'Do you want to download \"${this.escapeHtml(file.original_name)}\"?',
                     buttons: [{
                         text: 'Download',
                         class: 'primary',
                         callback: () => window.location.href = './api/files.php?action=download&id=${file.id}'
                     }, {
                         text: 'Cancel',
                         class: 'secondary'
                     }]
                 })">
                <span class="icon">${this.getFileIcon(file.mime_type)}</span>
                <span class="filename">${this.escapeHtml(file.original_name)}</span>
            </div>`;
    }
}


    getFileIcon(mimeType) {
        const icons = {
            'audio/': '🎵',
            'image/': '🖼️',
            'video/': '🎥',
            'application/pdf': '📄',
            'text/': '📝',
            'application/zip': '📦',
            'application/x-rar': '📦',
            'application/x-7z-compressed': '📦'
        };
        return Object.entries(icons).find(([key]) => mimeType?.startsWith(key))?.[1] || '📎';
    }

    getFileIcon(mimeType) {
        const icons = {
            'audio/': '🎵',
            'image/': '🖼️',
            'video/': '🎥',
            'application/pdf': '📄',
            'text/': '📝',
            'application/zip': '📦',
            'application/x-rar': '📦',
            'application/x-7z-compressed': '📦'
        };
        return Object.entries(icons).find(([key]) => mimeType?.startsWith(key))?.[1] || '📎';
    }
    getFileIcon(mimeType) {
        const icons = {
            'audio/': '🎵',
            'image/': '🖼️',
            'video/': '🎥',
            'application/pdf': '📄',
            'text/': '📝',
            'application/zip': '📦',
            'application/x-rar': '📦',
            'application/x-7z-compressed': '📦'
        };
        return Object.entries(icons).find(([key]) => mimeType?.startsWith(key))?.[1] || '📎';
    }


    showLightbox(storedName) {
        this.app.modalManager.show({
            title: '',
            content: `<div class="lightbox-image"><img src="./api/files.php?path=${storedName}"></div>`,
            size: 'large'
        });
    }


    handleKnockMessage(message, messageDiv, messageDisplay) {
        const channel = this.app.channels.channels.find(ch => ch.id == this.currentChannel);
        const isCreator = channel?.creator_id === this.app.currentUser?.id;
        const isAdmin = this.app.currentUser?.is_admin;
    
        if (isCreator || isAdmin) {
            const knockTemplate = document.getElementById('knockMessageTemplate');
            if (knockTemplate) {
                const knockMessage = knockTemplate.content.cloneNode(true);
                knockMessage.firstElementChild.setAttribute('data-message-id', message.id);
                knockMessage.querySelector('.user').textContent = message.username || message.sender_username;
                
                // Set the message ID as data attribute
                const messageElement = knockMessage.querySelector('.knock-message');
                
                if (messageElement) {
                    messageElement.dataset.messageId = message.id;
                }
                
                const acceptBtn = knockMessage.querySelector('.accept');
                const declineBtn = knockMessage.querySelector('.decline');
                
                acceptBtn.onclick = () => this.handleKnockResponse(message.id, true);
                declineBtn.onclick = () => this.handleKnockResponse(message.id, false);
                
                messageDiv.innerHTML = ''; 
                messageDiv.appendChild(knockMessage);
            }
        } else if (message.sender_id === this.app.currentUser?.id) {
            messageDiv.innerHTML = `<div class="knock-request knock-pending" data-message-id="${message.id}">Your join request is pending...</div>`;
        }
        
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

async handleKnockResponse(messageId, accepted) {
    try {
        const response = await this.app.api.post('/channel_users.php', {
            action: 'knock_response',
            knock_id: messageId,
            accepted: accepted ? 1 : 0  // Ensure boolean is sent as 1/0
        });

        if (response.success) {
            // Remove knock message
            const knockMessage = document.querySelector(`[data-message-id="${messageId}"]`);
            if (knockMessage) {
                const messageContainer = knockMessage.closest('.message');
                if (messageContainer) {
                    messageContainer.remove();
                }
            }

            if (accepted) {
                // Refresh channel data
                await this.app.channels.loadChannels();
                // Refresh messages
                await this.loadMessages(this.currentChannel);
            }
        }
    } catch (error) {
        console.error('Knock response error:', error);
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
      //  this.startPolling(channelId);

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

    async processImageQueue() {
        if (this.isProcessingImageQueue || this.imageLoadQueue.length === 0) return;
        
        this.isProcessingImageQueue = true;
        
        while (this.imageLoadQueue.length > 0) {
            const img = this.imageLoadQueue.shift();
            if (img && img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                // Wait 100ms between each image load
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        this.isProcessingImageQueue = false;
    }

    async sendMessage() {
        const sendButton = document.getElementById('sendMessageBtn');
        if (sendButton.disabled) return; // Prevent double submission
        
        if (!this.currentChannel || !this.app.currentUser) {
            this.app.ui.showError("Please select a channel and ensure you're logged in");
            return;
        }
    
        const messageInput = document.getElementById('messageInput');
        const content = messageInput.value.trim();
        const hasFiles = this.app.fileManager.pendingFiles.size > 0;
    
        if (!content && !hasFiles) {
            this.app.ui.showError("Message or file required");
            return;
        }
    
        if (this.messageQueue.length >= 5) {
            this.app.ui.showError("Please wait before sending more messages");
            return;
        }
    
        try {
            // Disable the send button
            sendButton.disabled = true;
    
            this.messageQueue.push({
                channel_id: this.currentChannel,
                content: content,
                hasFiles: hasFiles,
                timestamp: Date.now()
            });
    
            // Send single message first
            const messageResponse = await this.app.api.post('/messages.php', {
                channel_id: this.currentChannel,
                content: content || ' ', // Use space for file-only messages
                hasFiles: hasFiles
            });
    
            // Upload all files for this message
            if (messageResponse.success && hasFiles) {
                await this.app.fileManager.uploadFiles(messageResponse.message_id);
            }
    
            messageInput.value = '';
            this.app.fileManager.clearAttachments();
        } catch (error) {
            console.error('Error sending message:', error);
            this.app.ui.showError('Failed to send message');
        } finally {
            await this.loadMessages(this.currentChannel);
            setTimeout(() => this.messageQueue.shift(), 1000);
            // Re-enable the send button after 1 second
            setTimeout(() => {
                sendButton.disabled = false;
            }, 1000);
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
                    //    this.app.ui.showMessage('Knock request sent to channel admin');
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