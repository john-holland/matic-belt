# Argument Diffuser 🕊️

A ChatGPT-powered argument diffusal chat tool with role-playing capabilities. Resolve conflicts, diffuse arguments, and find peaceful solutions through AI-powered conversations.

## Features

- **Role-Playing AI Companions**: Choose from therapeutic counselor, neutral mediator, wise friend, conflict expert, or create custom characters
- **Context-Aware Conversations**: Provide detailed context and the AI adapts its responses accordingly
- **Real-Time Chat Interface**: Modern, responsive web interface with real-time messaging
- **Smart Suggestions**: Get helpful suggestions and next steps during conversations
- **Session Management**: Save, export, and manage your conversation sessions
- **Multiple AI Models**: Support for GPT-4 and GPT-3.5 Turbo

## Quick Start

### Prerequisites

- Node.js 18+ 
- OpenAI API key
- npm or yarn

### Installation

1. **Clone and navigate to the extension:**
   ```bash
   cd extensions/argument-diffuser
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and add your OpenAI API key:
   ```env
   OPENAI_API_KEY=your_actual_api_key_here
   PORT=3001
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

5. **Start the server:**
   ```bash
   npm start
   ```

6. **Open your browser:**
   Navigate to `http://localhost:3001`

## Usage

### 1. Setup Your Conversation

- **Context & Preface**: Describe the conflict or situation you're dealing with
- **Choose AI Companion**: Select from predefined roleplay templates or create custom ones
- **AI Model**: Choose between GPT-4 (recommended) or GPT-3.5 Turbo

### 2. Start Chatting

- Click "Start Conversation" to begin
- The AI will respond in character based on your selected roleplay
- Continue the conversation naturally

### 3. Get Helpful Insights

- **Suggestions**: Practical advice for resolving conflicts
- **Next Steps**: Guidance on how to proceed
- **Export**: Save your conversations for later review

## Roleplay Templates

### 🧠 Therapeutic Counselor
A compassionate therapist who helps resolve emotional conflicts through active listening, emotional validation, and perspective shifting.

### ⚖️ Neutral Mediator
An impartial mediator who facilitates fair dialogue, identifies common ground, and helps parties reach their own resolution.

### 🤝 Wise Friend
A caring friend who offers perspective, emotional support, and gentle guidance based on shared life experiences.

### 🎯 Conflict Resolution Expert
A professional expert who provides strategic advice, communication techniques, and evidence-based conflict resolution frameworks.

### 🎭 Custom Roleplay
Create your own unique character and scenario for the AI to roleplay.

## API Endpoints

### Templates
- `GET /api/templates` - Get all roleplay templates
- `GET /api/templates/:category` - Get templates by category

### Sessions
- `GET /api/sessions` - Get all chat sessions
- `GET /api/sessions/:id` - Get specific session
- `DELETE /api/sessions/:id` - Delete session
- `POST /api/sessions/:id/settings` - Update session settings

### Chat
- `POST /api/chat` - Send message and get AI response

### Health
- `GET /health` - Server health check

## Development

### Project Structure
```
src/
├── types.ts              # TypeScript type definitions
├── roleplayTemplates.ts  # Predefined roleplay templates
├── chatManager.ts        # Core chat logic and OpenAI integration
├── server.ts            # Express server and API endpoints
└── index.ts             # Main entry point

public/
├── index.html           # Main web interface
├── styles.css           # Styling
└── app.js              # Frontend JavaScript logic
```

### Available Scripts

- `npm run build` - Build TypeScript to JavaScript
- `npm run dev` - Watch mode for development
- `npm start` - Start the production server
- `npm test` - Run tests

### Adding New Roleplay Templates

1. Edit `src/roleplayTemplates.ts`
2. Add your template to the `ROLEPLAY_TEMPLATES` array
3. Include:
   - Unique ID
   - Name and description
   - System prompt for the AI
   - Example responses
   - Category

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | Required |
| `PORT` | Server port | 3001 |
| `OPENAI_ORG_ID` | OpenAI organization ID | Optional |
| `OPENAI_BASE_URL` | Custom OpenAI API base URL | Optional |

### Customizing AI Behavior

Modify the system prompts in `src/roleplayTemplates.ts` to change how the AI responds in different roles.

## Troubleshooting

### Common Issues

1. **"Failed to start chat session"**
   - Check your OpenAI API key in `.env`
   - Ensure you have sufficient API credits
   - Verify the API key is valid

2. **"Failed to load templates"**
   - Check server is running
   - Verify port 3001 is available
   - Check browser console for errors

3. **Slow responses**
   - Consider switching to GPT-3.5 Turbo for faster responses
   - Check your internet connection
   - Monitor OpenAI API rate limits

### Debug Mode

Enable debug logging by setting:
```env
DEBUG=argument-diffuser:*
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the troubleshooting section
- Review the API documentation
- Open an issue on GitHub

---

**Happy conflict resolution! 🕊️✨**









