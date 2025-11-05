# API Keys and Environment Variables Guide

This document lists all the API keys and environment variables needed for the AI MUD server.

## Required API Keys

### AI Service API Keys

#### 1. **GEMINI_API_KEY** (Google Gemini)
- **Purpose**: Enables Gemini AI model integration (`ai gemini <message>`)
- **Where to get**: https://aistudio.google.com/app/apikey
- **Usage**: Google's Gemini models (gemini-2.0-flash-exp)
- **Required**: Yes (if using Gemini)

```bash
export GEMINI_API_KEY="your_gemini_api_key_here"
```

#### 2. **OPENAI_API_KEY** (OpenAI GPT-4)
- **Purpose**: Enables GPT-4 AI model integration (`ai gpt4 <message>`)
- **Where to get**: https://platform.openai.com/api-keys
- **Usage**: OpenAI's GPT-4 models
- **Required**: Yes (if using GPT-4)

```bash
export OPENAI_API_KEY="sk-your_openai_api_key_here"
```

#### 3. **ANTHROPIC_API_KEY** (Anthropic Claude)
- **Purpose**: Enables Claude AI model integration (`ai claude <message>`)
- **Where to get**: https://console.anthropic.com/settings/keys
- **Usage**: Anthropic's Claude models (claude-3-opus-20240229)
- **Required**: Yes (if using Claude)

```bash
export ANTHROPIC_API_KEY="sk-ant-your_anthropic_api_key_here"
```

### GitHub Integration

#### 4. **GITHUB_TOKEN**
- **Purpose**: Enables GitHub repository search and cloning (`github search <query>`)
- **Where to get**: https://github.com/settings/tokens
- **Usage**: GitHub API access
- **Required**: Optional (for GitHub commands)
- **Permissions needed**: `repo` (for cloning), `public_repo` (for search)

```bash
export GITHUB_TOKEN="ghp_your_github_token_here"
```

### Optional Services

#### 5. **WEATHER_API_KEY** (OpenWeatherMap)
- **Purpose**: Weather and time service integration
- **Where to get**: https://openweathermap.org/api
- **Usage**: Weather data for `/weather` endpoint
- **Required**: Optional

```bash
export WEATHER_API_KEY="your_weather_api_key_here"
```

## Environment Variables

### Server Configuration

```bash
# Server port (default: 3001)
PORT=3001

# Node environment
NODE_ENV=development
```

## Complete .env File Example

Create a `.env` file in the `extensions/mud/` directory:

```env
# AI API Keys
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=sk-your_openai_api_key_here
ANTHROPIC_API_KEY=sk-ant-your_anthropic_api_key_here

# GitHub Integration
GITHUB_TOKEN=ghp_your_github_token_here

# Optional Services
WEATHER_API_KEY=your_weather_api_key_here

# Server Configuration
PORT=3001
NODE_ENV=development
```

## API Key Costs & Limits

### Gemini
- **Free tier**: 15 requests/minute, 1500 requests/day
- **Paid**: Variable pricing based on model
- **Model used**: `gemini-2.0-flash-exp`

### OpenAI (GPT-4)
- **Pricing**: ~$0.03 per 1K input tokens, ~$0.06 per 1K output tokens
- **Rate limits**: Varies by tier
- **Model used**: `gpt-4`

### Anthropic (Claude)
- **Pricing**: ~$0.015 per 1K input tokens, ~$0.075 per 1K output tokens
- **Rate limits**: Varies by tier
- **Model used**: `claude-3-opus-20240229`

## Testing API Keys

After setting up your API keys, test them:

```bash
# In the MUD interface:
ai gemini hello
ai gpt4 hello
ai claude hello
github search test
```

## Security Notes

1. **Never commit `.env` files** to version control
2. **Use environment variables** in production, not hardcoded keys
3. **Rotate API keys** regularly
4. **Use least-privilege permissions** for GitHub tokens
5. **Monitor API usage** to avoid unexpected costs

## Troubleshooting

### "Insufficient credits or invalid AI type"
- Make sure AI users are initialized (they should auto-initialize)
- Check that you're using the correct AI type: `gemini`, `claude`, `gpt4`, or `local`
- Credits start at 1000 per AI model

### "Gemini not initialized"
- Check that `GEMINI_API_KEY` is set in your `.env` file
- Restart the server after adding the key

### "GitHub not initialized"
- Check that `GITHUB_TOKEN` is set
- Verify the token has the correct permissions

## Comparison with Cursor

Unlike Cursor (which is a proprietary IDE with its own backend), this MUD server requires:

1. **Direct API keys** to each AI service (Gemini, OpenAI, Anthropic)
2. **No Cursor-specific tokens** needed
3. **Self-hosted** - you control the API usage and costs
4. **Open source** - you can see exactly what's being sent to each API

Cursor handles API keys internally, but this MUD server gives you direct control and transparency over which AI services you use.

