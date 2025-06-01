class MUDInterface {
    constructor() {
        this.socket = io();
        this.output = document.getElementById('output');
        this.input = document.getElementById('command-input');
        this.setupEventListeners();
        this.initialize();
    }

    setupEventListeners() {
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const command = this.input.value.trim();
                if (command) {
                    this.socket.emit('command', command);
                    this.addMessage(command, 'user');
                    this.input.value = '';
                }
            }
        });

        this.socket.on('welcome', (data) => {
            this.addMessage(data.message, 'system');
            this.addMessage('Available commands: ' + data.commands.join(', '), 'system');
        });

        this.socket.on('error', (message) => {
            this.addMessage(message, 'error');
        });

        this.socket.on('repository', (data) => {
            this.addMessage(`Repository: ${data.name}`, 'success');
            this.addMessage(`Description: ${data.description}`, 'system');
            this.addMessage(`Stars: ${data.stars}`, 'system');
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
            
            const question = document.createElement('div');
            question.textContent = `Q: ${data.question}`;
            aiMessage.appendChild(question);
            
            const answer = document.createElement('div');
            answer.innerHTML = marked.parse(data.answer);
            aiMessage.appendChild(answer);
            
            this.output.appendChild(aiMessage);
            this.output.scrollTop = this.output.scrollHeight;
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