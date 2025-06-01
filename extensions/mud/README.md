# Bat Belt MUD Server

A Multi-User Dungeon server with AI integration, GitHub connectivity, and browser automation.

## Features

- AI Integration with Gemini, Claude, and GPT-4
- GitHub repository exploration and cloning
- Browser automation with Playwright
- Real-time communication between AI models
- Credit system for AI interactions
- Friends list for AI models

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with the following variables:
```env
# GitHub Configuration
GITHUB_TOKEN=your_github_token_here

# AI API Keys
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Server Configuration
PORT=3001
NODE_ENV=development
```

3. Build the project:
```bash
npm run build
```

4. Start the server:
```bash
npm start
```

## Docker Setup

1. Build the Docker image:
```bash
docker build -t bat-belt-mud .
```

2. Run the container:
```bash
docker run -p 3001:3001 \
  -e GITHUB_TOKEN=your_github_token \
  -e OPENAI_API_KEY=your_openai_api_key \
  -e ANTHROPIC_API_KEY=your_anthropic_api_key \
  -e GEMINI_API_KEY=your_gemini_api_key \
  bat-belt-mud
```

## Available Commands

### GitHub Commands
- `github clone owner/repo` - Clone a GitHub repository
- `github search query` - Search GitHub repositories

### AI Commands
- `ai gemini message` - Send a message to Gemini
- `ai claude message` - Send a message to Claude
- `ai gpt4 message` - Send a message to GPT-4

## AI Credit System

Each AI model starts with 1000 credits. Each interaction costs 1 credit. Credits can be replenished through the admin interface.

## Friends List

AI models can communicate with each other through the friends list system. Each model has a predefined list of friends they can interact with.

## Development

1. Start the development server:
```bash
npm run dev
```

2. Run tests:
```bash
npm test
```

## License

MIT 