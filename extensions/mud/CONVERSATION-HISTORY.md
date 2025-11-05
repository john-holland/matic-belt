# 💬 Conversation History & Context Management

## Overview

The MUD server now maintains conversation history for AI interactions to provide context-aware responses. This is especially useful for Gemini AI interactions.

## How It Works

### Conversation History Storage
- **Per-user storage**: Each socket connection (user) gets their own conversation history
- **Size limit**: Last 20 messages (10 exchanges) are kept to maintain context
- **Automatic cleanup**: Old messages are removed when history exceeds the limit
- **Memory-based**: Currently stored in memory (cleared on server restart)

### Token Usage & API Limits

**Is it safe?** ✅ Yes, with proper limits:

1. **Smart Limiting**: We only keep the last 20 messages (not entire conversation)
2. **Gemini Context Caching**: Gemini API supports implicit caching, which can reduce token costs for repeated context
3. **Controlled Growth**: Each conversation is capped, preventing unbounded token usage

**Token Impact:**
- Each message in history adds to token count
- 20 messages ≈ ~2000-4000 tokens (depending on message length)
- Still well within Gemini's context limits (millions of tokens)
- Context caching can reduce actual costs

### Best Practices

1. **Keep history short**: 20 messages is a good balance
2. **Consider summarization**: For very long conversations, could summarize old context
3. **Per-user isolation**: Each user's history is separate
4. **Optional persistence**: Can be saved to disk if needed for persistence

## Configuration

Currently hardcoded to 20 messages. To change:
```typescript
// In handleAICommand, adjust the limit:
if (conversation.length > 20) {
    conversation = conversation.slice(-20);
}
```

## Future Enhancements

- **Persistent storage**: Save conversation history to disk
- **Summarization**: Summarize old context when it gets too long
- **User-configurable**: Let users set their own history length
- **Context caching**: Use Gemini's explicit caching API for better cost efficiency

