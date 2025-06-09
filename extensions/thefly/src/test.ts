import { AudioAnalyzer } from './audio/analyzer';
import { RNNModel } from './audio/rnn-model';

async function runTest() {
    try {
        // Initialize components
        const analyzer = new AudioAnalyzer();
        const rnnModel = new RNNModel();

        // Test audio analysis
        console.log('Testing audio analysis...');
        const testMessages = [
            'What a beautiful day',
            'The sun is shining bright',
            'Birds are singing in the trees'
        ];

        const features = await analyzer.analyzeAudio(testMessages);
        console.log('Audio Features:', features);

        // Test MIDI conversion
        console.log('\nTesting MIDI conversion...');
        const midi = await analyzer.convertToMidi(testMessages);
        console.log('MIDI track created with', midi.tracks[0].notes.length, 'notes');

        // Test phonetic interpretation
        console.log('\nTesting phonetic interpretation...');
        const interpretation = await rnnModel.predictPhonetics(testMessages);
        console.log('Phonetic Interpretation:', interpretation);

        // Test joy score
        console.log('\nJoy Score:', interpretation.joyScore.toFixed(2));

    } catch (error) {
        console.error('Test failed:', error);
    }
}

runTest(); 