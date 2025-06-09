declare module '@tonejs/midi' {
    export class Midi {
        constructor();
        addTrack(): Track;
        tracks: Track[];
    }

    export class Track {
        addNote(note: {
            midi: number;
            time: number;
            duration: number;
        }): void;
        notes: Array<{
            midi: number;
            time: number;
            duration: number;
        }>;
    }
} 