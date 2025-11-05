import * as fs from 'fs';
import * as path from 'path';

interface ParsedApiKeys {
    githubToken?: string;
    geminiApiKey?: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
}

/**
 * Load API keys from mud_access_token file
 * The file format is:
 * Personal access token for the mud:
 * <token>
 * 
 * Gemini access token:
 * <key>
 * 
 * OpenAi chatgpt api key:
 * <key>
 */
export function loadApiKeysFromFile(filePath?: string): ParsedApiKeys {
    const keys: ParsedApiKeys = {};
    
    try {
        // Try multiple possible paths
        const possiblePaths = [
            filePath,
            path.join(__dirname, '../../thefly/src/mud_access_token'),
            path.join(process.cwd(), 'extensions/thefly/src/mud_access_token'),
            path.join(__dirname, '../mud_access_token'),
            path.join(process.cwd(), 'mud_access_token')
        ].filter(Boolean) as string[];

        let content: string | null = null;
        let foundPath: string | null = null;

        for (const testPath of possiblePaths) {
            if (fs.existsSync(testPath)) {
                content = fs.readFileSync(testPath, 'utf-8');
                foundPath = testPath;
                break;
            }
        }

        if (!content) {
            console.log('ℹ️ mud_access_token file not found, using environment variables only');
            return keys;
        }

        console.log(`✅ Loading API keys from: ${foundPath}`);

        // Parse the file content
        const lines = content.split('\n');
        let currentSection: string | null = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Detect section headers
            if (line.toLowerCase().includes('personal access token') || 
                line.toLowerCase().includes('github')) {
                currentSection = 'github';
            } else if (line.toLowerCase().includes('gemini')) {
                currentSection = 'gemini';
            } else if (line.toLowerCase().includes('openai') || 
                       line.toLowerCase().includes('chatgpt')) {
                currentSection = 'openai';
            } else if (line.toLowerCase().includes('anthropic') || 
                       line.toLowerCase().includes('claude')) {
                currentSection = 'anthropic';
            } else if (line && currentSection) {
                // This is likely the key/token value
                // Skip if it looks like a comment or empty
                if (!line.startsWith('#') && !line.startsWith('//') && line.length > 5) {
                    switch (currentSection) {
                        case 'github':
                            if (!keys.githubToken) {
                                keys.githubToken = line;
                            }
                            break;
                        case 'gemini':
                            if (!keys.geminiApiKey) {
                                keys.geminiApiKey = line;
                            }
                            break;
                        case 'openai':
                            if (!keys.openaiApiKey) {
                                keys.openaiApiKey = line;
                            }
                            break;
                        case 'anthropic':
                            if (!keys.anthropicApiKey) {
                                keys.anthropicApiKey = line;
                            }
                            break;
                    }
                    currentSection = null; // Reset after finding key
                }
            }
        }

        // Log what was found
        const foundKeys = Object.keys(keys);
        if (foundKeys.length > 0) {
            console.log(`   Found keys: ${foundKeys.join(', ')}`);
        }

    } catch (error) {
        console.error('⚠️ Error loading API keys from file:', error);
    }

    return keys;
}

/**
 * Get API key with fallback: environment variable first, then file
 */
export function getApiKey(envVar: string, fileKey?: string): string | undefined {
    // Prefer environment variable
    if (process.env[envVar]) {
        return process.env[envVar];
    }
    // Fallback to file
    if (fileKey) {
        return fileKey;
    }
    return undefined;
}

