// Argument Diffuser Web Application
class ArgumentDiffuserApp {
    constructor() {
        this.currentSessionId = null;
        this.selectedTemplate = null;
        this.socket = null;
        this.initializeApp();
    }

    async initializeApp() {
        this.setupEventListeners();
        await this.loadTemplates();
        this.setupSocketConnection();
    }

    setupEventListeners() {
        // Setup panel toggle
        const toggleBtn = document.getElementById('toggleSetup');
        const setupContent = document.getElementById('setupContent');
        toggleBtn.addEventListener('click', () => {
            const isVisible = setupContent.style.display !== 'none';
            setupContent.style.display = isVisible ? 'none' : 'block';
            toggleBtn.innerHTML = isVisible ? 
                '<i class="fas fa-chevron-down"></i>' : 
                '<i class="fas fa-chevron-up"></i>';
        });

        // Start chat button
        document.getElementById('startChat').addEventListener('click', () => {
            this.startChat();
        });

        // Send message button
        document.getElementById('sendMessage').addEventListener('click', () => {
            this.sendMessage();
        });

        // Enter key in message input
        document.getElementById('messageInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // New chat button
        document.getElementById('newChat').addEventListener('click', () => {
            this.resetToSetup();
        });

        // Export chat button
        document.getElementById('exportChat').addEventListener('click', () => {
            this.exportChat();
        });

        // Error modal dismiss
        document.getElementById('dismissError').addEventListener('click', () => {
            this.hideErrorModal();
        });

        document.getElementById('closeErrorModal').addEventListener('click', () => {
            this.hideErrorModal();
        });
    }

    async loadTemplates() {
        try {
            const response = await fetch('/api/templates');
            const templates = await response.json();
            this.renderTemplates(templates);
        } catch (error) {
            console.error('Failed to load templates:', error);
            this.showError('Failed to load roleplay templates');
        }
    }

    renderTemplates(templates) {
        const templateGrid = document.getElementById('templateGrid');
        templateGrid.innerHTML = '';

        templates.forEach(template => {
            const templateCard = document.createElement('div');
            templateCard.className = 'template-card';
            templateCard.dataset.templateId = template.id;
            
            templateCard.innerHTML = `
                <h4>${template.name}</h4>
                <p>${template.description}</p>
                <div class="examples">
                    <strong>Example responses:</strong><br>
                    ${template.examples.slice(0, 2).map(ex => `"${ex}"`).join('<br>')}
                </div>
            `;

            templateCard.addEventListener('click', () => {
                this.selectTemplate(template);
            });

            templateGrid.appendChild(templateCard);
        });
    }

    selectTemplate(template) {
        // Remove previous selection
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Select new template
        const selectedCard = document.querySelector(`[data-template-id="${template.id}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }

        this.selectedTemplate = template;
        
        // Update custom roleplay field if it's a custom template
        if (template.id === 'custom-roleplay') {
            document.getElementById('customRoleplay').focus();
        }
    }

    async startChat() {
        const preface = document.getElementById('preface').value.trim();
        const customRoleplay = document.getElementById('customRoleplay').value.trim();
        const model = document.getElementById('model').value;

        if (!preface) {
            this.showError('Please provide a context and preface for the conversation.');
            return;
        }

        if (!this.selectedTemplate) {
            this.showError('Please select a roleplay template.');
            return;
        }

        // Determine the roleplay to use
        let roleplay = this.selectedTemplate.id;
        if (this.selectedTemplate.id === 'custom-roleplay' && customRoleplay) {
            roleplay = customRoleplay;
        } else if (this.selectedTemplate.id === 'custom-roleplay' && !customRoleplay) {
            this.showError('Please describe your custom roleplay character or scenario.');
            return;
        }

        try {
            this.showLoading(true);
            
            // Create initial chat session
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: "Hello! I'd like to start our conversation about the situation I described.",
                    preface: preface,
                    roleplay: roleplay,
                    settings: {
                        model: model
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to start chat session');
            }

            const chatResponse = await response.json();
            this.currentSessionId = chatResponse.sessionId;
            
            // Switch to chat interface
            this.showChatInterface();
            
            // Add the initial messages
            this.addMessage({
                role: 'user',
                content: "Hello! I'd like to start our conversation about the situation I described.",
                timestamp: new Date()
            });
            
            this.addMessage({
                role: 'assistant',
                content: chatResponse.message.content,
                timestamp: chatResponse.message.timestamp
            });

            // Show suggestions and next steps
            this.showSuggestions(chatResponse.suggestions);
            this.showNextSteps(chatResponse.nextSteps);

            // Join socket room for real-time updates
            if (this.socket) {
                this.socket.emit('join-session', this.currentSessionId);
            }

        } catch (error) {
            console.error('Failed to start chat:', error);
            this.showError('Failed to start chat session. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message || !this.currentSessionId) {
            return;
        }

        // Add user message to chat
        this.addMessage({
            role: 'user',
            content: message,
            timestamp: new Date()
        });

        // Clear input
        messageInput.value = '';

        try {
            this.showLoading(true);
            
            // Send message to server
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.currentSessionId,
                    message: message,
                    preface: document.getElementById('preface').value,
                    roleplay: this.selectedTemplate ? this.selectedTemplate.id : 'therapeutic-counselor'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            const chatResponse = await response.json();
            
            // Add assistant response
            this.addMessage({
                role: 'assistant',
                content: chatResponse.message.content,
                timestamp: chatResponse.message.timestamp
            });

            // Update suggestions and next steps
            this.showSuggestions(chatResponse.suggestions);
            this.showNextSteps(chatResponse.nextSteps);

        } catch (error) {
            console.error('Failed to send message:', error);
            this.showError('Failed to send message. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    addMessage(messageData) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${messageData.role}`;
        
        const avatar = messageData.role === 'user' ? 
            '<i class="fas fa-user"></i>' : 
            '<i class="fas fa-robot"></i>';
        
        const timestamp = new Date(messageData.timestamp).toLocaleTimeString();
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                ${avatar}
            </div>
            <div class="message-content">
                <p>${this.escapeHtml(messageData.content)}</p>
                <div class="message-timestamp">${timestamp}</div>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showChatInterface() {
        document.getElementById('setupPanel').style.display = 'none';
        document.getElementById('chatInterface').style.display = 'flex';
        
        // Update chat title and subtitle
        const preface = document.getElementById('preface').value;
        const roleplayName = this.selectedTemplate ? this.selectedTemplate.name : 'Unknown';
        
        document.getElementById('chatTitle').textContent = this.truncateText(preface, 50);
        document.getElementById('currentRoleplay').textContent = roleplayName;
    }

    resetToSetup() {
        document.getElementById('chatInterface').style.display = 'none';
        document.getElementById('setupPanel').style.display = 'block';
        document.getElementById('setupContent').style.display = 'block';
        
        // Clear chat messages
        document.getElementById('chatMessages').innerHTML = '';
        
        // Reset form
        document.getElementById('preface').value = '';
        document.getElementById('customRoleplay').value = '';
        document.getElementById('model').value = 'gpt-4';
        
        // Clear template selection
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.remove('selected');
        });
        this.selectedTemplate = null;
        
        // Hide suggestions and next steps
        this.hideSuggestions();
        this.hideNextSteps();
        
        // Leave socket room
        if (this.socket && this.currentSessionId) {
            this.socket.emit('leave-session', this.currentSessionId);
        }
        
        this.currentSessionId = null;
    }

    showSuggestions(suggestions) {
        if (!suggestions || suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }

        const suggestionsPanel = document.getElementById('suggestionsPanel');
        const suggestionsList = document.getElementById('suggestionsList');
        
        suggestionsList.innerHTML = '';
        suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = suggestion;
            suggestionsList.appendChild(item);
        });
        
        suggestionsPanel.style.display = 'block';
    }

    hideSuggestions() {
        document.getElementById('suggestionsPanel').style.display = 'none';
    }

    showNextSteps(nextSteps) {
        if (!nextSteps || nextSteps.length === 0) {
            this.hideNextSteps();
            return;
        }

        const nextStepsPanel = document.getElementById('nextStepsPanel');
        const nextStepsList = document.getElementById('nextStepsList');
        
        nextStepsList.innerHTML = '';
        nextSteps.forEach(step => {
            const item = document.createElement('div');
            item.className = 'next-step-item';
            item.textContent = step;
            nextStepsList.appendChild(item);
        });
        
        nextStepsPanel.style.display = 'block';
    }

    hideNextSteps() {
        document.getElementById('nextStepsPanel').style.display = 'none';
    }

    async exportChat() {
        if (!this.currentSessionId) {
            this.showError('No chat session to export.');
            return;
        }

        try {
            const response = await fetch(`/api/sessions/${this.currentSessionId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch chat session');
            }

            const session = await response.json();
            
            // Create export data
            const exportData = {
                session: {
                    id: session.id,
                    preface: session.preface,
                    roleplay: session.roleplay,
                    createdAt: session.createdAt,
                    updatedAt: session.updatedAt
                },
                messages: session.messages.filter(msg => msg.role !== 'system'),
                exportDate: new Date().toISOString()
            };

            // Create and download file
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `argument-diffuser-chat-${session.id}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Failed to export chat:', error);
            this.showError('Failed to export chat. Please try again.');
        }
    }

    setupSocketConnection() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
    }

    showLoading(show) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    showError(message) {
        const errorModal = document.getElementById('errorModal');
        const errorMessage = document.getElementById('errorMessage');
        
        errorMessage.textContent = message;
        errorModal.style.display = 'flex';
    }

    hideErrorModal() {
        document.getElementById('errorModal').style.display = 'none';
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + '...';
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ArgumentDiffuserApp();
});









