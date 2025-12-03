# Resonant Heater Field 🔥

An art-meets-audio installation that “heats” a spot in the air by projecting two opposing resonance fields. Instead of literal thermal output, it creates a balanced pocket of sound pressure that *feels* warm because the destructive interference sits just beyond arm’s reach, letting constructive interference wrap the listener.

---

## Concept

1. **Capture** local ambience to learn the dominant frequency bands.
2. **Generate** two complementary waveforms (primary + anti-phase clone).
3. **Project** them from a paired speaker rig aimed to intersect 0.6 m in front of the listener.
4. **Stabilize** the interference node by tracking phase drift with MEMS IMUs on each cabinet.
5. **Modulate** amplitude envelopes to mimic gentle heat bloom cycles.

---

# Resonant Heater Field 🔥

An art-meets-audio installation that “heats” a spot in the air by projecting two opposing resonance fields. Instead of literal thermal output, it creates a balanced pocket of sound pressure that *feels* warm because the destructive interference sits just beyond arm’s reach, letting constructive interference wrap the listener.

---

## Concept

1. **Capture** local ambience to learn the dominant frequency bands.
2. **Generate** two complementary waveforms (primary + anti-phase clone).
3. **Project** them from a paired speaker rig aimed to intersect 0.6 m in front of the listener.
4. **Stabilize** the interference node by tracking phase drift with MEMS IMUs on each cabinet.
5. **Modulate** amplitude envelopes to mimic gentle heat bloom cycles.

---

## Hardware Notes

- Dual amplified full-range speakers (or bone-conduction panels on acrylic).
- Tiny IMU per speaker to measure cabinet wobble that could desync the wavefront.
- Optional mid-air ultrasonic array to sharpen the “hotspot.”
- Kill switch + SPL limiter inline for safety.

---

## Cabinet Specification

- **Form factor:** 18 × 12 × 10 in birch plywood enclosure (≈30 L volume) lined with acoustic foam to keep the resonance loop contained while you “load” the plume.
- **Driver layout:** opposing 5.25 in coaxials mounted on the long faces, separated by 14 in center-to-center to maintain phase isolation.
- **Thermal mass:** thin aluminum baffle tucked behind the drivers acts as a heat spreader so the outgoing port air reaches ~35 °C without cooking the electronics.
- **Porting:** front slot port (1.5 × 8 in) with felt diffuser; this releases the mixed audio/thermal plume without blasting raw SPL at the listener.

Open-air cancellation at consumer SPL would cause ear fatigue long before creating a “warm” sensation, so the cabinet traps most of the resonance energy, lets the interference occur internally, and vents a gentle plume you can stand in front of.

---

## Software Stack

- `ResonanceProfiler` – shared utility reused from `apps/resonance_balancer`.
- `HeatFieldComposer` – schedules pulse envelopes and harmonic sweeps.
- `PhaseGuard` – monitors opposing drivers and injects corrective delay.
- `SafetySupervisor` – drops gain when SPL or temperature thresholds are crossed.

```ts
const heater = new HeatFieldComposer({
  bloomTempo: 36,        // BPM for gentle pulse
  hotspotDistance: 0.6,  // meters
  maxSpl: 76
});

heater.attachProfiler(resonanceProfiler);
heater.attachPhaseGuard(phaseGuard);
heater.start();
```

---

## Dev Workflow

```bash
npm install
npm start   # runs electron console to control the rig
```

The default build stubs hardware interfaces so you can preview the pulse choreography with WebGL visualizers before connecting real speakers.

---

## Experiment Ideas

- Blend IR heaters with the resonance hotspot for a hybrid warm zone.
- Add AR overlays to visualize where the constructive interference sits.
- Modulate hotspot location with hand-tracking for “heat following your palm.”

---

*Another entry in the Bat Belt for playful resonance engineering.* 



## Hardware Notes

- Dual amplified full-range speakers (or bone-conduction panels on acrylic).
- Tiny IMU per speaker to measure cabinet wobble that could desync the wavefront.
- Optional mid-air ultrasonic array to sharpen the “hotspot.”
- Kill switch + SPL limiter inline for safety.

---

## Software Stack

- `ResonanceProfiler` – shared utility reused from `apps/resonance_balancer`.
- `HeatFieldComposer` – schedules pulse envelopes and harmonic sweeps.
- `PhaseGuard` – monitors opposing drivers and injects corrective delay.
- `SafetySupervisor` – drops gain when SPL or temperature thresholds are crossed.

```ts
const heater = new HeatFieldComposer({
  bloomTempo: 36,        // BPM for gentle pulse
  hotspotDistance: 0.6,  // meters
  maxSpl: 76
});

heater.attachProfiler(resonanceProfiler);
heater.attachPhaseGuard(phaseGuard);
heater.start();
```

---

## Dev Workflow

```bash
npm install
npm start   # runs electron console to control the rig
```

The default build stubs hardware interfaces so you can preview the pulse choreography with WebGL visualizers before connecting real speakers.

---

## Experiment Ideas

- Blend IR heaters with the resonance hotspot for a hybrid warm zone.
- Add AR overlays to visualize where the constructive interference sits.
- Modulate hotspot location with hand-tracking for “heat following your palm.”

---

*Another entry in the Bat Belt for playful resonance engineering.* 
