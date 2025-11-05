class MUDInterface {
    constructor() {
        this.socket = io();
        this.output = document.getElementById('output');
        this.input = document.getElementById('command-input');
        this.history = [];
        this.historyIndex = -1;
        this.tempInput = '';
        this.setupEventListeners();
        this.initialize();
    }

    setupEventListeners() {
        // Handle Enter key
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const command = this.input.value.trim();
                if (command) {
                    this.socket.emit('command', command);
                    this.addMessage(command, 'user');
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
            this.socket.emit('get-history');
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
            
            // Only show question if it's explicitly provided, otherwise show AI type
            if (data.question || data.prompt) {
                const question = document.createElement('div');
                question.textContent = `Q: ${data.question || data.prompt}`;
                question.style.fontWeight = 'bold';
                question.style.marginBottom = '5px';
                aiMessage.appendChild(question);
            } else {
                // Show AI type as header
                const header = document.createElement('div');
                header.textContent = `${data.type ? data.type.toUpperCase() : 'AI'} Response${sourceLabel}:`;
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

    addMessage(message, type) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        this.output.appendChild(messageElement);
        this.output.scrollTop = this.output.scrollHeight;
    }
}

// Initialize MUD interface when page loads
window.addEventListener('load', () => {
    new MUDInterface();
}); 