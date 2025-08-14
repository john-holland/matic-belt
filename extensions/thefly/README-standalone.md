# 🪰 TheFly Standalone - Audio Intelligence App

TheFly is an intelligent audio analysis system that automatically detects and records interesting audio patterns. It uses advanced music theory analysis, harmonic complexity detection, and emotional profiling to identify noteworthy audio segments.

## 🚀 Quick Start

### Option 1: Using the startup script
```bash
cd extensions/thefly
./start-thefly.sh
```

### Option 2: Manual setup
```bash
cd extensions/thefly
npm install
npm run build
npm run standalone
```

## 🌐 Web Interface

Once started, open your browser to:
```
http://localhost:3000/standalone.html
```

## 🎯 Features

### Real-time Audio Analysis
- **Joy Score Detection**: Measures emotional positivity in audio
- **Harmonic Complexity**: Analyzes musical complexity and sophistication
- **Chorus Detection**: Identifies chorus sections in music
- **Emotional Intensity**: Measures the emotional impact of audio
- **Pattern Recognition**: Detects unusual or interesting patterns

### Automatic Recording
- **Smart Recording**: Automatically starts recording when interesting audio is detected
- **Interest Scoring**: Uses a weighted algorithm to determine what's "interesting"
- **Session Management**: Tracks recording sessions with metadata
- **File Organization**: Saves recordings with timestamps and analysis data

### Interest Criteria
The system considers these factors when deciding to record:

| Factor | Weight | Description |
|--------|--------|-------------|
| Joy Score | 30% | Emotional positivity and happiness |
| Harmonic Complexity | 20% | Musical sophistication and complexity |
| Chorus Detection | 15% | Presence of chorus sections |
| Unusual Patterns | 20% | Detection of non-standard patterns |
| Emotional Intensity | 15% | Overall emotional impact |

## 📁 Recordings

Recordings are automatically saved to the `recordings/` directory with:
- **Session ID**: Unique identifier for each recording
- **Timestamp**: When the recording started
- **Duration**: Length of the recording
- **Interest Score**: Why it was considered interesting
- **Analysis Data**: Musical theory analysis
- **Reason**: Specific reason for recording

### Recording Format
```json
{
  "id": "recording_1234567890",
  "startTime": 1234567890,
  "endTime": 1234567990,
  "interestingScore": 0.85,
  "reason": "high joy, complex harmony",
  "analysis": {
    "joyScore": 0.9,
    "harmonicComplexity": 0.8,
    "chorusDetected": true,
    "theory": {
      "key": "C",
      "mode": "major",
      "emotionalProfile": {
        "valence": 0.8,
        "energy": 0.9,
        "complexity": 0.7
      }
    }
  }
}
```

## 🎛️ Controls

### Web Interface
- **Start Listening**: Begin audio analysis
- **Stop**: End audio analysis
- **Real-time Metrics**: View live analysis scores
- **Recording List**: See all captured recordings
- **Visualizer**: 3D audio visualization

### API Endpoints
- `GET /api/recordings` - List all recordings
- `GET /api/recordings/:id` - Get specific recording details

## 🔧 Configuration

### Interest Threshold
Adjust the sensitivity in `src/standalone.ts`:
```typescript
private readonly INTERESTING_THRESHOLD = 0.7; // Default: 0.7
```

### Recording Directory
Change the recordings location:
```typescript
private readonly RECORDINGS_DIR = path.join(__dirname, '../recordings');
```

## 🎵 What Gets Recorded

TheFly automatically records audio when it detects:

### High Joy Content
- Laughter, cheering, positive vocalizations
- Upbeat music with major keys
- High-energy emotional content

### Complex Harmonies
- Sophisticated chord progressions
- Multi-layered musical arrangements
- Unusual harmonic structures

### Chorus Sections
- Repetitive musical patterns
- Vocal harmonies
- Catchy musical hooks

### Unusual Patterns
- Non-standard musical structures
- Unexpected chord changes
- Unique rhythmic patterns

### Emotional Intensity
- High-energy performances
- Dramatic musical moments
- Intense emotional expressions

## 🛠️ Technical Details

### Audio Processing Pipeline
1. **Audio Capture**: Real-time microphone input
2. **FFT Analysis**: Frequency domain transformation
3. **Feature Extraction**: Musical feature detection
4. **Theory Analysis**: Music theory interpretation
5. **Interest Evaluation**: Multi-factor scoring
6. **Recording Decision**: Automatic recording trigger

### Analysis Components
- **AudioAnalyzer**: Core audio processing
- **RNNModel**: Neural network for phonetic analysis
- **MusicTheoryAnalyzer**: Music theory interpretation
- **InterestEvaluator**: Smart recording decisions

## 🐛 Troubleshooting

### Common Issues

**No audio detected**
- Check microphone permissions
- Ensure microphone is not muted
- Try refreshing the browser

**Recordings not saving**
- Check write permissions for recordings directory
- Ensure sufficient disk space
- Check console for error messages

**High CPU usage**
- Reduce analysis frequency
- Lower interest threshold
- Close other audio applications

### Debug Mode
Enable debug logging by setting:
```typescript
console.log('🎯 Interest Score:', interestingScore, '-', reason);
```

## 📊 Performance

### System Requirements
- **CPU**: Multi-core recommended for real-time analysis
- **Memory**: 4GB+ RAM for neural network models
- **Storage**: SSD recommended for recording storage
- **Audio**: Quality microphone for best results

### Optimization Tips
- Use wired headphones to reduce feedback
- Close other audio applications
- Position microphone away from speakers
- Use quiet environment for best analysis

## 🤝 Contributing

To extend TheFly's capabilities:

1. **Add New Interest Criteria**: Modify `evaluateInterest()` method
2. **Custom Analysis**: Extend `AudioAnalyzer` class
3. **UI Enhancements**: Modify `standalone.html`
4. **API Extensions**: Add new endpoints to Express server

## 📄 License

MIT License - See LICENSE file for details

---

**🪰 TheFly** - Intelligent audio analysis and automatic recording system 