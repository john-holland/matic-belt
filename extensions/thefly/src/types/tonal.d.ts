declare module 'tonal' {
    export const Note: {
        midi(note: string): number | null;
        fromFreq(frequency: number): string;
    };

    export const Scale: {
        detect(notes: string[]): string[];
    };
} 