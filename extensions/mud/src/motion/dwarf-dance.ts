import { DanceInterpolator } from './dance-interpolator';
import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs';

interface DwarfDanceState {
    isDancing: boolean;
    currentStyle: string;
    energy: number;
    mood: string;
    lastMotion: tf.Tensor | null;
}

export class DwarfDanceController extends EventEmitter {
    private danceInterpolator: DanceInterpolator;
    private state: DwarfDanceState;
    private danceStyles: Map<string, string[]>;
    private moodResponses: Map<string, string[]>;

    constructor() {
        super();
        this.danceInterpolator = new DanceInterpolator();
        this.state = {
            isDancing: false,
            currentStyle: 'hip-hop',
            energy: 0.5,
            mood: 'neutral',
            lastMotion: null
        };

        // Initialize dance styles with dwarf-specific moves
        this.danceStyles = new Map([
            ['hip-hop', [
                'dwarven_shuffle',
                'axe_swing',
                'beard_whip',
                'mining_rhythm'
            ]],
            ['ballet', [
                'graceful_swing',
                'precise_pickaxe',
                'gem_collector',
                'crystal_pose'
            ]],
            ['jazz', [
                'forge_swing',
                'hammer_tap',
                'anvil_bounce',
                'metal_grind'
            ]],
            ['contemporary', [
                'cave_explorer',
                'gem_finder',
                'crystal_flow',
                'mountain_pose'
            ]]
        ]);

        // Initialize mood responses
        this.moodResponses = new Map([
            ['happy', [
                "Yahaha! *swings beard rhythmically*",
                "Ho ho! Watch this move! *taps anvil*",
                "Aye, that's the spirit! *shuffles feet*"
            ]],
            ['energetic', [
                "Feel the rhythm of the mountain!",
                "Watch me work this forge!",
                "This is how we dance in the deep!"
            ]],
            ['tired', [
                "Huff... *wipes brow* One more move!",
                "Phew... *leans on pickaxe* That's the spirit!",
                "Whew... *adjusts beard* Still got it!"
            ]],
            ['neutral', [
                "Hmm... *nods to the beat*",
                "Not bad, not bad at all!",
                "Aye, that's a fine rhythm!"
            ]]
        ]);

        // Set up event listeners
        this.danceInterpolator.on('motionCaptured', this.handleMotion.bind(this));
        this.danceInterpolator.on('midiGenerated', this.handleMIDI.bind(this));
    }

    public wakeUp(): void {
        this.state.energy = 0.3; // Start with low energy
        this.state.mood = 'neutral';
        this.emit('status', {
            message: "*stretches and yawns* Aye, I'm awake! What's the occasion?",
            energy: this.state.energy,
            mood: this.state.mood
        });
    }

    public startDancing(): void {
        if (this.state.isDancing) {
            this.emit('status', {
                message: "I'm already dancing! *continues current move*",
                energy: this.state.energy,
                mood: this.state.mood
            });
            return;
        }

        this.state.isDancing = true;
        this.danceInterpolator.startRecording();
        
        const response = this.getMoodResponse();
        this.emit('status', {
            message: response,
            energy: this.state.energy,
            mood: this.state.mood
        });
    }

    public stopDancing(): void {
        if (!this.state.isDancing) {
            this.emit('status', {
                message: "I wasn't dancing, but I'm ready when you are!",
                energy: this.state.energy,
                mood: this.state.mood
            });
            return;
        }

        this.state.isDancing = false;
        this.danceInterpolator.stopRecording();
        
        const analysis = this.danceInterpolator.getAnalysis();
        this.emit('status', {
            message: this.getDanceSummary(analysis),
            energy: this.state.energy,
            mood: this.state.mood,
            analysis
        });
    }

    private handleMotion(data: any): void {
        // Update state based on motion
        this.state.lastMotion = data.motion;
        this.state.currentStyle = data.style;
        
        // Update energy based on motion intensity
        const intensity = tf.norm(data.motion).dataSync()[0];
        this.state.energy = Math.min(1.0, this.state.energy + intensity * 0.1);
        
        // Update mood based on energy and style
        this.updateMood();
        
        // Get current move for the style
        const moves = this.danceStyles.get(data.style) || [];
        const currentMove = moves[Math.floor(Math.random() * moves.length)];
        
        this.emit('motion', {
            move: currentMove,
            style: data.style,
            energy: this.state.energy,
            mood: this.state.mood
        });
    }

    private handleMIDI(midiData: any): void {
        // Process the generated MIDI data
        const analysis = this.danceInterpolator.getAnalysis();
        
        this.emit('midi', {
            data: midiData,
            analysis,
            style: this.state.currentStyle,
            energy: this.state.energy,
            mood: this.state.mood
        });
    }

    private updateMood(): void {
        if (this.state.energy > 0.8) {
            this.state.mood = 'energetic';
        } else if (this.state.energy > 0.5) {
            this.state.mood = 'happy';
        } else if (this.state.energy < 0.3) {
            this.state.mood = 'tired';
        } else {
            this.state.mood = 'neutral';
        }
    }

    private getMoodResponse(): string {
        const responses = this.moodResponses.get(this.state.mood) || [];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    private getDanceSummary(analysis: string): string {
        return `*wipes brow* ${analysis}\nThat was a fine dance! *adjusts beard*`;
    }

    public getState(): DwarfDanceState {
        return { ...this.state };
    }

    public getAvailableMoves(): string[] {
        const moves: string[] = [];
        this.danceStyles.forEach((styleMoves, style) => {
            moves.push(...styleMoves);
        });
        return moves;
    }
} 