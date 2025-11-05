export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    preface?: string;
    roleplay?: string;
    emotion?: string;
    context?: string;
  };
}

export interface ChatSession {
  id: string;
  preface: string;
  roleplay: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  settings: ChatSettings;
}

export interface ChatSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  roleplayStyle: 'therapeutic' | 'mediator' | 'friend' | 'expert' | 'custom';
}

export interface RoleplayTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  examples: string[];
  category: 'therapeutic' | 'mediator' | 'friend' | 'expert' | 'custom';
}

export interface ArgumentDiffusalRequest {
  sessionId?: string;
  message: string;
  preface: string;
  roleplay: string;
  settings?: Partial<ChatSettings>;
}

export interface ArgumentDiffusalResponse {
  sessionId: string;
  message: ChatMessage;
  suggestions?: string[];
  nextSteps?: string[];
}









