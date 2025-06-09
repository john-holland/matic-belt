import { QuantumEnjoymentAnalyzer } from './quantum-enjoyment';
import { VisualAnalyzer } from './visual-analyzer';
import { TimeAnalyzer } from './time-analyzer';
import { AnalysisVisualizer } from './visualization';

async function testMovieAnalysis() {
    // Create video element
    const video = document.createElement('video');
    video.src = 'path/to/your/video.mp4'; // Replace with actual video path
    video.controls = true;
    document.body.appendChild(video);

    // Create analyzers
    const quantumAnalyzer = new QuantumEnjoymentAnalyzer();
    const visualAnalyzer = new VisualAnalyzer();
    const timeAnalyzer = new TimeAnalyzer();

    // Create visualizer
    const visualizer = new AnalysisVisualizer({
        width: 800,
        height: 600,
        updateInterval: 1000
    });

    // Set up analysis loop
    let isAnalyzing = false;
    const analysisInterval = setInterval(async () => {
        if (!isAnalyzing || video.paused) return;

        // Update time analyzer
        timeAnalyzer.updateCurrentTime(video.currentTime);
        visualizer.updateTimeContext(timeAnalyzer.getTimeContext());

        // Analyze visual content
        const visualAnalysis = await visualAnalyzer.analyzeFrame(video);
        visualizer.updateVisualAnalysis(visualAnalysis);

        // Get current metrics
        const metrics = {
            emotional: visualAnalysis.friendScore,
            narrative: visualAnalysis.sceneCoherence,
            visual: visualAnalysis.frameAverage,
            social: 0.5, // Placeholder for social metrics
            temporal: timeAnalyzer.getCurrentCoolingRate()
        };

        // Update quantum analysis
        const quantumAnalysis = quantumAnalyzer.analyzeEnjoyment(metrics);
        visualizer.updateQuantumAnalysis(quantumAnalysis);
    }, 1000);

    // Start analysis when video is ready
    video.addEventListener('loadedmetadata', () => {
        timeAnalyzer.setMediaLength(video.duration);
        timeAnalyzer.startAnalysis();
        visualAnalyzer.startAnalysis();
        isAnalyzing = true;
    });

    // Stop analysis when video ends
    video.addEventListener('ended', () => {
        isAnalyzing = false;
        timeAnalyzer.stopAnalysis();
        visualAnalyzer.stopAnalysis();
        clearInterval(analysisInterval);
    });

    // Clean up on page unload
    window.addEventListener('unload', () => {
        visualizer.destroy();
    });
}

// Run the test
testMovieAnalysis().catch(console.error); 