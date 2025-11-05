// Singleton pattern to prevent multiple instances
let mudInterfaceInstance = null;

class MUDInterface {
    constructor() {
        // Return existing instance if one exists
        if (mudInterfaceInstance) {
            console.log('⚠️ MUDInterface instance already exists, returning existing instance');
            return mudInterfaceInstance;
        }
        
        this.socket = io();
        this.output = document.getElementById('output');
        this.input = document.getElementById('command-input');
        this.history = [];
        this.historyIndex = -1;
        this.tempInput = '';
        this.username = null;
        this.isLoggedIn = false;
        this.password = null; // Store password for reconnection
        this.oldSocketId = null;
        
        // Store instance
        mudInterfaceInstance = this;
        
        console.log('🆕 Creating new MUDInterface instance:', {
            socketId: this.socket.id,
            outputExists: !!this.output,
            inputExists: !!this.input
        });
        
        this.setupEventListeners();
        this.initialize();
        this.showLoginPrompt();
    }
    
    // Static method to get or create instance
    static getInstance() {
        if (!mudInterfaceInstance) {
            mudInterfaceInstance = new MUDInterface();
        }
        return mudInterfaceInstance;
    }

    setupEventListeners() {
        // Handle Enter key
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                // Don't allow commands if not logged in
                if (!this.isLoggedIn) {
                    console.warn('⚠️ Command blocked: Not logged in', {
                        socketId: this.socket.id,
                        username: this.username,
                        isLoggedIn: this.isLoggedIn,
                        socketConnected: this.socket.connected
                    });
                    this.addMessage('Please login first', 'error');
                    this.showLoginPrompt();
                    return;
                }
                
                const command = this.input.value.trim();
                if (command) {
                    // Double-check we're still logged in before sending
                    if (!this.isLoggedIn || !this.username) {
                        console.error('❌ Login state lost before command send!', {
                            socketId: this.socket.id,
                            username: this.username,
                            isLoggedIn: this.isLoggedIn
                        });
                        this.addMessage('Session lost. Please login again.', 'error');
                        this.showLoginPrompt();
                        return;
                    }
                    
                    console.log('📤 Sending command:', {
                        command: command.substring(0, 50),
                        socketId: this.socket.id,
                        username: this.username,
                        isLoggedIn: this.isLoggedIn,
                        socketConnected: this.socket.connected
                    });
                    
                    // Always emit the command first
                    this.socket.emit('command', command);
                    
                    // Check if this is a recognized command (don't show locally if it will be broadcast)
                    const isRecognizedCommand = command.match(/^(help|github|ai|wifi|scan|ar|!history)/i);
                    
                    // Only show message locally if it's NOT a recognized command (unrecognized commands are broadcast)
                    // AND we're logged in (to avoid showing messages that will fail)
                    if (!isRecognizedCommand && this.isLoggedIn) {
                        // Show own message locally (won't be duplicated by broadcast since we exclude sender)
                        this.addMessage(command, 'user', this.username);
                    }
                    this.input.value = '';
                    this.historyIndex = -1;
                    this.tempInput = '';
                }
            }
        });

        // Handle arrow keys for history navigation
        this.input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory(1); // Up = older commands (forward in history index)
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory(-1); // Down = newer commands (backward in history index)
            }
        });

        // Load history when connected
        this.socket.on('connect', () => {
            console.log('🔌 Socket connected:', {
                socketId: this.socket.id,
                isLoggedIn: this.isLoggedIn,
                username: this.username
            });
            // Don't request history until logged in
            if (this.isLoggedIn) {
                this.socket.emit('get-history');
            }
        });
        
        // Handle disconnect
        this.socket.on('disconnect', () => {
            console.warn('⚠️ Socket disconnected');
            this.isLoggedIn = false;
            this.showLoginPrompt();
        });
        
        // Handle reconnect
        this.socket.on('reconnect', (attemptNumber) => {
            console.log('🔄 Socket reconnected:', {
                socketId: this.socket.id,
                attemptNumber: attemptNumber,
                isLoggedIn: this.isLoggedIn,
                username: this.username,
                oldSocketId: this.oldSocketId
            });
            
            // Socket ID changes on reconnect, so we need to re-authenticate
            if (this.username && this.password) {
                console.log('🔄 Re-authenticating after reconnect...');
                this.isLoggedIn = false;
                this.socket.emit('login', { username: this.username, password: this.password });
            } else if (this.username) {
                // If we don't have password stored, force re-login
                this.addMessage('Connection lost. Please login again.', 'error');
                this.showLoginPrompt();
            }
        });
        
        // Track socket ID changes
        this.socket.on('connect', () => {
            console.log('🔌 Socket connect event:', {
                socketId: this.socket.id,
                oldSocketId: this.oldSocketId,
                isLoggedIn: this.isLoggedIn,
                username: this.username,
                changed: this.oldSocketId && this.oldSocketId !== this.socket.id
            });
            
            if (this.oldSocketId && this.oldSocketId !== this.socket.id) {
                console.warn('⚠️ Socket ID changed!', {
                    old: this.oldSocketId,
                    new: this.socket.id,
                    isLoggedIn: this.isLoggedIn
                });
                // If socket ID changed and we were logged in, we need to re-authenticate
                if (this.isLoggedIn) {
                    this.isLoggedIn = false;
                    if (this.username && this.password) {
                        console.log('🔄 Re-authenticating due to socket ID change...');
                        // Small delay to ensure socket is fully connected
                        setTimeout(() => {
                            this.socket.emit('login', { username: this.username, password: this.password });
                        }, 100);
                    } else {
                        this.addMessage('Connection reset. Please login again.', 'error');
                        this.showLoginPrompt();
                    }
                }
            }
            this.oldSocketId = this.socket.id;
        });
        
        // Handle login events
        this.socket.on('login_success', (data) => {
            console.log('✅ Login success received:', data);
            
            // Verify socket ID matches
            if (data.socketId && data.socketId !== this.socket.id) {
                console.error('⚠️ Socket ID mismatch on login success!', {
                    received: data.socketId,
                    current: this.socket.id,
                    oldSocketId: this.oldSocketId,
                    username: this.username
                });
                
                // This shouldn't happen if we're using the same socket instance
                // But if it does, we need to re-authenticate on the current socket
                if (this.username && this.password) {
                    console.log('🔄 Re-authenticating due to socket ID mismatch...');
                    // Wait a bit for socket to stabilize
                    setTimeout(() => {
                        if (this.socket.connected) {
                            this.socket.emit('login', { username: this.username, password: this.password });
                        } else {
                            console.error('❌ Socket not connected, cannot re-authenticate');
                            this.addMessage('Connection issue. Please login again.', 'error');
                            this.showLoginPrompt();
                        }
                    }, 200);
                    return;
                } else {
                    console.error('❌ Cannot re-authenticate: missing credentials');
                    this.addMessage('Session mismatch. Please login again.', 'error');
                    this.showLoginPrompt();
                    return;
                }
            }
            
            this.username = data.username;
            this.isLoggedIn = true;
            this.oldSocketId = this.socket.id; // Store current socket ID
            
            console.log('✅ Login state updated:', {
                username: this.username,
                isLoggedIn: this.isLoggedIn,
                socketId: this.socket.id,
                serverSocketId: data.socketId,
                socketConnected: this.socket.connected
            });
            this.addMessage(`✅ Logged in as ${data.username}`, 'success');
            if (data.socketId) {
                this.addMessage(`Session ID: ${data.socketId}`, 'system');
                if (data.socketId !== this.socket.id) {
                    this.addMessage(`⚠️ Warning: Socket ID mismatch (server: ${data.socketId}, client: ${this.socket.id})`, 'error');
                }
            }
            if (data.isNewUser) {
                this.addMessage('Welcome to the MUD! Type "help" for available commands.', 'system');
            }
            // Request history now that we're logged in
            this.socket.emit('get-history');
            // Hide login prompt if it exists
            this.hideLoginPrompt();
            
            // Verify session is active by checking socket connection
            console.log('🔍 Verifying session:', {
                socketId: this.socket.id,
                serverSocketId: data.socketId,
                username: this.username,
                isLoggedIn: this.isLoggedIn,
                socketConnected: this.socket.connected,
                matches: data.socketId === this.socket.id
            });
        });
        
        this.socket.on('login_error', (data) => {
            this.addMessage(`❌ Login failed: ${data.message}`, 'error');
            this.showLoginPrompt();
        });
        
        // Handle chat messages (broadcast from all users)
        // Note: Our own messages are excluded from broadcast, so we only receive others' messages here
        this.socket.on('chat_message', (data) => {
            // Only show if it's not our own message
            // Server excludes sender from broadcast, so we should only receive messages from others
            if (data.sender && data.sender !== this.username) {
                // Pass content and sender separately - addMessage will handle the formatting
                this.addMessage(data.content, 'system', data.sender);
            } else if (!data.sender || data.sender === this.username) {
                // This shouldn't happen since server excludes sender, but handle gracefully
                console.warn('⚠️ Received own message in broadcast (should not happen):', data);
            }
        });
        
        // Handle user presence events
        this.socket.on('user_joined', (data) => {
            if (data.username !== this.username) {
                this.addMessage(`👋 ${data.username} joined the MUD`, 'system');
            }
        });
        
        this.socket.on('user_left', (data) => {
            if (data.username !== this.username) {
                this.addMessage(`👋 ${data.username} left the MUD`, 'system');
            }
        });
        
        this.socket.on('active_users', (data) => {
            if (data.users && data.users.length > 0) {
                this.addMessage(`Active users: ${data.users.join(', ')}`, 'system');
            }
        });

        this.socket.on('history-response', (data) => {
            this.history = data.history || [];
        });

        this.socket.on('welcome', (data) => {
            this.addMessage(data.message, 'system');
            this.addMessage('Available commands: ' + data.commands.join(', '), 'system');
        });

        this.socket.on('error', (data) => {
            const message = typeof data === 'string' ? data : (data.message || JSON.stringify(data));
            this.addMessage(message, 'error');
        });

        this.socket.on('repository', (data) => {
            this.addMessage(`Repository: ${data.name}`, 'success');
            this.addMessage(`Description: ${data.description}`, 'system');
            this.addMessage(`Stars: ${data.stars}`, 'system');
        });

        this.socket.on('github_response', (data) => {
            console.log('GitHub response received:', data);
            
            // Show source if it's from AI request
            if (data.source === 'ai-requested' && data.query) {
                this.addMessage(`🔍 GitHub Search Results (AI requested): "${data.query}"`, 'success');
            }
            
            if (data.data && data.data.items) {
                // Search results
                const results = data.data.items;
                const totalCount = data.data.total_count || results.length;
                this.addMessage(`Found ${totalCount} repositories (showing top ${results.length}):`, 'success');
                
                results.slice(0, 10).forEach((repo, index) => {
                    const repoMessage = `${index + 1}. ${repo.full_name} (⭐ ${repo.stargazers_count})
   Description: ${repo.description || 'No description'}
   Language: ${repo.language || 'N/A'}
   URL: ${repo.html_url}
   Updated: ${new Date(repo.updated_at).toLocaleDateString()}`;
                    this.addMessage(repoMessage, 'system');
                });
                
                if (results.length > 10) {
                    this.addMessage(`... and ${results.length - 10} more`, 'system');
                }
            } else if (data.data && data.data.full_name) {
                // Single repository
                const repo = data.data;
                this.addMessage(`Repository: ${repo.full_name}`, 'success');
                this.addMessage(`Description: ${repo.description || 'No description'}`, 'system');
                this.addMessage(`Stars: ${repo.stargazers_count} | Language: ${repo.language || 'N/A'} | URL: ${repo.html_url}`, 'system');
            } else {
                this.addMessage(JSON.stringify(data, null, 2), 'system');
            }
        });

        this.socket.on('exploration', (data) => {
            this.addMessage(`Exploring: ${data.path}`, 'system');
            
            if (Array.isArray(data.content)) {
                const explorer = document.createElement('div');
                explorer.className = 'file-explorer';
                
                data.content.forEach(item => {
                    const fileItem = document.createElement('div');
                    fileItem.className = 'file-item';
                    fileItem.textContent = `${item.type === 'dir' ? '📁' : '📄'} ${item.name}`;
                    fileItem.onclick = () => this.socket.emit('command', `/explore ${item.path}`);
                    explorer.appendChild(fileItem);
                });
                
                this.output.appendChild(explorer);
            } else {
                const codeBlock = document.createElement('pre');
                codeBlock.className = 'code-block';
                const code = document.createElement('code');
                code.textContent = data.content.content;
                codeBlock.appendChild(code);
                this.output.appendChild(codeBlock);
                hljs.highlightElement(code);
            }
        });

        this.socket.on('ai_response', (data) => {
            const aiMessage = document.createElement('div');
            aiMessage.className = 'message ai-message';
            
            // Determine source label
            let sourceLabel = '';
            if (data.isFollowUp && data.githubQuery) {
                sourceLabel = ' (GitHub Search Follow-up)';
            } else if (data.githubQuery) {
                sourceLabel = ' (GitHub Search)';
            } else if (data.isCameraRequest || (data.prompt && (data.prompt.includes('ASCII') || data.prompt.includes('camera feed') || data.prompt.includes('ASCII representation')))) {
                sourceLabel = ' (Camera)';
            }
            
            // Show sender if available (only if it's not our own message)
            // Note: Server sends directly to sender, so we won't see sender info on our own messages
            const isOwnMessage = data.sender === this.username;
            const senderInfo = (data.sender && !isOwnMessage) ? ` [from ${data.sender}]` : '';
            const isAITalk = data.isAITalk ? ` [AI-to-AI: ${data.sourceAI} → ${data.type}]` : '';
            
            // Only show question if it's explicitly provided, otherwise show AI type
            if (data.question || data.prompt) {
                const question = document.createElement('div');
                question.textContent = `Q: ${data.question || data.prompt}${senderInfo}${isAITalk}`;
                question.style.fontWeight = 'bold';
                question.style.marginBottom = '5px';
                aiMessage.appendChild(question);
            } else {
                // Show AI type as header
                const header = document.createElement('div');
                header.textContent = `${data.type ? data.type.toUpperCase() : 'AI'} Response${sourceLabel}${senderInfo}${isAITalk}:`;
                header.style.fontWeight = 'bold';
                header.style.marginBottom = '5px';
                header.style.color = '#ffc800';
                aiMessage.appendChild(header);
            }
            
            const answer = document.createElement('div');
            const responseText = data.response || data.answer || JSON.stringify(data);
            // Use marked if available, otherwise just display as text
            if (typeof marked !== 'undefined' && marked.parse) {
                answer.innerHTML = marked.parse(responseText);
            } else {
                answer.textContent = responseText;
            }
            aiMessage.appendChild(answer);
            
            // Show if this is a follow-up response
            if (data.isFollowUp) {
                const followUpLabel = document.createElement('div');
                followUpLabel.style.fontSize = '11px';
                followUpLabel.style.color = '#00ff00';
                followUpLabel.style.marginTop = '5px';
                followUpLabel.textContent = `↳ Follow-up response to GitHub search for "${data.githubQuery || 'query'}"`;
                aiMessage.appendChild(followUpLabel);
            }
            
            // Show credits if available
            if (data.credits !== undefined) {
                const credits = document.createElement('div');
                credits.style.fontSize = '11px';
                credits.style.color = '#888';
                credits.style.marginTop = '5px';
                credits.textContent = `Credits remaining: ${data.credits}`;
                aiMessage.appendChild(credits);
            }
            
            this.output.appendChild(aiMessage);
            this.output.scrollTop = this.output.scrollHeight;
        });

        // Handle GitHub search confirmation prompt
        this.socket.on('github_search_confirmation', (data) => {
            const confirmDiv = document.createElement('div');
            confirmDiv.className = 'message system-message';
            confirmDiv.style.background = 'rgba(255, 200, 0, 0.1)';
            confirmDiv.style.border = '2px solid #ffc800';
            confirmDiv.style.padding = '15px';
            confirmDiv.style.margin = '10px 0';
            
            const message = document.createElement('div');
            message.textContent = data.message;
            message.style.marginBottom = '10px';
            confirmDiv.appendChild(message);
            
            const buttonContainer = document.createElement('div');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.gap = '10px';
            
            const yesButton = document.createElement('button');
            yesButton.textContent = 'Yes (Y)';
            yesButton.style.padding = '8px 16px';
            yesButton.style.background = '#00ff00';
            yesButton.style.color = '#000';
            yesButton.style.border = 'none';
            yesButton.style.borderRadius = '4px';
            yesButton.style.cursor = 'pointer';
            yesButton.style.fontWeight = 'bold';
            yesButton.onclick = () => {
                this.socket.emit('confirm-github-search', { 
                    searchId: data.searchId, 
                    confirmed: true 
                });
                confirmDiv.remove();
            };
            
            const noButton = document.createElement('button');
            noButton.textContent = 'No (n)';
            noButton.style.padding = '8px 16px';
            noButton.style.background = '#ff0000';
            noButton.style.color = '#fff';
            noButton.style.border = 'none';
            noButton.style.borderRadius = '4px';
            noButton.style.cursor = 'pointer';
            noButton.style.fontWeight = 'bold';
            noButton.onclick = () => {
                this.socket.emit('confirm-github-search', { 
                    searchId: data.searchId, 
                    confirmed: false 
                });
                confirmDiv.remove();
            };
            
            buttonContainer.appendChild(yesButton);
            buttonContainer.appendChild(noButton);
            confirmDiv.appendChild(buttonContainer);
            
            this.output.appendChild(confirmDiv);
            this.output.scrollTop = this.output.scrollHeight;
            
            // Auto-confirm after 10 seconds (default to Yes)
            setTimeout(() => {
                if (confirmDiv.parentNode) {
                    this.socket.emit('confirm-github-search', { 
                        searchId: data.searchId, 
                        confirmed: true 
                    });
                    confirmDiv.remove();
                }
            }, 10000);
        });

        // Handle MUD messages
        this.socket.on('message', (data) => {
            const message = typeof data === 'string' ? data : (data.content || data.message || JSON.stringify(data));
            const type = data.type || 'system';
            
            // Handle ASCII image messages specially
            if (data.isASCII || (typeof message === 'string' && message.includes('ASCII Image:'))) {
                // Extract ASCII content
                const asciiMatch = message.match(/ASCII Image:\s*\n\n([\s\S]+)/);
                if (asciiMatch && asciiMatch[1]) {
                    this.addMessage(message.split('\n\n')[0], type);
                    
                    // Create ASCII preview div
                    const asciiDiv = document.createElement('div');
                    asciiDiv.className = 'ascii-preview';
                    asciiDiv.style.fontFamily = 'Courier New, monospace';
                    asciiDiv.style.fontSize = '8px';
                    asciiDiv.style.lineHeight = '1';
                    asciiDiv.style.background = '#000';
                    asciiDiv.style.padding = '10px';
                    asciiDiv.style.border = '1px solid #333';
                    asciiDiv.style.borderRadius = '4px';
                    asciiDiv.style.maxHeight = '300px';
                    asciiDiv.style.overflow = 'auto';
                    asciiDiv.style.whiteSpace = 'pre';
                    asciiDiv.textContent = asciiMatch[1];
                    
                    this.output.appendChild(asciiDiv);
                    this.output.scrollTop = this.output.scrollHeight;
                    return;
                }
            }
            
            this.addMessage(message, type);
        });

        this.socket.on('ai_joined', (data) => {
            this.addMessage(data.message, 'success');
        });

        this.socket.on('ai_left', (data) => {
            this.addMessage(data.message, 'system');
        });
    }

    initialize() {
        this.socket.emit('initialize');
    }

    navigateHistory(direction) {
        if (this.history.length === 0) {
            return;
        }

        // Save current input if we're starting to navigate
        if (this.historyIndex === -1 && this.input.value.trim()) {
            this.tempInput = this.input.value;
        }

        // Move through history
        this.historyIndex += direction;

        // Clamp to valid range
        if (this.historyIndex < 0) {
            this.historyIndex = -1;
            this.input.value = this.tempInput;
            return;
        }

        if (this.historyIndex >= this.history.length) {
            this.historyIndex = this.history.length - 1;
        }

        // Set input to history item (reverse order - most recent first)
        const reversedIndex = this.history.length - 1 - this.historyIndex;
        this.input.value = this.history[reversedIndex] || '';
    }

    addMessage(message, type = 'system', sender = null) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        
        // If sender is provided and it's not our own message, show sender info
        if (sender && sender !== this.username && type !== 'user') {
            const senderLabel = document.createElement('span');
            senderLabel.textContent = `${sender}: `;
            senderLabel.style.color = '#888';
            senderLabel.style.fontSize = '0.9em';
            messageElement.appendChild(senderLabel);
        }
        
        const textNode = document.createTextNode(message);
        messageElement.appendChild(textNode);
        
        // Style own messages differently
        if (sender === this.username && type === 'user') {
            messageElement.style.textAlign = 'right';
            messageElement.style.color = '#4CAF50';
        }
        
        this.output.appendChild(messageElement);
        this.output.scrollTop = this.output.scrollHeight;
    }
    
    showLoginPrompt() {
        // Check if login form already exists
        if (document.getElementById('login-form')) {
            return;
        }
        
        const loginForm = document.createElement('div');
        loginForm.id = 'login-form';
        loginForm.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #1a1a1a; padding: 20px; border: 2px solid #333; border-radius: 8px; z-index: 1000; min-width: 300px;';
        
        const title = document.createElement('h3');
        title.textContent = 'Login to MUD';
        title.style.cssText = 'margin-top: 0; color: #fff;';
        loginForm.appendChild(title);
        
        const usernameLabel = document.createElement('label');
        usernameLabel.textContent = 'Username:';
        usernameLabel.style.cssText = 'display: block; color: #fff; margin-bottom: 5px;';
        loginForm.appendChild(usernameLabel);
        
        const usernameInput = document.createElement('input');
        usernameInput.type = 'text';
        usernameInput.id = 'login-username';
        usernameInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 10px; background: #2a2a2a; color: #fff; border: 1px solid #444; border-radius: 4px; box-sizing: border-box;';
        usernameInput.autofocus = true;
        loginForm.appendChild(usernameInput);
        
        const passwordLabel = document.createElement('label');
        passwordLabel.textContent = 'Password:';
        passwordLabel.style.cssText = 'display: block; color: #fff; margin-bottom: 5px;';
        loginForm.appendChild(passwordLabel);
        
        const passwordInput = document.createElement('input');
        passwordInput.type = 'password';
        passwordInput.id = 'login-password';
        passwordInput.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 15px; background: #2a2a2a; color: #fff; border: 1px solid #444; border-radius: 4px; box-sizing: border-box;';
        loginForm.appendChild(passwordInput);
        
        const loginButton = document.createElement('button');
        loginButton.textContent = 'Login';
        loginButton.style.cssText = 'width: 100%; padding: 10px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px;';
        loginButton.onclick = () => {
            const username = usernameInput.value.trim();
            const password = passwordInput.value;
            
            if (!username || !password) {
                alert('Please enter both username and password');
                return;
            }
            
            // Store credentials for reconnection
            this.username = username.toLowerCase();
            this.password = password;
            
            console.log('📤 Sending login:', {
                username: this.username,
                socketId: this.socket.id,
                socketConnected: this.socket.connected
            });
            
            this.socket.emit('login', { username, password });
        };
        loginForm.appendChild(loginButton);
        
        // Allow Enter key to submit
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loginButton.click();
            }
        });
        
        document.body.appendChild(loginForm);
    }
    
    hideLoginPrompt() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.remove();
        }
    }
}

// Initialize MUD interface when page loads
window.addEventListener('load', () => {
    // Use singleton pattern to prevent multiple instances
    if (!window.mudInterface) {
        window.mudInterface = MUDInterface.getInstance();
    }
}); 