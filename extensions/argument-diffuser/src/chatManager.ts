import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { 
  ChatMessage, 
  ChatSession, 
  ChatSettings, 
  ArgumentDiffusalRequest, 
  ArgumentDiffusalResponse 
} from './types';
import { getTemplateById } from './roleplayTemplates';

export class ChatManager {
  private openai: OpenAI;
  private sessions: Map<string, ChatSession>;
  private defaultSettings: ChatSettings;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
    this.sessions = new Map();
    this.defaultSettings = {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000,
      systemPrompt: 'You are a helpful assistant specializing in conflict resolution and argument diffusal.',
      roleplayStyle: 'therapeutic'
    };
  }

  async createSession(preface: string, roleplay: string, settings?: Partial<ChatSettings>): Promise<string> {
    const sessionId = uuidv4();
    const session: ChatSession = {
      id: sessionId,
      preface,
      roleplay,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: { ...this.defaultSettings, ...settings }
    };

    // Add system message with roleplay context
    const systemMessage: ChatMessage = {
      id: uuidv4(),
      role: 'system',
      content: this.buildSystemPrompt(preface, roleplay, session.settings),
      timestamp: new Date(),
      metadata: {
        preface,
        roleplay,
        context: 'system-initialization'
      }
    };

    session.messages.push(systemMessage);
    this.sessions.set(sessionId, session);
    return sessionId;
  }

  private buildSystemPrompt(preface: string, roleplay: string, settings: ChatSettings): string {
    let systemPrompt = settings.systemPrompt;
    
    // If roleplay is a template ID, use the template's system prompt
    const template = getTemplateById(roleplay);
    if (template) {
      systemPrompt = template.systemPrompt;
    }

    return `${systemPrompt}

CONTEXT: ${preface}

IMPORTANT INSTRUCTIONS:
1. Stay in character as specified in the roleplay
2. Focus on diffusing arguments and resolving conflicts constructively
3. Use active listening and empathetic responses
4. Provide practical advice and perspective
5. Help the user see multiple viewpoints and find common ground
6. Maintain a supportive and constructive tone throughout the conversation

Remember: Your goal is to help resolve conflicts, not escalate them. Always seek understanding and peaceful resolution.`;
  }

  async processMessage(request: ArgumentDiffusalRequest): Promise<ArgumentDiffusalResponse> {
    let sessionId = request.sessionId;
    
    // Create new session if none exists
    if (!sessionId) {
      sessionId = await this.createSession(
        request.preface, 
        request.roleplay, 
        request.settings
      );
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: request.message,
      timestamp: new Date(),
      metadata: {
        preface: request.preface,
        roleplay: request.roleplay
      }
    };

    session.messages.push(userMessage);
    session.updatedAt = new Date();

    // Prepare messages for OpenAI
    const openaiMessages = session.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    try {
      // Get response from ChatGPT
      const completion = await this.openai.chat.completions.create({
        model: session.settings.model,
        messages: openaiMessages,
        temperature: session.settings.temperature,
        max_tokens: session.settings.maxTokens,
      });

      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: completion.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response. Please try again.',
        timestamp: new Date(),
        metadata: {
          preface: request.preface,
          roleplay: request.roleplay,
          context: 'chatgpt-response'
        }
      };

      session.messages.push(assistantMessage);
      session.updatedAt = new Date();

      // Generate suggestions and next steps
      const suggestions = this.generateSuggestions(session);
      const nextSteps = this.generateNextSteps(session);

      return {
        sessionId,
        message: assistantMessage,
        suggestions,
        nextSteps
      };

    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to get response from ChatGPT');
    }
  }

  private generateSuggestions(session: ChatSession): string[] {
    const suggestions = [
      "Try to see the situation from the other person's perspective",
      "Focus on the facts rather than emotions",
      "Use 'I feel' statements to express your emotions",
      "Look for common ground and shared interests",
      "Consider taking a break if emotions are running high"
    ];

    // Customize suggestions based on roleplay style
    if (session.settings.roleplayStyle === 'therapeutic') {
      suggestions.push("Practice self-compassion and emotional self-care");
      suggestions.push("Reflect on what this conflict is teaching you about yourself");
    } else if (session.settings.roleplayStyle === 'mediator') {
      suggestions.push("Ask clarifying questions to understand the other person's needs");
      suggestions.push("Identify the underlying interests driving the conflict");
    }

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  private generateNextSteps(session: ChatSession): string[] {
    const nextSteps = [
      "Continue this conversation to explore the conflict deeper",
      "Practice the communication techniques discussed",
      "Consider scheduling a follow-up conversation with the other party"
    ];

    if (session.messages.length > 5) {
      nextSteps.push("Review the conversation to identify key insights and progress");
    }

    return nextSteps;
  }

  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values());
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  updateSessionSettings(sessionId: string, settings: Partial<ChatSettings>): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.settings = { ...session.settings, ...settings };
      session.updatedAt = new Date();
      return true;
    }
    return false;
  }
}







