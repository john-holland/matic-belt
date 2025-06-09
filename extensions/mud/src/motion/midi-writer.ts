interface MIDINote {
    time: number;
    note: number;
    velocity: number;
    duration: number;
}

export class MIDIWriter {
    private readonly PPQ = 480; // Pulses Per Quarter note
    private readonly headerChunk = [0x4D, 0x54, 0x68, 0x64]; // MThd
    private readonly trackChunk = [0x4D, 0x54, 0x72, 0x6B]; // MTrk

    public async generateMIDI(notes: MIDINote[]): Promise<Uint8Array> {
        // Sort notes by time
        notes.sort((a, b) => a.time - b.time);

        // Generate header chunk
        const header = this.generateHeaderChunk();
        
        // Generate track chunk
        const track = this.generateTrackChunk(notes);
        
        // Combine chunks
        const midiData = new Uint8Array(header.length + track.length);
        midiData.set(header, 0);
        midiData.set(track, header.length);
        
        return midiData;
    }

    private generateHeaderChunk(): Uint8Array {
        const header = new Uint8Array(14);
        
        // MThd
        header.set(this.headerChunk, 0);
        
        // Length (always 6)
        header.set([0x00, 0x00, 0x00, 0x06], 4);
        
        // Format (1 = multiple tracks)
        header.set([0x00, 0x01], 8);
        
        // Number of tracks (1)
        header.set([0x00, 0x01], 10);
        
        // Time division (PPQ)
        header.set([
            (this.PPQ >> 8) & 0xFF,
            this.PPQ & 0xFF
        ], 12);
        
        return header;
    }

    private generateTrackChunk(notes: MIDINote[]): Uint8Array {
        const events: number[] = [];
        let lastTime = 0;
        
        // Add tempo event
        events.push(...this.createTempoEvent(500000)); // 120 BPM
        
        // Add time signature event
        events.push(...this.createTimeSignatureEvent(4, 4));
        
        // Add notes
        for (const note of notes) {
            // Note on
            events.push(...this.createDeltaTime(note.time - lastTime));
            events.push(...this.createNoteOnEvent(note.note, note.velocity));
            lastTime = note.time;
            
            // Note off
            events.push(...this.createDeltaTime(note.duration));
            events.push(...this.createNoteOffEvent(note.note));
            lastTime += note.duration;
        }
        
        // Add end of track
        events.push(0x00, 0xFF, 0x2F, 0x00);
        
        // Create track chunk
        const trackData = new Uint8Array(events);
        const trackLength = trackData.length;
        
        const track = new Uint8Array(8 + trackLength);
        track.set(this.trackChunk, 0);
        track.set([
            (trackLength >> 24) & 0xFF,
            (trackLength >> 16) & 0xFF,
            (trackLength >> 8) & 0xFF,
            trackLength & 0xFF
        ], 4);
        track.set(trackData, 8);
        
        return track;
    }

    private createDeltaTime(time: number): number[] {
        const delta = Math.round(time * this.PPQ);
        const bytes: number[] = [];
        
        let value = delta;
        while (value > 0) {
            bytes.unshift(value & 0x7F);
            value >>= 7;
            if (value > 0) {
                bytes[0] |= 0x80;
            }
        }
        
        return bytes.length > 0 ? bytes : [0x00];
    }

    private createTempoEvent(microsecondsPerQuarter: number): number[] {
        return [
            0x00, // Delta time
            0xFF, // Meta event
            0x51, // Tempo
            0x03, // Length
            (microsecondsPerQuarter >> 16) & 0xFF,
            (microsecondsPerQuarter >> 8) & 0xFF,
            microsecondsPerQuarter & 0xFF
        ];
    }

    private createTimeSignatureEvent(numerator: number, denominator: number): number[] {
        return [
            0x00, // Delta time
            0xFF, // Meta event
            0x58, // Time signature
            0x04, // Length
            numerator,
            Math.log2(denominator),
            0x18, // MIDI clocks per metronome click
            0x08  // 32nd notes per 24 MIDI clocks
        ];
    }

    private createNoteOnEvent(note: number, velocity: number): number[] {
        return [
            0x90, // Note on
            note,
            velocity
        ];
    }

    private createNoteOffEvent(note: number): number[] {
        return [
            0x80, // Note off
            note,
            0x00  // Velocity
        ];
    }
} 