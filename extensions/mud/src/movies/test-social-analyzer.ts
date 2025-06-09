import { VisualAnalyzer } from './visual-analyzer';
import { SocialAnalyzer } from './social-analyzer';

interface ObjectDetection {
    label: string;
    confidence: number;
    isFriendly: boolean;
    plotRelevance: number;
    boundingBox: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

async function testSocialAnalysis() {
    // Create video element
    const video = document.createElement('video');
    video.src = 'path/to/your/video.mp4';
    video.crossOrigin = 'anonymous';

    // Create analyzers
    const visualAnalyzer = new VisualAnalyzer();
    const socialAnalyzer = new SocialAnalyzer();

    // Set up event listeners
    visualAnalyzer.on('analysis', (analysis) => {
        console.log('Visual Analysis:', {
            timestamp: analysis.timestamp,
            frameAverage: analysis.frameAverage,
            friendScore: analysis.friendScore,
            foeScore: analysis.foeScore,
            sceneCoherence: analysis.sceneCoherence,
            objects: analysis.objects.map((obj: ObjectDetection) => ({
                label: obj.label,
                confidence: obj.confidence,
                isFriendly: obj.isFriendly
            })),
            socialContext: analysis.socialContext
        });
    });

    socialAnalyzer.on('analysis', (analysis) => {
        console.log('Social Analysis:', {
            timestamp: analysis.timestamp,
            activeFriends: analysis.activeFriends,
            chatActivity: analysis.chatActivity,
            captionActivity: analysis.captionActivity,
            socialCoherence: analysis.socialCoherence
        });
    });

    // Simulate chat messages
    const chatMessages = [
        {
            userId: 'user1',
            handle: 'alice',
            message: 'This scene is amazing!',
            timestamp: Date.now() / 1000
        },
        {
            userId: 'user2',
            handle: 'bob',
            message: 'I love how the characters interact',
            timestamp: Date.now() / 1000 + 1
        },
        {
            userId: 'user3',
            handle: 'charlie',
            message: 'The plot is really engaging',
            timestamp: Date.now() / 1000 + 2
        }
    ];

    // Add chat messages
    chatMessages.forEach(msg => {
        visualAnalyzer.addChatMessage(msg);
    });

    // Start analysis when video is ready
    video.addEventListener('loadedmetadata', () => {
        visualAnalyzer.startAnalysis();
        socialAnalyzer.startAnalysis();

        // Set up analysis loop
        const analyzeFrame = async () => {
            if (video.paused || video.ended) return;

            const currentTime = video.currentTime;
            await visualAnalyzer.analyzeFrame(video, currentTime);
            await socialAnalyzer.analyzeFrame(video, currentTime);

            requestAnimationFrame(analyzeFrame);
        };

        // Start video and analysis
        video.play().then(() => {
            analyzeFrame();
        });
    });

    // Add video to document
    document.body.appendChild(video);

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        video {
            max-width: 100%;
            height: auto;
        }
    `;
    document.head.appendChild(style);
}

// Run the test
testSocialAnalysis().catch(console.error); 