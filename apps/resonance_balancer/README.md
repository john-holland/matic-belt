# Local Area Resonance Balancer 🔇

Experimental audio utility that listens to the immediate environment, learns repeating resonance patterns (fan hum, fluorescent buzz, HVAC drones), and emits a phase-inverted signal to muffle or cancel that narrow band of sound.

> Think “noise-cancelling headphones,” but projected into a room using commodity microphones and speakers.

---

## System Diagram

```
┌────────────┐   mic array   ┌────────────┐   inverted gain   ┌──────────────┐
│ Ambient    │ ─────────────▶│ Analyzer   │ ─────────────────▶│ Resonance TX │
│ Soundfield │               │ (FFT + ML) │                   │ (Speaker Bus)│
└────────────┘               └────────────┘                   └──────────────┘
        ▲                          │                                 │
        │      adaptive feedback   ▼                                 │
        └─────────────────────────┴──────────────────────────────────┘
```

---

## Feature Highlights

- **Local Area Averaging** – rolling capture buffer (default 4.2 s) with overlap-add to emphasize persistent tones over transients.
- **Resonance Fingerprinting** – bucketized FFT bins + simple online clustering to spot repeated peaks.
- **Phase-Aligned Cancellation** – `AudioWorkletProcessor` emits the inverted waveform with latency compensation derived from `audioContext.baseLatency`.
- **Safety Envelope** – smart limiter ensures emitted cancellation never exceeds 78 dB SPL.
- **Tunable Zones** – optional HRTF-based spatialization lets you target a “muffling bubble.”

---

## Implementation Sketch

```ts
// apps/resonance_balancer/src/index.ts (future)
const ctx = new AudioContext();
const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
const source = ctx.createMediaStreamSource(mic);

const analyzer = new ResonanceTracker({ windowSize: 8192, overlap: 0.5 });
source.connect(analyzer.node);

const canceller = new ResonanceCanceller({ gain: -0.8, latencyComp: ctx.baseLatency });
analyzer.connect(canceller.input);
canceller.output.connect(ctx.destination);
```

---

## Running the Prototype

```bash
npm install
npm run dev  # Vite dev server (planned)
```

The current prototype ships with mock data + Web Audio scaffolding so you can start experimenting immediately.

---

## Next Steps

- Hook up multi-mic array calibration (support Dante / USB aggregate devices).
- Add UI for selecting which resonance buckets to suppress vs. leave audible.
- Explore ML models (e.g., tiny CNN) for differentiating “pleasant” tones from harsh ones.

---

*Built for Bat Belt experimentation. Use responsibly and mind local audio ordinances.* 
