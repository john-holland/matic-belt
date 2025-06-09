import { QuantumEnjoymentAnalyzer } from './quantum-enjoyment';

async function testQuantumEnjoyment() {
    // Create video element
    const video = document.createElement('video');
    video.src = 'path/to/your/video.mp4'; // Replace with actual video path
    video.controls = true;
    document.body.appendChild(video);

    // Create analyzer
    const analyzer = new QuantumEnjoymentAnalyzer();

    // Set up analysis display
    const display = document.createElement('div');
    display.style.position = 'fixed';
    display.style.top = '10px';
    display.style.right = '10px';
    display.style.padding = '10px';
    display.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    display.style.color = 'white';
    display.style.fontFamily = 'monospace';
    display.style.borderRadius = '5px';
    document.body.appendChild(display);

    // Listen for analysis updates
    analyzer.on('analysis', (analysis) => {
        // Update display with current analysis
        display.innerHTML = `
            <h3>Quantum Enjoyment Analysis</h3>
            <p>Time: ${new Date(analysis.timestamp).toLocaleTimeString()}</p>
            <p>Cooling Rate: ${analysis.coolingRate.toFixed(4)}</p>
            <p>Overall Enjoyment: ${(analysis.enjoyment * 100).toFixed(1)}%</p>
            <h4>Metrics:</h4>
            <ul>
                ${Object.entries(analysis.metrics)
                    .map(([key, value]) => `<li>${key}: ${(value * 100).toFixed(1)}%</li>`)
                    .join('')}
            </ul>
            <h4>Quantum States:</h4>
            <ul>
                ${Array.from(analysis.quantumStates.entries())
                    .map(([key, state]) => `
                        <li>${key}:
                            <br/>Value: ${state.value.toFixed(3)}
                            <br/>Energy: ${state.energy.toFixed(3)}
                            <br/>Temperature: ${state.temperature.toFixed(3)}
                        </li>
                    `)
                    .join('')}
            </ul>
        `;
    });

    // Start analysis when video is ready
    video.addEventListener('loadedmetadata', () => {
        analyzer.startAnalysis(video);
    });

    // Stop analysis when video ends
    video.addEventListener('ended', () => {
        analyzer.stopAnalysis();
    });
}

// Run the test
testQuantumEnjoyment().catch(console.error); 