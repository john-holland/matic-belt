import { chromium, Browser, Page } from 'playwright';
import { AutomationConfig, Step, AIConfig } from '../config/schema';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

export class AutomationRunner {
    private browser: Browser | null = null;
    private page: Page | null = null;
    private config: AutomationConfig;
    private variables: Map<string, string> = new Map();
    private responses: Map<string, string> = new Map();

    constructor(configPath: string) {
        this.config = this.loadConfig(configPath);
        this.initializeVariables();
    }

    private loadConfig(configPath: string): AutomationConfig {
        const fileContents = fs.readFileSync(configPath, 'utf8');
        return yaml.load(fileContents) as AutomationConfig;
    }

    private initializeVariables() {
        if (this.config.variables) {
            Object.entries(this.config.variables).forEach(([key, value]) => {
                this.variables.set(key, value);
            });
        }
    }

    private async initializeBrowser() {
        this.browser = await chromium.launch({
            headless: this.config.browser.headless
        });

        this.page = await this.browser.newPage();
        await this.page.setViewportSize(this.config.browser.viewport);
    }

    private async executeStep(step: Step): Promise<boolean> {
        if (!this.page) throw new Error('Browser not initialized');

        try {
            // Navigate to AI URL
            await this.page.goto(this.interpolateVariables(step.ai.url));

            // Wait for required elements
            if (step.ai.waitFor) {
                for (const selector of step.ai.waitFor) {
                    await this.page.waitForSelector(selector);
                }
            }

            // Handle input
            const input = Array.isArray(step.input) 
                ? step.input.map(i => this.interpolateVariables(i))
                : this.interpolateVariables(step.input);

            if (Array.isArray(input)) {
                for (const message of input) {
                    await this.sendMessage(step.ai, message);
                }
            } else {
                await this.sendMessage(step.ai, input);
            }

            // Wait for and validate response
            const response = await this.waitForResponse(step);
            
            if (step.saveResponse) {
                this.responses.set(step.saveResponse, response);
            }

            if (step.validate) {
                return this.validateResponse(response, step.validate);
            }

            return true;
        } catch (error) {
            console.error(`Error in step ${step.name}:`, error);
            return false;
        }
    }

    private async sendMessage(aiConfig: AIConfig, message: string) {
        if (!this.page) throw new Error('Browser not initialized');

        await this.page.fill(aiConfig.selectors.input, message);
        await this.page.click(aiConfig.selectors.submit);
    }

    private async waitForResponse(step: Step): Promise<string> {
        if (!this.page) throw new Error('Browser not initialized');

        const timeout = step.timeout || this.config.browser.timeout;
        const response = await this.page.waitForSelector(
            step.ai.selectors.response,
            { timeout }
        );

        return await response.textContent() || '';
    }

    private validateResponse(response: string, validation: Step['validate']): boolean {
        if (!validation) return true;

        switch (validation.type) {
            case 'contains':
                return response.includes(validation.value);
            case 'equals':
                return response === validation.value;
            case 'regex':
                return new RegExp(validation.value).test(response);
            default:
                return true;
        }
    }

    private interpolateVariables(text: string): string {
        return text.replace(/\${([^}]+)}/g, (match, key) => {
            return this.variables.get(key) || match;
        });
    }

    public async run() {
        try {
            await this.initializeBrowser();

            for (const step of this.config.steps) {
                let success = false;
                let attempts = 0;
                const maxAttempts = step.retryOnFailure 
                    ? (this.config.onError?.maxAttempts || 1)
                    : 1;

                while (!success && attempts < maxAttempts) {
                    success = await this.executeStep(step);
                    attempts++;

                    if (!success && attempts < maxAttempts) {
                        const delay = this.config.onError?.delay || 1000;
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }

                if (!success) {
                    throw new Error(`Step ${step.name} failed after ${maxAttempts} attempts`);
                }
            }
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }

    public getResponse(key: string): string | undefined {
        return this.responses.get(key);
    }

    public setVariable(key: string, value: string) {
        this.variables.set(key, value);
    }
} 