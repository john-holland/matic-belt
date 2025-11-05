/**
 * Browser-based Audio Training Data Collection
 * 
 * This version runs in the browser and uses the AudioRecorder class
 * to collect training samples via spacebar controls.
 */

import { AudioRecorder, AudioSample } from './audio-recorder';

export class BrowserAudioTraining {
    private recorder: AudioRecorder;
    private currentMood: string = '';
    private currentMode: string = '';
    private isRecording: boolean = false;
    private onSampleSaved?: (sample: AudioSample) => void;
    private onStatisticsUpdate?: (stats: any) => void;

    constructor(
        outputDir: string = './audio-training-data',
        datasetPath: string = './audio-training-data/dataset.json'
    ) {
        this.recorder = new AudioRecorder(outputDir, datasetPath);
        this.setupKeyboardListeners();
    }

    private setupKeyboardListeners() {
        document.addEventListener('keydown', async (e) => {
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                await this.handleSpacebar();
            }
        });
    }

    private async handleSpacebar() {
        if (!this.isRecording) {
            await this.startRecording();
        } else {
            await this.stopRecording();
        }
    }

    async startRecording() {
        if (this.isRecording) return;
        
        try {
            this.isRecording = true;
            await this.recorder.startRecording();
            this.updateUI('🎤 Recording... (Press SPACE to stop)', 'recording');
        } catch (error: any) {
            console.error('Error starting recording:', error);
            this.updateUI(`❌ Error: ${error.message}`, 'error');
            this.isRecording = false;
        }
    }

    async stopRecording() {
        if (!this.isRecording) return;
        
        try {
            const blob = await this.recorder.stopRecording();
            const duration = (Date.now() - (this.recorder as any).startTime) / 1000;
            
            this.updateUI(`⏹️ Recording stopped (${duration.toFixed(2)}s)`, 'stopped');
            
            // Save the recording
            const sample = await this.recorder.saveRecording(blob, this.currentMood, this.currentMode);
            
            if (this.onSampleSaved) {
                this.onSampleSaved(sample);
            }
            
            this.updateSampleInfo(sample);
            this.isRecording = false;
            
            // Update statistics
            await this.updateStatistics();
        } catch (error: any) {
            console.error('Error stopping recording:', error);
            this.updateUI(`❌ Error: ${error.message}`, 'error');
            this.isRecording = false;
        }
    }

    async promptForMoodAndMode(
        mood: string,
        mode: string,
        customMoods: string[] = [],
        customModes: string[] = []
    ): Promise<void> {
        this.currentMood = mood;
        this.currentMode = mode;
        
        const message = `🎤 Ready to record: ${mood} ${mode}\n   Press SPACE to start recording, SPACE again to stop`;
        this.updateUI(message, 'ready');
    }

    private updateUI(message: string, status: 'ready' | 'recording' | 'stopped' | 'error') {
        // This would update UI elements in the browser
        // For now, we'll emit events that can be handled by the UI
        const event = new CustomEvent('audio-training-status', {
            detail: { message, status }
        });
        document.dispatchEvent(event);
    }

    private updateSampleInfo(sample: AudioSample) {
        const event = new CustomEvent('audio-sample-saved', {
            detail: { sample }
        });
        document.dispatchEvent(event);
    }

    private async updateStatistics() {
        const dataset = await this.recorder.getDataset();
        
        if (this.onStatisticsUpdate) {
            this.onStatisticsUpdate(dataset.statistics);
        }
        
        const event = new CustomEvent('audio-statistics-updated', {
            detail: { statistics: dataset.statistics }
        });
        document.dispatchEvent(event);
    }

    onSampleSavedCallback(callback: (sample: AudioSample) => void) {
        this.onSampleSaved = callback;
    }

    onStatisticsUpdateCallback(callback: (stats: any) => void) {
        this.onStatisticsUpdate = callback;
    }

    getCurrentStatus() {
        return {
            isRecording: this.isRecording,
            currentMood: this.currentMood,
            currentMode: this.currentMode
        };
    }

    async getDataset() {
        return await this.recorder.getDataset();
    }
}

export { AudioSample };

