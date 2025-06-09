import { MovieAnalyzer } from './analyzer';
import { SceneGraph } from '../content/manager';

export class MovieViewer {
    private container: HTMLElement;
    private videoElement: HTMLVideoElement;
    private analyzer: MovieAnalyzer;
    private emotionChart: HTMLElement;
    private narrativeChart: HTMLElement;
    private visualChart: HTMLElement;
    private descriptionElement: HTMLElement;

    constructor(container: HTMLElement, sceneGraph: SceneGraph) {
        this.container = container;
        this.analyzer = new MovieAnalyzer(sceneGraph);
        this.initializeUI();
        this.setupEventListeners();
    }

    private initializeUI() {
        // Create video container
        const videoContainer = document.createElement('div');
        videoContainer.className = 'video-container';
        this.container.appendChild(videoContainer);

        // Create video element
        this.videoElement = document.createElement('video');
        this.videoElement.controls = true;
        videoContainer.appendChild(this.videoElement);

        // Create analysis container
        const analysisContainer = document.createElement('div');
        analysisContainer.className = 'analysis-container';
        this.container.appendChild(analysisContainer);

        // Create emotion chart
        this.emotionChart = document.createElement('div');
        this.emotionChart.className = 'emotion-chart';
        analysisContainer.appendChild(this.emotionChart);

        // Create narrative chart
        this.narrativeChart = document.createElement('div');
        this.narrativeChart.className = 'narrative-chart';
        analysisContainer.appendChild(this.narrativeChart);

        // Create visual chart
        this.visualChart = document.createElement('div');
        this.visualChart.className = 'visual-chart';
        analysisContainer.appendChild(this.visualChart);

        // Create description element
        this.descriptionElement = document.createElement('div');
        this.descriptionElement.className = 'scene-description';
        analysisContainer.appendChild(this.descriptionElement);

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .video-container {
                width: 100%;
                max-width: 800px;
                margin: 0 auto;
            }

            .analysis-container {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
                padding: 20px;
            }

            .emotion-chart,
            .narrative-chart,
            .visual-chart {
                background: #1a1a1a;
                border-radius: 8px;
                padding: 15px;
                min-height: 200px;
            }

            .scene-description {
                grid-column: 1 / -1;
                background: #1a1a1a;
                border-radius: 8px;
                padding: 15px;
                font-size: 16px;
                line-height: 1.5;
            }
        `;
        document.head.appendChild(style);
    }

    private setupEventListeners() {
        // Listen for analysis updates
        this.analyzer.on('analysis', (analysis) => {
            this.updateCharts(analysis);
        });

        // Handle video source changes
        this.videoElement.addEventListener('loadedmetadata', () => {
            this.analyzer.startAnalysis(this.videoElement);
        });
    }

    private updateCharts(analysis: any) {
        // Update emotion chart
        this.updateEmotionChart(analysis.emotions);

        // Update narrative chart
        this.updateNarrativeChart(analysis.narrative);

        // Update visual chart
        this.updateVisualChart(analysis.visual);

        // Update description
        this.descriptionElement.textContent = analysis.description;
    }

    private updateEmotionChart(emotions: any) {
        const chartData = Object.entries(emotions).map(([emotion, value]) => ({
            emotion,
            value: value as number
        }));

        // Create or update emotion chart using a charting library
        // This is a placeholder for actual chart implementation
        this.emotionChart.innerHTML = `
            <h3>Emotional Analysis</h3>
            <div class="emotion-bars">
                ${chartData.map(data => `
                    <div class="emotion-bar">
                        <span class="emotion-label">${data.emotion}</span>
                        <div class="emotion-value" style="width: ${data.value * 100}%"></div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    private updateNarrativeChart(narrative: any) {
        const chartData = Object.entries(narrative).map(([metric, value]) => ({
            metric,
            value: value as number
        }));

        // Create or update narrative chart
        this.narrativeChart.innerHTML = `
            <h3>Narrative Analysis</h3>
            <div class="narrative-bars">
                ${chartData.map(data => `
                    <div class="narrative-bar">
                        <span class="narrative-label">${data.metric}</span>
                        <div class="narrative-value" style="width: ${data.value * 100}%"></div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    private updateVisualChart(visual: any) {
        const chartData = Object.entries(visual).map(([metric, value]) => ({
            metric,
            value: value as number
        }));

        // Create or update visual chart
        this.visualChart.innerHTML = `
            <h3>Visual Analysis</h3>
            <div class="visual-bars">
                ${chartData.map(data => `
                    <div class="visual-bar">
                        <span class="visual-label">${data.metric}</span>
                        <div class="visual-value" style="width: ${data.value * 100}%"></div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    public loadVideo(url: string) {
        this.videoElement.src = url;
    }

    public loadStream(stream: MediaStream) {
        this.videoElement.srcObject = stream;
    }
} 