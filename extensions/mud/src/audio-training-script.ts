#!/usr/bin/env node

/**
 * Audio Training Data Collection Script
 * 
 * This script helps collect audio samples for training mood/mode recognition models.
 * Users record audio by pressing spacebar to start/stop recording.
 */

import { AudioRecorder, AudioSample } from './audio-recorder';
import * as readline from 'readline';

// Predefined moods and modes
const MOODS = [
    'happy', 'sad', 'energetic', 'calm', 'melancholic', 'excited',
    'peaceful', 'intense', 'playful', 'serious', 'nostalgic', 'uplifting'
];

const MODES = [
    'whistling', 'humming', 'singing', 'instrumental', 'beatboxing',
    'scat', 'vocalization', 'percussion', 'melody', 'rhythm'
];

class AudioTrainingScript {
    private recorder: AudioRecorder;
    private rl: readline.Interface;
    private currentMood: string = '';
    private currentMode: string = '';
    private isRecording: boolean = false;

    constructor() {
        this.recorder = new AudioRecorder();
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Handle spacebar input
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.setEncoding('utf8');
            
            process.stdin.on('data', (key: string) => {
                if (key === ' ' || key === '\u0020') {
                    this.handleSpacebar();
                } else if (key === '\u0003') { // Ctrl+C
                    this.cleanup();
                    process.exit();
                }
            });
        }
    }

    private async handleSpacebar() {
        if (!this.isRecording) {
            await this.startRecording();
        } else {
            await this.stopRecording();
        }
    }

    private async startRecording() {
        try {
            this.isRecording = true;
            await this.recorder.startRecording();
            console.log('\n🎤 Recording... (Press SPACE to stop)');
        } catch (error: any) {
            console.error('\n❌ Error starting recording:', error.message);
            this.isRecording = false;
        }
    }

    private async stopRecording() {
        try {
            const blob = await this.recorder.stopRecording();
            const duration = (Date.now() - (this.recorder as any).startTime) / 1000;
            
            console.log(`\n⏹️  Recording stopped (${duration.toFixed(2)}s)`);
            
            // Save the recording
            const sample = await this.recorder.saveRecording(blob, this.currentMood, this.currentMode);
            console.log(`✅ Saved: ${sample.id}`);
            console.log(`   Mood: ${sample.mood}, Mode: ${sample.mode}`);
            if (sample.metadata) {
                console.log(`   Duration: ${sample.metadata.duration?.toFixed(2)}s`);
                console.log(`   Volume: ${(sample.metadata.volume || 0).toFixed(2)}`);
                console.log(`   Pitch: ${(sample.metadata.pitch || 0).toFixed(1)} Hz`);
                console.log(`   Tempo: ${(sample.metadata.tempo || 0).toFixed(1)} BPM`);
            }
            
            this.isRecording = false;
            
            // Ask if user wants to record more
            await this.promptNext();
        } catch (error: any) {
            console.error('\n❌ Error stopping recording:', error.message);
            this.isRecording = false;
        }
    }

    private async promptNext(): Promise<void> {
        return new Promise((resolve) => {
            console.log('\n📝 Record another sample? (y/n)');
            
            const handler = (key: string) => {
                if (key === 'y' || key === 'Y') {
                    process.stdin.removeListener('data', handler);
                    this.promptForMoodAndMode().then(() => resolve());
                } else if (key === 'n' || key === 'N') {
                    process.stdin.removeListener('data', handler);
                    this.showStatistics().then(() => {
                        this.cleanup();
                        resolve();
                    });
                }
            };
            
            process.stdin.once('data', handler);
        });
    }

    private async promptForMoodAndMode(): Promise<void> {
        return new Promise((resolve) => {
            console.log('\n🎭 Available moods:');
            MOODS.forEach((mood, i) => {
                console.log(`   ${i + 1}. ${mood}`);
            });
            
            console.log('\n🎵 Available modes:');
            MODES.forEach((mode, i) => {
                console.log(`   ${i + 1}. ${mode}`);
            });
            
            console.log('\n💡 Enter custom mood/mode (or press Enter to use defaults)');
            console.log('   Format: "mood,mode" or just "mood" (will use "whistling" as default mode)');
            
            this.rl.question('\n> ', async (answer) => {
                if (answer.trim()) {
                    const parts = answer.trim().split(',');
                    this.currentMood = parts[0].trim() || 'unknown';
                    this.currentMode = parts[1]?.trim() || 'whistling';
                } else {
                    this.currentMood = 'neutral';
                    this.currentMode = 'whistling';
                }
                
                console.log(`\n🎤 Ready to record: ${this.currentMood} ${this.currentMode}`);
                console.log('   Press SPACE to start recording, SPACE again to stop');
                resolve();
            });
        });
    }

    async run() {
        console.log('🎵 Audio Training Data Collection Script');
        console.log('==========================================\n');
        
        await this.promptForMoodAndMode();
        
        // Keep the script running
        console.log('\n💡 Press Ctrl+C to exit\n');
    }

    private async showStatistics() {
        const dataset = await this.recorder.getDataset();
        
        console.log('\n📊 Dataset Statistics:');
        console.log('=====================');
        console.log(`Total samples: ${dataset.statistics.totalSamples}`);
        console.log(`Total duration: ${dataset.statistics.totalDuration.toFixed(2)}s`);
        console.log(`Average duration: ${dataset.statistics.averageDuration.toFixed(2)}s`);
        
        console.log('\nSamples per mood:');
        Object.entries(dataset.statistics.samplesPerMood).forEach(([mood, count]) => {
            console.log(`  ${mood}: ${count}`);
        });
        
        console.log('\nSamples per mode:');
        Object.entries(dataset.statistics.samplesPerMode).forEach(([mode, count]) => {
            console.log(`  ${mode}: ${count}`);
        });
        
        const path = require('path');
        console.log(`\n📁 Dataset saved to: ${path.resolve(this.recorder['datasetPath'])}`);
    }

    private cleanup() {
        if (this.rl) {
            this.rl.close();
        }
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
    }
}

// Run the script
if (require.main === module) {
    const script = new AudioTrainingScript();
    script.run().catch(console.error);
}

export { AudioTrainingScript };

