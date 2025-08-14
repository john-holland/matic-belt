import { AudioAnalyzer } from './audio/analyzer';
import { RNNModel } from './audio/rnn-model';

async function runTest() {
    try {
        // Initialize components
        const analyzer = new AudioAnalyzer();
        const rnnModel = new RNNModel();

        // Test audio analysis with mock AudioBuffer
        console.log('Testing audio analysis...');
        const mockAudioBuffer = createMockAudioBuffer();
        const features = await analyzer.analyzeAudio(mockAudioBuffer);
        console.log('Audio Features:', features);

        // Test phonetic interpretation
        console.log('\nTesting phonetic interpretation...');
        const interpretation = await rnnModel.predictPhonetics(['test message']);
        console.log('Phonetic Interpretation:', interpretation);

        // Test joy score
        console.log('\nJoy Score:', interpretation.joyScore.toFixed(2));

    } catch (error) {
        console.error('Test failed:', error);
    }
}

function createMockAudioBuffer(): AudioBuffer {
    // Create a mock AudioBuffer for testing
    const sampleRate = 44100;
    const length = 2048;
    const audioBuffer = new AudioContext().createBuffer(1, length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    
    // Fill with a simple sine wave
    for (let i = 0; i < length; i++) {
        channelData[i] = Math.sin(2 * Math.PI * 440 * i / sampleRate);
    }
    
    return audioBuffer;
}

// Run the test
runTest().catch(console.error); 