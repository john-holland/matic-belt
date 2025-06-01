require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Octokit } = require('@octokit/rest');
const { OpenAI } = require('openai');
const { Anthropic } = require('anthropic');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Initialize clients
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Store active sessions
const sessions = new Map();

class MUDSession {
    constructor(socket) {
        this.socket = socket;
        this.currentRepo = null;
        this.currentPath = null;
        this.conversation = [];
        this.aiParticipants = new Set();
    }

    async initialize() {
        this.socket.emit('welcome', {
            message: 'Welcome to the MUD! You can explore GitHub repositories with AI assistants.',
            commands: ['/repo', '/explore', '/ask', '/summon', '/dismiss']
        });
    }

    async handleCommand(command, args) {
        switch (command) {
            case '/repo':
                await this.setRepository(args[0]);
                break;
            case '/explore':
                await this.explorePath(args[0]);
                break;
            case '/ask':
                await this.askAI(args.join(' '));
                break;
            case '/summon':
                await this.summonAI(args[0]);
                break;
            case '/dismiss':
                await this.dismissAI(args[0]);
                break;
            default:
                this.socket.emit('error', 'Unknown command');
        }
    }

    async setRepository(repoName) {
        try {
            const [owner, repo] = repoName.split('/');
            const { data } = await octokit.repos.get({ owner, repo });
            this.currentRepo = data;
            this.currentPath = '';
            this.socket.emit('repository', {
                name: data.full_name,
                description: data.description,
                stars: data.stargazers_count
            });
        } catch (error) {
            this.socket.emit('error', 'Failed to set repository');
        }
    }

    async explorePath(path) {
        if (!this.currentRepo) {
            this.socket.emit('error', 'No repository selected');
            return;
        }

        try {
            const { data } = await octokit.repos.getContent({
                owner: this.currentRepo.owner.login,
                repo: this.currentRepo.name,
                path: path || ''
            });

            this.currentPath = path;
            this.socket.emit('exploration', {
                path,
                content: Array.isArray(data) ? data.map(item => ({
                    name: item.name,
                    type: item.type,
                    path: item.path
                })) : {
                    content: Buffer.from(data.content, 'base64').toString(),
                    type: data.type
                }
            });
        } catch (error) {
            this.socket.emit('error', 'Failed to explore path');
        }
    }

    async askAI(question) {
        if (!this.currentRepo) {
            this.socket.emit('error', 'No repository selected');
            return;
        }

        const context = {
            repository: this.currentRepo.full_name,
            path: this.currentPath,
            conversation: this.conversation
        };

        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `You are exploring the GitHub repository ${context.repository}. 
                                Current path: ${context.path}
                                Previous conversation: ${JSON.stringify(context.conversation)}`
                    },
                    {
                        role: "user",
                        content: question
                    }
                ]
            });

            const answer = response.choices[0].message.content;
            this.conversation.push({ role: 'user', content: question });
            this.conversation.push({ role: 'assistant', content: answer });

            this.socket.emit('ai_response', {
                question,
                answer,
                source: 'gpt-4'
            });
        } catch (error) {
            this.socket.emit('error', 'Failed to get AI response');
        }
    }

    async summonAI(aiType) {
        if (this.aiParticipants.has(aiType)) {
            this.socket.emit('error', `${aiType} is already present`);
            return;
        }

        this.aiParticipants.add(aiType);
        this.socket.emit('ai_joined', {
            type: aiType,
            message: `${aiType} has joined the exploration`
        });
    }

    async dismissAI(aiType) {
        if (!this.aiParticipants.has(aiType)) {
            this.socket.emit('error', `${aiType} is not present`);
            return;
        }

        this.aiParticipants.delete(aiType);
        this.socket.emit('ai_left', {
            type: aiType,
            message: `${aiType} has left the exploration`
        });
    }
}

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('Client connected');
    const session = new MUDSession(socket);
    sessions.set(socket.id, session);

    socket.on('initialize', async () => {
        await session.initialize();
    });

    socket.on('command', async (data) => {
        const [command, ...args] = data.split(' ');
        await session.handleCommand(command, args);
    });

    socket.on('disconnect', () => {
        sessions.delete(socket.id);
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`MUD server running on port ${PORT}`);
}); 