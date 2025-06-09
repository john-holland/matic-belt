import { Note, Scale } from 'tonal';
import { Midi } from '@tonejs/midi';

export interface MusicTheoryAnalysis {
  key: string;
  mode: string;
  scale: string[];
  chords: string[];
  chordProgression: string[];
  rhythm: {
    timeSignature: string;
    tempo: number;
    rhythmicPattern: string;
  };
  melody: {
    range: string;
    contour: string;
    intervals: string[];
  };
  harmony: {
    complexity: number;
    tension: number;
    resolution: number;
  };
  emotionalProfile: {
    valence: number;
    energy: number;
    complexity: number;
  };
}

export class MusicTheoryAnalyzer {
  private readonly SCALE_TYPES = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'];
  private readonly CHORD_TYPES = ['maj', 'min', 'dim', 'aug', '7', 'maj7', 'min7', 'dim7', 'aug7'];

  public analyzeMidi(midi: Midi): MusicTheoryAnalysis {
    const notes = this.extractNotes(midi);
    const key = this.detectKey(notes);
    const mode = this.detectMode(notes, key);
    const scale = Scale.get(`${key} ${mode}`).notes;
    const chords = this.analyzeChords(notes, key, mode);
    const progression = this.analyzeChordProgression(chords);
    const rhythm = this.analyzeRhythm(midi);
    const melody = this.analyzeMelody(notes);
    const harmony = this.analyzeHarmony(chords);
    const emotionalProfile = this.analyzeEmotionalProfile(melody, harmony, rhythm);

    return {
      key,
      mode,
      scale,
      chords,
      chordProgression: progression,
      rhythm,
      melody,
      harmony,
      emotionalProfile
    };
  }

  private extractNotes(midi: Midi): { note: string; time: number; duration: number }[] {
    const notes: { note: string; time: number; duration: number }[] = [];
    
    midi.tracks.forEach(track => {
      track.notes.forEach(note => {
        const noteName = Note.midi(note.midi);
        if (noteName) {
          notes.push({
            note: noteName,
            time: note.time,
            duration: note.duration
          });
        }
      });
    });

    return notes.sort((a, b) => a.time - b.time);
  }

  private detectKey(notes: { note: string; time: number; duration: number }[]): string {
    // Count note frequencies
    const noteCounts = new Map<string, number>();
    notes.forEach(({ note }) => {
      noteCounts.set(note, (noteCounts.get(note) || 0) + 1);
    });

    // Find the most common note as potential tonic
    let maxCount = 0;
    let tonic = 'C';
    noteCounts.forEach((count, note) => {
      if (count > maxCount) {
        maxCount = count;
        tonic = note;
      }
    });

    return tonic;
  }

  private detectMode(notes: { note: string; time: number; duration: number }[], key: string): string {
    // Analyze intervals to determine mode
    const intervals = this.getIntervals(notes);
    const modeScores = new Map<string, number>();

    this.SCALE_TYPES.forEach(mode => {
      const scale = Scale.get(`${key} ${mode}`).notes;
      let score = 0;
      intervals.forEach(interval => {
        if (scale.includes(interval)) score++;
      });
      modeScores.set(mode, score);
    });

    // Find the mode with highest score
    let maxScore = 0;
    let detectedMode = 'major';
    modeScores.forEach((score, mode) => {
      if (score > maxScore) {
        maxScore = score;
        detectedMode = mode;
      }
    });

    return detectedMode;
  }

  private getIntervals(notes: { note: string; time: number; duration: number }[]): string[] {
    const intervals: string[] = [];
    for (let i = 1; i < notes.length; i++) {
      const interval = Note.interval(notes[i - 1].note, notes[i].note);
      if (interval) intervals.push(interval);
    }
    return intervals;
  }

  private analyzeChords(
    notes: { note: string; time: number; duration: number }[],
    key: string,
    mode: string
  ): string[] {
    const chords: string[] = [];
    const scale = Scale.get(`${key} ${mode}`).notes;
    
    // Group notes by time
    const timeGroups = new Map<number, string[]>();
    notes.forEach(({ note, time }) => {
      const group = timeGroups.get(time) || [];
      group.push(note);
      timeGroups.set(time, group);
    });

    // Analyze each group for chords
    timeGroups.forEach(group => {
      const chord = this.detectChord(group, scale);
      if (chord) {
        chords.push(chord);
      }
    });

    return chords;
  }

  private detectChord(notes: string[], scale: string[]): string | null {
    // Simple chord detection based on scale degrees
    const scaleDegrees = notes.map(note => scale.indexOf(note));
    if (scaleDegrees.length < 3) return null;

    // Check for major triad
    if (scaleDegrees.includes(0) && scaleDegrees.includes(2) && scaleDegrees.includes(4)) {
      return `${scale[0]}maj`;
    }
    // Check for minor triad
    if (scaleDegrees.includes(0) && scaleDegrees.includes(2) && scaleDegrees.includes(3)) {
      return `${scale[0]}min`;
    }
    // Check for dominant 7th
    if (scaleDegrees.includes(0) && scaleDegrees.includes(2) && scaleDegrees.includes(4) && scaleDegrees.includes(6)) {
      return `${scale[0]}7`;
    }

    return null;
  }

  private analyzeChordProgression(chords: string[]): string[] {
    const progression: string[] = [];
    let currentChord = '';
    let count = 0;

    chords.forEach(chord => {
      if (chord === currentChord) {
        count++;
      } else {
        if (currentChord) {
          progression.push(`${currentChord}(${count})`);
        }
        currentChord = chord;
        count = 1;
      }
    });

    if (currentChord) {
      progression.push(`${currentChord}(${count})`);
    }

    return progression;
  }

  private analyzeRhythm(midi: Midi): { timeSignature: string; tempo: number; rhythmicPattern: string } {
    const tempo = midi.header?.tempos[0]?.bpm || 120;
    const timeSignature = `${midi.header?.timeSignatures[0]?.timeSignature[0] || 4}/${midi.header?.timeSignatures[0]?.timeSignature[1] || 4}`;
    
    // Analyze rhythmic pattern
    const durations = midi.tracks.flatMap(track => 
      track.notes.map(note => note.duration)
    );
    const pattern = this.detectRhythmicPattern(durations);

    return {
      timeSignature,
      tempo,
      rhythmicPattern: pattern
    };
  }

  private detectRhythmicPattern(durations: number[]): string {
    // Group similar durations
    const groups = new Map<number, number>();
    durations.forEach(duration => {
      const rounded = Math.round(duration * 4) / 4; // Round to quarter notes
      groups.set(rounded, (groups.get(rounded) || 0) + 1);
    });

    // Convert to pattern description
    const pattern: string[] = [];
    groups.forEach((count, duration) => {
      const noteType = this.getNoteType(duration);
      pattern.push(`${noteType}(${count})`);
    });

    return pattern.join('-');
  }

  private getNoteType(duration: number): string {
    if (duration >= 4) return 'whole';
    if (duration >= 2) return 'half';
    if (duration >= 1) return 'quarter';
    if (duration >= 0.5) return 'eighth';
    if (duration >= 0.25) return 'sixteenth';
    return 'thirty-second';
  }

  private analyzeMelody(notes: { note: string; time: number; duration: number }[]): {
    range: string;
    contour: string;
    intervals: string[];
  } {
    const pitches = notes.map(n => Note.get(n.note).height);
    const min = Math.min(...pitches);
    const max = Math.max(...pitches);
    const range = `${Note.fromMidi(min)}-${Note.fromMidi(max)}`;

    const contour = this.analyzeMelodicContour(pitches);
    const intervals = this.getIntervals(notes);

    return {
      range,
      contour,
      intervals
    };
  }

  private analyzeMelodicContour(pitches: number[]): string {
    const directions: string[] = [];
    for (let i = 1; i < pitches.length; i++) {
      const diff = pitches[i] - pitches[i - 1];
      if (diff > 0) directions.push('up');
      else if (diff < 0) directions.push('down');
      else directions.push('same');
    }

    // Simplify contour
    const simplified = directions.reduce((acc, dir) => {
      if (acc[acc.length - 1] !== dir) acc.push(dir);
      return acc;
    }, [] as string[]);

    return simplified.join('-');
  }

  private analyzeHarmony(chords: string[]): {
    complexity: number;
    tension: number;
    resolution: number;
  } {
    const complexity = this.calculateHarmonicComplexity(chords);
    const tension = this.calculateHarmonicTension(chords);
    const resolution = this.calculateHarmonicResolution(chords);

    return {
      complexity,
      tension,
      resolution
    };
  }

  private calculateHarmonicComplexity(chords: string[]): number {
    // Count different chord types and extensions
    const uniqueChords = new Set(chords);
    const extensions = chords.filter(c => c.includes('7') || c.includes('9')).length;
    return (uniqueChords.size + extensions) / chords.length;
  }

  private calculateHarmonicTension(chords: string[]): number {
    // Analyze dissonant intervals and chord types
    const dissonantChords = chords.filter(c => 
      c.includes('dim') || c.includes('aug') || c.includes('7')
    ).length;
    return dissonantChords / chords.length;
  }

  private calculateHarmonicResolution(chords: string[]): number {
    // Count perfect cadences and resolutions
    let resolutions = 0;
    for (let i = 1; i < chords.length; i++) {
      if (this.isResolution(chords[i - 1], chords[i])) resolutions++;
    }
    return resolutions / (chords.length - 1);
  }

  private isResolution(chord1: string, chord2: string): boolean {
    // Check for common resolution patterns
    const resolutions = [
      ['V7', 'I'],
      ['V', 'I'],
      ['vii°', 'I'],
      ['IV', 'I']
    ];
    return resolutions.some(([c1, c2]) => 
      chord1.includes(c1) && chord2.includes(c2)
    );
  }

  private analyzeEmotionalProfile(
    melody: { range: string; contour: string; intervals: string[] },
    harmony: { complexity: number; tension: number; resolution: number },
    rhythm: { timeSignature: string; tempo: number; rhythmicPattern: string }
  ): {
    valence: number;
    energy: number;
    complexity: number;
  } {
    // Calculate emotional profile based on musical features
    const valence = this.calculateValence(melody, harmony);
    const energy = this.calculateEnergy(rhythm, melody);
    const complexity = this.calculateComplexity(melody, harmony, rhythm);

    return {
      valence,
      energy,
      complexity
    };
  }

  private calculateValence(
    melody: { range: string; contour: string; intervals: string[] },
    harmony: { complexity: number; tension: number; resolution: number }
  ): number {
    // Higher valence for:
    // - Major keys and intervals
    // - Upward contours
    // - Resolved harmonies
    const majorIntervals = melody.intervals.filter(i => 
      i.includes('M') || i.includes('P')
    ).length;
    const upwardContours = melody.contour.split('-').filter(c => c === 'up').length;
    
    return (
      (majorIntervals / melody.intervals.length) * 0.4 +
      (upwardContours / melody.contour.split('-').length) * 0.3 +
      harmony.resolution * 0.3
    );
  }

  private calculateEnergy(
    rhythm: { timeSignature: string; tempo: number; rhythmicPattern: string },
    melody: { range: string; contour: string; intervals: string[] }
  ): number {
    // Higher energy for:
    // - Faster tempos
    // - Wider ranges
    // - More active rhythms
    const tempoFactor = Math.min(rhythm.tempo / 180, 1);
    const rangeFactor = this.calculateRangeFactor(melody.range);
    const rhythmFactor = this.calculateRhythmFactor(rhythm.rhythmicPattern);

    return (
      tempoFactor * 0.4 +
      rangeFactor * 0.3 +
      rhythmFactor * 0.3
    );
  }

  private calculateRangeFactor(range: string): number {
    const [low, high] = range.split('-');
    const lowHeight = Note.get(low).height;
    const highHeight = Note.get(high).height;
    return Math.min((highHeight - lowHeight) / 24, 1);
  }

  private calculateRhythmFactor(pattern: string): number {
    const shortNotes = pattern.split('-').filter(p => 
      p.includes('sixteenth') || p.includes('eighth')
    ).length;
    return Math.min(shortNotes / 8, 1);
  }

  private calculateComplexity(
    melody: { range: string; contour: string; intervals: string[] },
    harmony: { complexity: number; tension: number; resolution: number },
    rhythm: { timeSignature: string; tempo: number; rhythmicPattern: string }
  ): number {
    return (
      harmony.complexity * 0.4 +
      (melody.intervals.length / 20) * 0.3 +
      (rhythm.rhythmicPattern.split('-').length / 8) * 0.3
    );
  }

  public generateSummary(analysis: MusicTheoryAnalysis): string {
    return `
Music Theory Analysis:
-------------------
Key: ${analysis.key} ${analysis.mode}
Scale: ${analysis.scale.join(' ')}
Chord Progression: ${analysis.chordProgression.join(' → ')}

Rhythm:
- Time Signature: ${analysis.rhythm.timeSignature}
- Tempo: ${analysis.rhythm.tempo} BPM
- Pattern: ${analysis.rhythm.rhythmicPattern}

Melody:
- Range: ${analysis.melody.range}
- Contour: ${analysis.melody.contour}
- Notable Intervals: ${analysis.melody.intervals.slice(0, 5).join(', ')}

Harmony:
- Complexity: ${(analysis.harmony.complexity * 100).toFixed(1)}%
- Tension: ${(analysis.harmony.tension * 100).toFixed(1)}%
- Resolution: ${(analysis.harmony.resolution * 100).toFixed(1)}%

Emotional Profile:
- Valence: ${(analysis.emotionalProfile.valence * 100).toFixed(1)}%
- Energy: ${(analysis.emotionalProfile.energy * 100).toFixed(1)}%
- Complexity: ${(analysis.emotionalProfile.complexity * 100).toFixed(1)}%

This piece exhibits ${this.getEmotionalDescription(analysis.emotionalProfile)} characteristics,
with ${this.getHarmonicDescription(analysis.harmony)} harmonic structure
and ${this.getRhythmicDescription(analysis.rhythm)} rhythmic patterns.
The melody ${this.getMelodicDescription(analysis.melody)}.
    `.trim();
  }

  private getEmotionalDescription(profile: { valence: number; energy: number; complexity: number }): string {
    const valence = profile.valence > 0.6 ? 'positive' : profile.valence < 0.4 ? 'negative' : 'neutral';
    const energy = profile.energy > 0.6 ? 'high energy' : profile.energy < 0.4 ? 'low energy' : 'moderate energy';
    const complexity = profile.complexity > 0.6 ? 'complex' : profile.complexity < 0.4 ? 'simple' : 'moderately complex';
    return `${valence}, ${energy}, and ${complexity}`;
  }

  private getHarmonicDescription(harmony: { complexity: number; tension: number; resolution: number }): string {
    if (harmony.complexity > 0.7) return 'a highly complex';
    if (harmony.tension > 0.7) return 'a tense and unresolved';
    if (harmony.resolution > 0.7) return 'a well-resolved';
    return 'a balanced';
  }

  private getRhythmicDescription(rhythm: { timeSignature: string; tempo: number; rhythmicPattern: string }): string {
    const tempo = rhythm.tempo > 140 ? 'fast' : rhythm.tempo < 100 ? 'slow' : 'moderate';
    const complexity = rhythm.rhythmicPattern.split('-').length > 4 ? 'complex' : 'simple';
    return `${tempo} and ${complexity}`;
  }

  private getMelodicDescription(melody: { range: string; contour: string; intervals: string[] }): string {
    const range = melody.range.split('-');
    const rangeSize = Note.get(range[1]).height - Note.get(range[0]).height;
    const rangeDesc = rangeSize > 12 ? 'spans a wide range' : 'stays within a narrow range';
    const contour = melody.contour.includes('up-up') ? 'tends to ascend' :
                   melody.contour.includes('down-down') ? 'tends to descend' :
                   'moves in varied directions';
    return `${rangeDesc} and ${contour}`;
  }
} 