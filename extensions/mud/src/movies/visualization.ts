import { VisualAnalysis } from './visual-analyzer';
import { TimeContext } from './time-analyzer';
import { QuantumEnjoymentAnalysis } from './quantum-enjoyment';
import { SocialAnalysis } from './social-analyzer';

interface VisualizationConfig {
    width: number;
    height: number;
    updateInterval: number;
}

interface ChartProperties {
    type: string;
    data: any;
    options: any;
    element: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    width: number;
    height: number;
    scale: number;
}

interface VisualizationResult {
    emotionChart: ChartProperties;
    narrativeChart: ChartProperties;
    visualChart: ChartProperties;
    socialChart: ChartProperties;
    drawFunctions: {
        drawEmotionChart: (ctx: CanvasRenderingContext2D, data: any) => void;
        drawNarrativeChart: (ctx: CanvasRenderingContext2D, data: any) => void;
        drawVisualChart: (ctx: CanvasRenderingContext2D, data: any) => void;
        drawSocialChart: (ctx: CanvasRenderingContext2D, data: any) => void;
    };
}

export class AnalysisVisualizer {
    private container: HTMLDivElement;
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;
    private config: VisualizationConfig;
    private visualData: VisualAnalysis[] = [];
    private timeData: TimeContext[] = [];
    private quantumData: QuantumEnjoymentAnalysis[] = [];
    private maxDataPoints: number = 100;
    private emotionChart: HTMLCanvasElement;
    private narrativeChart: HTMLCanvasElement;
    private visualChart: HTMLCanvasElement;
    private socialChart: HTMLCanvasElement;
    private descriptionElement: HTMLDivElement;

    constructor(config: VisualizationConfig) {
        this.config = config;
        this.container = document.createElement('div');
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d')!;
        
        this.emotionChart = document.createElement('canvas');
        this.narrativeChart = document.createElement('canvas');
        this.visualChart = document.createElement('canvas');
        this.socialChart = document.createElement('canvas');
        this.descriptionElement = document.createElement('div');
        
        this.initializeUI();
    }

    private initializeUI() {
        // Set up container
        this.container.style.position = 'fixed';
        this.container.style.top = '10px';
        this.container.style.right = '10px';
        this.container.style.width = `${this.config.width}px`;
        this.container.style.height = `${this.config.height}px`;
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.container.style.borderRadius = '5px';
        this.container.style.padding = '10px';
        this.container.style.color = 'white';
        this.container.style.fontFamily = 'monospace';
        this.container.style.display = 'grid';
        this.container.style.gridTemplateColumns = '1fr 1fr';
        this.container.style.gridGap = '10px';

        // Set up canvas
        this.canvas.width = this.config.width;
        this.canvas.height = this.config.height;
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';

        // Add canvas to container
        this.container.appendChild(this.canvas);

        // Add to document
        document.body.appendChild(this.container);
    }

    public updateVisualAnalysis(analysis: VisualAnalysis) {
        this.visualData.push(analysis);
        if (this.visualData.length > this.maxDataPoints) {
            this.visualData.shift();
        }
        this.render();
    }

    public updateTimeContext(context: TimeContext) {
        this.timeData.push(context);
        if (this.timeData.length > this.maxDataPoints) {
            this.timeData.shift();
        }
        this.render();
    }

    public updateQuantumAnalysis(analysis: QuantumEnjoymentAnalysis) {
        this.quantumData.push(analysis);
        if (this.quantumData.length > this.maxDataPoints) {
            this.quantumData.shift();
        }
        this.render();
    }

    private render() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw frame average chart
        this.drawFrameAverageChart();

        // Draw friend/foe chart
        this.drawFriendFoeChart();

        // Draw cooling rate chart
        this.drawCoolingRateChart();

        // Draw quantum states chart
        this.drawQuantumStatesChart();

        // Draw scene coherence chart
        this.drawSceneCoherenceChart();

        // Draw enjoyment score chart
        this.drawEnjoymentChart();
    }

    private drawFrameAverageChart() {
        const data = this.visualData.map(d => d.frameAverage);
        this.drawLineChart(data, 0, 0, this.canvas.width / 2, this.canvas.height / 3, 'Frame Average');
    }

    private drawFriendFoeChart() {
        const friendData = this.visualData.map(d => d.friendScore);
        const foeData = this.visualData.map(d => d.foeScore);
        this.drawMultiLineChart(
            [friendData, foeData],
            ['Friend Score', 'Foe Score'],
            ['#00ff00', '#ff0000'],
            this.canvas.width / 2,
            0,
            this.canvas.width / 2,
            this.canvas.height / 3,
            'Friend vs Foe'
        );
    }

    private drawCoolingRateChart() {
        const data = this.timeData.map(d => d.coolingRate);
        this.drawLineChart(data, 0, this.canvas.height / 3, this.canvas.width / 2, this.canvas.height / 3, 'Cooling Rate');
    }

    private drawQuantumStatesChart() {
        const states = ['emotional', 'narrative', 'visual', 'social', 'temporal'];
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'];
        const data = states.map(state => 
            this.quantumData.map(d => d.quantumStates.get(state)?.value || 0)
        );
        this.drawMultiLineChart(
            data,
            states,
            colors,
            this.canvas.width / 2,
            this.canvas.height / 3,
            this.canvas.width / 2,
            this.canvas.height / 3,
            'Quantum States'
        );
    }

    private drawSceneCoherenceChart() {
        const data = this.visualData.map(d => d.sceneCoherence);
        this.drawLineChart(data, 0, (this.canvas.height * 2) / 3, this.canvas.width / 2, this.canvas.height / 3, 'Scene Coherence');
    }

    private drawEnjoymentChart() {
        const data = this.quantumData.map(d => d.enjoyment);
        this.drawLineChart(data, this.canvas.width / 2, (this.canvas.height * 2) / 3, this.canvas.width / 2, this.canvas.height / 3, 'Enjoyment Score');
    }

    private drawLineChart(
        data: number[],
        x: number,
        y: number,
        width: number,
        height: number,
        title: string
    ) {
        this.context.save();
        
        // Draw background
        this.context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.context.fillRect(x, y, width, height);

        // Draw title
        this.context.fillStyle = 'white';
        this.context.font = '12px monospace';
        this.context.fillText(title, x + 5, y + 15);

        // Draw data
        if (data.length > 1) {
            const max = Math.max(...data);
            const min = Math.min(...data);
            const range = max - min || 1;

            this.context.beginPath();
            this.context.strokeStyle = '#00ff00';
            this.context.lineWidth = 2;

            data.forEach((value, index) => {
                const xPos = x + (index / (data.length - 1)) * width;
                const yPos = y + height - ((value - min) / range) * height;
                
                if (index === 0) {
                    this.context.moveTo(xPos, yPos);
                } else {
                    this.context.lineTo(xPos, yPos);
                }
            });

            this.context.stroke();
        }

        this.context.restore();
    }

    private drawMultiLineChart(
        dataArrays: number[][],
        labels: string[],
        colors: string[],
        x: number,
        y: number,
        width: number,
        height: number,
        title: string
    ) {
        this.context.save();
        
        // Draw background
        this.context.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.context.fillRect(x, y, width, height);

        // Draw title
        this.context.fillStyle = 'white';
        this.context.font = '12px monospace';
        this.context.fillText(title, x + 5, y + 15);

        // Draw legend
        labels.forEach((label, index) => {
            this.context.fillStyle = colors[index];
            this.context.fillText(label, x + 5, y + 30 + index * 15);
        });

        // Draw data
        if (dataArrays[0].length > 1) {
            const max = Math.max(...dataArrays.flat());
            const min = Math.min(...dataArrays.flat());
            const range = max - min || 1;

            dataArrays.forEach((data, arrayIndex) => {
                this.context.beginPath();
                this.context.strokeStyle = colors[arrayIndex];
                this.context.lineWidth = 2;

                data.forEach((value, index) => {
                    const xPos = x + (index / (data.length - 1)) * width;
                    const yPos = y + height - ((value - min) / range) * height;
                    
                    if (index === 0) {
                        this.context.moveTo(xPos, yPos);
                    } else {
                        this.context.lineTo(xPos, yPos);
                    }
                });

                this.context.stroke();
            });
        }

        this.context.restore();
    }

    public render(visualAnalysis: VisualAnalysis, socialAnalysis: SocialAnalysis): VisualizationResult {
        const emotionProps = this.updateEmotionChart(visualAnalysis);
        const narrativeProps = this.updateNarrativeChart(visualAnalysis);
        const visualProps = this.updateVisualChart(visualAnalysis);
        const socialProps = this.updateSocialChart(socialAnalysis);

        return {
            emotionChart: emotionProps,
            narrativeChart: narrativeProps,
            visualChart: visualProps,
            socialChart: socialProps,
            drawFunctions: {
                drawEmotionChart: this.drawEmotionChart,
                drawNarrativeChart: this.drawNarrativeChart,
                drawVisualChart: this.drawVisualChart,
                drawSocialChart: this.drawSocialChart
            }
        };
    }

    private updateEmotionChart(analysis: VisualAnalysis): ChartProperties {
        const ctx = this.emotionChart.getContext('2d')!;
        const data = {
            friendScore: analysis.friendScore,
            foeScore: analysis.foeScore,
            timestamp: analysis.timestamp
        };

        this.drawEmotionChart(ctx, data);

        return {
            type: 'emotion',
            data,
            options: {
                width: this.emotionChart.width,
                height: this.emotionChart.height,
                scale: 1.0
            },
            element: this.emotionChart,
            context: ctx,
            width: this.emotionChart.width,
            height: this.emotionChart.height,
            scale: 1.0
        };
    }

    private updateNarrativeChart(analysis: VisualAnalysis): ChartProperties {
        const ctx = this.narrativeChart.getContext('2d')!;
        const data = {
            sceneCoherence: analysis.sceneCoherence,
            frameAverage: analysis.frameAverage,
            timestamp: analysis.timestamp
        };

        this.drawNarrativeChart(ctx, data);

        return {
            type: 'narrative',
            data,
            options: {
                width: this.narrativeChart.width,
                height: this.narrativeChart.height,
                scale: 1.0
            },
            element: this.narrativeChart,
            context: ctx,
            width: this.narrativeChart.width,
            height: this.narrativeChart.height,
            scale: 1.0
        };
    }

    private updateVisualChart(analysis: VisualAnalysis): ChartProperties {
        const ctx = this.visualChart.getContext('2d')!;
        const data = {
            objects: analysis.objects,
            timestamp: analysis.timestamp
        };

        this.drawVisualChart(ctx, data);

        return {
            type: 'visual',
            data,
            options: {
                width: this.visualChart.width,
                height: this.visualChart.height,
                scale: 1.0
            },
            element: this.visualChart,
            context: ctx,
            width: this.visualChart.width,
            height: this.visualChart.height,
            scale: 1.0
        };
    }

    private updateSocialChart(analysis: SocialAnalysis): ChartProperties {
        const ctx = this.socialChart.getContext('2d')!;
        const data = {
            activeFriends: analysis.activeFriends,
            chatActivity: analysis.chatActivity,
            captionActivity: analysis.captionActivity,
            socialCoherence: analysis.socialCoherence,
            timestamp: analysis.timestamp
        };

        this.drawSocialChart(ctx, data);

        return {
            type: 'social',
            data,
            options: {
                width: this.socialChart.width,
                height: this.socialChart.height,
                scale: 1.0
            },
            element: this.socialChart,
            context: ctx,
            width: this.socialChart.width,
            height: this.socialChart.height,
            scale: 1.0
        };
    }

    private drawEmotionChart(ctx: CanvasRenderingContext2D, data: any) {
        const { width, height } = ctx.canvas;
        const { friendScore, foeScore } = data;

        // Clear canvas
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        // Draw friend score
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(10, height - (friendScore * height), 40, friendScore * height);

        // Draw foe score
        ctx.fillStyle = '#F44336';
        ctx.fillRect(60, height - (foeScore * height), 40, foeScore * height);

        // Add labels
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText('Friend', 10, height - 10);
        ctx.fillText('Foe', 60, height - 10);
    }

    private drawNarrativeChart(ctx: CanvasRenderingContext2D, data: any) {
        const { width, height } = ctx.canvas;
        const { sceneCoherence, frameAverage } = data;

        // Clear canvas
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        // Draw scene coherence
        ctx.fillStyle = '#2196F3';
        ctx.fillRect(10, height - (sceneCoherence * height), 40, sceneCoherence * height);

        // Draw frame average
        ctx.fillStyle = '#FFC107';
        ctx.fillRect(60, height - (frameAverage * height), 40, frameAverage * height);

        // Add labels
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText('Coherence', 10, height - 10);
        ctx.fillText('Frames', 60, height - 10);
    }

    private drawVisualChart(ctx: CanvasRenderingContext2D, data: any) {
        const { width, height } = ctx.canvas;
        const { objects } = data;

        // Clear canvas
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        // Draw object detections
        objects.forEach((obj: any, index: number) => {
            const x = 10 + (index * 60);
            const y = height - (obj.confidence * height);
            
            ctx.fillStyle = obj.isFriendly ? '#4CAF50' : '#F44336';
            ctx.fillRect(x, y, 40, obj.confidence * height);

            // Add label
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Arial';
            ctx.fillText(obj.label, x, height - 5);
        });
    }

    private drawSocialChart(ctx: CanvasRenderingContext2D, data: any) {
        const { width, height } = ctx.canvas;
        const { chatActivity, captionActivity, socialCoherence } = data;

        // Clear canvas
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        // Draw metrics
        ctx.fillStyle = '#9C27B0';
        ctx.fillRect(10, height - (chatActivity * height), 40, chatActivity * height);

        ctx.fillStyle = '#00BCD4';
        ctx.fillRect(60, height - (captionActivity * height), 40, captionActivity * height);

        ctx.fillStyle = '#FF9800';
        ctx.fillRect(110, height - (socialCoherence * height), 40, socialCoherence * height);

        // Add labels
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.fillText('Chat', 10, height - 5);
        ctx.fillText('Captions', 60, height - 5);
        ctx.fillText('Social', 110, height - 5);
    }

    public getElements() {
        return {
            emotionChart: this.emotionChart,
            narrativeChart: this.narrativeChart,
            visualChart: this.visualChart,
            socialChart: this.socialChart,
            descriptionElement: this.descriptionElement
        };
    }

    public destroy() {
        this.container.remove();
    }
} 