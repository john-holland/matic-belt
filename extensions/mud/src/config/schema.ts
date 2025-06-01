export interface BrowserConfig {
    headless: boolean;
    viewport: {
        width: number;
        height: number;
    };
    timeout: number;
}

export interface AIConfig {
    type: 'gemini' | 'claude' | 'gpt4';
    url: string;
    selectors: {
        input: string;
        submit: string;
        response: string;
        error?: string;
    };
    waitFor?: string[];
    retryAttempts?: number;
    retryDelay?: number;
}

export interface Step {
    name: string;
    ai: AIConfig;
    input: string | string[];
    expected?: string;
    timeout?: number;
    retryOnFailure?: boolean;
    saveResponse?: string;
    validate?: {
        type: 'contains' | 'equals' | 'regex';
        value: string;
    };
}

export interface AutomationConfig {
    version: string;
    name: string;
    description?: string;
    browser: BrowserConfig;
    steps: Step[];
    variables?: Record<string, string>;
    onError?: {
        retry: boolean;
        maxAttempts: number;
        delay: number;
    };
} 