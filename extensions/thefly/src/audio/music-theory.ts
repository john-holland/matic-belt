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
    const scale = this.getScale(key, mode);
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
        try {
          const noteName = this.midiToNoteName(note.midi);
          if (noteName) {
            notes.push({
              note: noteName,
              time: note.time,
              duration: note.duration
            });
          }
        } catch (error) {
          // Skip invalid notes
        }
      });
    });
    
    return notes;
  }

  private midiToNoteName(midiNote: number): string | null {
    try {
      // Convert MIDI note number to note name
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const octave = Math.floor(midiNote / 12) - 1;
      const noteIndex = midiNote % 12;
      return `${noteNames[noteIndex]}${octave}`;
    } catch {
      return null;
    }
  }

  private detectKey(notes: { note: string; time: number; duration: number }[]): string {
    if (notes.length === 0) return 'C';
    
    // Simple key detection based on most common notes
    const noteCounts = new Map<string, number>();
    notes.forEach(note => {
      const baseNote = note.note.replace(/\d/g, ''); // Remove octave
      noteCounts.set(baseNote, (noteCounts.get(baseNote) || 0) + 1);
    });
    
    // Find the most common note
    let maxCount = 0;
    let mostCommonNote = 'C';
    
    noteCounts.forEach((count, note) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonNote = note;
      }
    });
    
    return mostCommonNote;
  }

  private detectMode(notes: { note: string; time: number; duration: number }[], key: string): string {
    if (notes.length < 3) return 'major';
    
    // Simple mode detection based on intervals
    const intervals: number[] = [];
    for (let i = 1; i < notes.length; i++) {
      const interval = this.calculateInterval(notes[i - 1].note, notes[i].note);
      if (interval !== null) {
        intervals.push(interval);
      }
    }
    
    // Count major vs minor intervals
    const majorIntervals = intervals.filter(interval => [2, 4, 7, 9, 11].includes(interval)).length;
    const minorIntervals = intervals.filter(interval => [1, 3, 6, 8, 10].includes(interval)).length;
    
    return majorIntervals > minorIntervals ? 'major' : 'minor';
  }

  private calculateInterval(note1: string, note2: string): number | null {
    try {
      const midi1 = Note.midi(note1);
      const midi2 = Note.midi(note2);
      
      if (midi1 === null || midi2 === null) return null;
      
      return (midi2 - midi1 + 12) % 12;
    } catch {
      return null;
    }
  }

  private getScale(key: string, mode: string): string[] {
    try {
      // Create scale manually since Scale.get() might not work as expected
      const majorScale = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
      const minorScale = ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'];
      
      const scale = mode === 'major' ? majorScale : minorScale;
      
      // Transpose to the correct key
      const keyIndex = majorScale.indexOf(key);
      if (keyIndex === -1) return scale;
      
      return scale.map(note => {
        const noteIndex = majorScale.indexOf(note);
        if (noteIndex === -1) return note;
        const transposedIndex = (noteIndex + keyIndex) % 7;
        return majorScale[transposedIndex];
      });
    } catch {
      return ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    }
  }

  private analyzeChords(notes: { note: string; time: number; duration: number }[], key: string, mode: string): string[] {
    const chords: string[] = [];
    const scale = this.getScale(key, mode);
    
    // Simple chord analysis based on scale degrees
    for (let i = 0; i < notes.length - 2; i += 3) {
      const chordNotes = notes.slice(i, i + 3);
      const chordName = this.buildChordName(chordNotes, scale);
      if (chordName) {
        chords.push(chordName);
      }
    }
    
    return chords;
  }

  private buildChordName(notes: { note: string; time: number; duration: number }[], scale: string[]): string | null {
    if (notes.length < 3) return null;
    
    try {
      const baseNote = notes[0].note.replace(/\d/g, '');
      const scaleIndex = scale.indexOf(baseNote);
      
      if (scaleIndex === -1) return null;
      
      // Determine chord type based on scale position
      const chordTypes = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
      const chordType = chordTypes[scaleIndex % 7];
      
      return `${baseNote}${chordType}`;
    } catch {
      return null;
    }
  }

  private analyzeChordProgression(chords: string[]): string[] {
    return chords.slice(0, 4); // Return first 4 chords as progression
  }

  private analyzeRhythm(midi: Midi): { timeSignature: string; tempo: number; rhythmicPattern: string } {
    // Extract tempo and time signature from MIDI
    let tempo = 120;
    let timeSignature = '4/4';
    
    try {
      // Try to get tempo from MIDI header - use type assertion for compatibility
      const midiAny = midi as any;
      if (midiAny.header && midiAny.header.tempos && midiAny.header.tempos.length > 0) {
        tempo = midiAny.header.tempos[0].bpm || 120;
      }
      
      // Try to get time signature from MIDI header
      if (midiAny.header && midiAny.header.timeSignatures && midiAny.header.timeSignatures.length > 0) {
        const ts = midiAny.header.timeSignatures[0];
        timeSignature = `${ts.timeSignature[0]}/${ts.timeSignature[1]}`;
      }
    } catch {
      // Use defaults if header info is not available
    }
    
    return {
      timeSignature,
      tempo,
      rhythmicPattern: 'standard'
    };
  }

  private analyzeMelody(notes: { note: string; time: number; duration: number }[]): { range: string; contour: string; intervals: string[] } {
    if (notes.length === 0) {
      return {
        range: 'C4-C4',
        contour: 'static',
        intervals: []
      };
    }
    
    // Calculate melody range
    const pitches = notes.map(n => {
      try {
        const midi = Note.midi(n.note);
        return midi || 60;
      } catch {
        return 60;
      }
    });
    
    const min = Math.min(...pitches);
    const max = Math.max(...pitches);
    
    const lowNote = this.midiToNoteName(min) || 'C4';
    const highNote = this.midiToNoteName(max) || 'C4';
    const range = `${lowNote}-${highNote}`;
    
    // Analyze contour
    let contour = 'static';
    if (notes.length > 1) {
      const firstPitch = pitches[0];
      const lastPitch = pitches[pitches.length - 1];
      if (lastPitch > firstPitch) contour = 'ascending';
      else if (lastPitch < firstPitch) contour = 'descending';
    }
    
    // Calculate intervals
    const intervals: string[] = [];
    for (let i = 1; i < notes.length; i++) {
      const interval = this.calculateInterval(notes[i - 1].note, notes[i].note);
      if (interval !== null) {
        intervals.push(interval.toString());
      }
    }
    
    return { range, contour, intervals };
  }

  private analyzeHarmony(chords: string[]): { complexity: number; tension: number; resolution: number } {
    if (chords.length === 0) {
      return { complexity: 0, tension: 0, resolution: 0 };
    }
    
    // Calculate harmony metrics
    const complexity = Math.min(1.0, chords.length / 10);
    const tension = Math.min(1.0, chords.filter(c => c.includes('dim') || c.includes('aug')).length / chords.length);
    const resolution = Math.min(1.0, chords.filter(c => c.includes('maj')).length / chords.length);
    
    return { complexity, tension, resolution };
  }

  private analyzeEmotionalProfile(melody: { range: string; contour: string; intervals: string[] }, harmony: { complexity: number; tension: number; resolution: number }, rhythm: { timeSignature: string; tempo: number; rhythmicPattern: string }): { valence: number; energy: number; complexity: number } {
    // Calculate emotional profile based on musical features
    const valence = Math.max(0, Math.min(1, harmony.resolution * 0.7 + (melody.contour === 'ascending' ? 0.3 : 0)));
    const energy = Math.max(0, Math.min(1, rhythm.tempo / 200 + harmony.complexity * 0.5));
    const complexity = Math.max(0, Math.min(1, harmony.complexity * 0.6 + melody.intervals.length / 10));
    
    return { valence, energy, complexity };
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
    const midi1 = Note.midi(range[1]);
    const midi2 = Note.midi(range[0]);
    const rangeSize = (midi1 || 60) - (midi2 || 60);
    const rangeDesc = rangeSize > 12 ? 'spans a wide range' : 'stays within a narrow range';
    const contour = melody.contour.includes('ascending') ? 'tends to ascend' :
                   melody.contour.includes('descending') ? 'tends to descend' :
                   'moves in varied directions';
    return `${rangeDesc} and ${contour}`;
  }
} 