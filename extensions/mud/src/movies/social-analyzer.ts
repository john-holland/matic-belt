import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs';

interface Actor {
    id: string;
    name: string;
    handle: string;
    friendScore: number;
    appearances: number;
    lastSeen: number;
    chatMessages: number;
    captions: string[];
    mediaContext: MediaContext;
}

interface MediaContext {
    videoId: string;
    timestamp: number;
    scene: string;
    context: string;
}

interface Caption {
    text: string;
    startTime: number;
    endTime: number;
    speaker?: string;
}

interface ChatMessage {
    userId: string;
    handle: string;
    message: string;
    timestamp: number;
    context?: string;
}

export interface SocialAnalysis {
    timestamp: number;
    actors: Map<string, Actor>;
    activeFriends: string[];
    chatActivity: number;
    captionActivity: number;
    socialCoherence: number;
}

export class SocialAnalyzer extends EventEmitter {
    private actors: Map<string, Actor> = new Map();
    private captions: Caption[] = [];
    private chatMessages: ChatMessage[] = [];
    private isAnalyzing: boolean = false;
    private friendThreshold: number = 0.7;
    private maxContextWindow: number = 3600; // 1 hour in seconds
    private minAppearances: number = 3;
    private minChatMessages: number = 5;

    constructor() {
        super();
    }

    public async analyzeFrame(
        videoElement: HTMLVideoElement,
        currentTime: number
    ): Promise<SocialAnalysis> {
        if (!this.isAnalyzing) return this.getEmptyAnalysis();

        // Extract captions from video
        await this.extractCaptions(videoElement, currentTime);

        // Process captions for actor detection
        this.processCaptions(currentTime);

        // Update actor friend scores
        this.updateActorScores();

        // Calculate social metrics
        const socialCoherence = this.calculateSocialCoherence();
        const chatActivity = this.calculateChatActivity(currentTime);
        const captionActivity = this.calculateCaptionActivity(currentTime);

        // Get active friends
        const activeFriends = this.getActiveFriends(currentTime);

        const analysis: SocialAnalysis = {
            timestamp: currentTime,
            actors: new Map(this.actors),
            activeFriends,
            chatActivity,
            captionActivity,
            socialCoherence
        };

        this.emit('analysis', analysis);
        return analysis;
    }

    private async extractCaptions(videoElement: HTMLVideoElement, currentTime: number) {
        // Get captions from video element
        const track = videoElement.textTracks[0];
        if (!track) return;

        // Process active cues
        for (let i = 0; i < track.activeCues.length; i++) {
            const cue = track.activeCues[i];
            if (cue instanceof TextTrackCue) {
                this.captions.push({
                    text: cue.text,
                    startTime: cue.startTime,
                    endTime: cue.endTime,
                    speaker: this.detectSpeaker(cue.text)
                });
            }
        }

        // Clean up old captions
        this.cleanupOldCaptions(currentTime);
    }

    private detectSpeaker(text: string): string | undefined {
        // Look for speaker patterns like "Speaker: " or "[Speaker]"
        const speakerMatch = text.match(/^([^:]+):|\[([^\]]+)\]/);
        return speakerMatch ? (speakerMatch[1] || speakerMatch[2]) : undefined;
    }

    private processCaptions(currentTime: number) {
        for (const caption of this.captions) {
            // Extract potential actor names/handles
            const actors = this.extractActorsFromText(caption.text);
            
            for (const actor of actors) {
                this.updateActor(actor, {
                    videoId: 'current',
                    timestamp: currentTime,
                    scene: this.getCurrentScene(currentTime),
                    context: caption.text
                });
            }
        }
    }

    private extractActorsFromText(text: string): string[] {
        // Look for common patterns in text that might indicate actor names/handles
        const patterns = [
            /@(\w+)/g,  // @handle
            /\[(\w+)\]/g,  // [handle]
            /(\w+):/g,  // handle:
            /^(\w+)\s+says:/g  // handle says:
        ];

        const actors = new Set<string>();
        for (const pattern of patterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
                actors.add(match[1].toLowerCase());
            }
        }

        return Array.from(actors);
    }

    private updateActor(handle: string, context: MediaContext) {
        const actor = this.actors.get(handle) || {
            id: handle,
            name: handle,
            handle,
            friendScore: 0,
            appearances: 0,
            lastSeen: 0,
            chatMessages: 0,
            captions: [],
            mediaContext: context
        };

        actor.appearances++;
        actor.lastSeen = context.timestamp;
        actor.captions.push(context.context);
        actor.mediaContext = context;

        this.actors.set(handle, actor);
    }

    public addChatMessage(message: ChatMessage) {
        this.chatMessages.push(message);
        
        // Update actor if they exist
        const actor = this.actors.get(message.handle);
        if (actor) {
            actor.chatMessages++;
            actor.lastSeen = message.timestamp;
        }

        // Clean up old messages
        this.cleanupOldMessages(message.timestamp);
    }

    private updateActorScores() {
        for (const [handle, actor] of this.actors) {
            // Calculate friend score based on multiple factors
            const appearanceScore = Math.min(actor.appearances / this.minAppearances, 1);
            const chatScore = Math.min(actor.chatMessages / this.minChatMessages, 1);
            const contextScore = this.calculateContextScore(actor);
            const timeScore = this.calculateTimeScore(actor);

            actor.friendScore = (
                appearanceScore * 0.3 +
                chatScore * 0.3 +
                contextScore * 0.2 +
                timeScore * 0.2
            );
        }
    }

    private calculateContextScore(actor: Actor): number {
        // Analyze the context of actor's appearances
        let score = 0;
        const positiveContexts = ['help', 'friend', 'ally', 'team', 'support'];
        const negativeContexts = ['enemy', 'foe', 'opponent', 'attack', 'fight'];

        for (const caption of actor.captions) {
            const text = caption.toLowerCase();
            if (positiveContexts.some(ctx => text.includes(ctx))) {
                score += 0.2;
            }
            if (negativeContexts.some(ctx => text.includes(ctx))) {
                score -= 0.2;
            }
        }

        return Math.max(0, Math.min(1, 0.5 + score));
    }

    private calculateTimeScore(actor: Actor): number {
        const now = Date.now() / 1000;
        const timeSinceLastSeen = now - actor.lastSeen;
        
        // Higher score for more recent activity
        return Math.max(0, 1 - (timeSinceLastSeen / this.maxContextWindow));
    }

    private getActiveFriends(currentTime: number): string[] {
        return Array.from(this.actors.entries())
            .filter(([_, actor]) => 
                actor.friendScore >= this.friendThreshold &&
                currentTime - actor.lastSeen < this.maxContextWindow
            )
            .map(([handle, _]) => handle);
    }

    private calculateSocialCoherence(): number {
        if (this.actors.size === 0) return 1.0;

        // Calculate how well actors interact with each other
        let totalCoherence = 0;
        let interactions = 0;

        for (const [handle1, actor1] of this.actors) {
            for (const [handle2, actor2] of this.actors) {
                if (handle1 === handle2) continue;

                const coherence = this.calculateActorCoherence(actor1, actor2);
                totalCoherence += coherence;
                interactions++;
            }
        }

        return interactions > 0 ? totalCoherence / interactions : 1.0;
    }

    private calculateActorCoherence(actor1: Actor, actor2: Actor): number {
        // Calculate how often actors appear together in captions
        let sharedContexts = 0;
        for (const caption1 of actor1.captions) {
            for (const caption2 of actor2.captions) {
                if (this.areCaptionsRelated(caption1, caption2)) {
                    sharedContexts++;
                }
            }
        }

        return Math.min(sharedContexts / 10, 1.0);
    }

    private areCaptionsRelated(caption1: string, caption2: string): boolean {
        // Check if captions are related (e.g., same scene, conversation)
        const words1 = new Set(caption1.toLowerCase().split(/\W+/));
        const words2 = new Set(caption2.toLowerCase().split(/\W+/));
        
        const commonWords = new Set([...words1].filter(x => words2.has(x)));
        return commonWords.size >= 3;
    }

    private calculateChatActivity(currentTime: number): number {
        const recentMessages = this.chatMessages.filter(
            msg => currentTime - msg.timestamp < this.maxContextWindow
        );
        return Math.min(recentMessages.length / 100, 1.0);
    }

    private calculateCaptionActivity(currentTime: number): number {
        const recentCaptions = this.captions.filter(
            caption => currentTime - caption.endTime < this.maxContextWindow
        );
        return Math.min(recentCaptions.length / 50, 1.0);
    }

    private cleanupOldCaptions(currentTime: number) {
        this.captions = this.captions.filter(
            caption => currentTime - caption.endTime < this.maxContextWindow
        );
    }

    private cleanupOldMessages(currentTime: number) {
        this.chatMessages = this.chatMessages.filter(
            msg => currentTime - msg.timestamp < this.maxContextWindow
        );
    }

    private getCurrentScene(currentTime: number): string {
        // Find the most recent caption that might indicate a scene
        const recentCaption = this.captions
            .filter(c => c.endTime <= currentTime)
            .pop();

        return recentCaption?.text || 'Unknown Scene';
    }

    private getEmptyAnalysis(): SocialAnalysis {
        return {
            timestamp: Date.now(),
            actors: new Map(),
            activeFriends: [],
            chatActivity: 0,
            captionActivity: 0,
            socialCoherence: 1.0
        };
    }

    public startAnalysis() {
        this.isAnalyzing = true;
    }

    public stopAnalysis() {
        this.isAnalyzing = false;
    }

    public setFriendThreshold(threshold: number) {
        this.friendThreshold = Math.max(0, Math.min(1, threshold));
    }

    public getCurrentAnalysis(): SocialAnalysis {
        return {
            timestamp: Date.now(),
            actors: new Map(this.actors),
            activeFriends: this.getActiveFriends(Date.now() / 1000),
            chatActivity: this.calculateChatActivity(Date.now() / 1000),
            captionActivity: this.calculateCaptionActivity(Date.now() / 1000),
            socialCoherence: this.calculateSocialCoherence()
        };
    }
} 