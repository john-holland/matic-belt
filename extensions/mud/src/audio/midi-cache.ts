import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Midi } from '@tonejs/midi';

const execAsync = promisify(exec);

export class MidiCache {
    private readonly CACHE_DIR = path.join(process.cwd(), 'cache', 'midi');
    private readonly REPO_URL = 'git@github.com:ldrolez/free-midi-chords.git';
    private readonly REPO_DIR = path.join(this.CACHE_DIR, 'free-midi-chords');
    private cache: Map<string, Midi> = new Map();

    constructor() {
        this.initializeCache();
    }

    private async initializeCache(): Promise<void> {
        try {
            // Create cache directory if it doesn't exist
            await fs.mkdir(this.CACHE_DIR, { recursive: true });

            // Clone repository if it doesn't exist
            if (!await this.repoExists()) {
                await this.cloneRepo();
            }

            // Load MIDI files into cache
            await this.loadMidiFiles();
        } catch (error) {
            console.error('Failed to initialize MIDI cache:', error);
        }
    }

    private async repoExists(): Promise<boolean> {
        try {
            await fs.access(path.join(this.REPO_DIR, '.git'));
            return true;
        } catch {
            return false;
        }
    }

    private async cloneRepo(): Promise<void> {
        try {
            await execAsync(`git clone ${this.REPO_URL} ${this.REPO_DIR}`);
        } catch (error) {
            console.error('Failed to clone MIDI repository:', error);
            throw error;
        }
    }

    private async loadMidiFiles(): Promise<void> {
        try {
            const files = await this.findMidiFiles(this.REPO_DIR);
            for (const file of files) {
                const key = path.basename(file, '.mid');
                const midi = await this.loadMidiFile(file);
                this.cache.set(key, midi);
            }
        } catch (error) {
            console.error('Failed to load MIDI files:', error);
        }
    }

    private async findMidiFiles(dir: string): Promise<string[]> {
        const files: string[] = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...await this.findMidiFiles(fullPath));
            } else if (entry.name.endsWith('.mid')) {
                files.push(fullPath);
            }
        }

        return files;
    }

    private async loadMidiFile(filePath: string): Promise<Midi> {
        const buffer = await fs.readFile(filePath);
        return Midi.fromBuffer(buffer);
    }

    public getMidi(key: string): Midi | undefined {
        return this.cache.get(key);
    }

    public getAllMidiKeys(): string[] {
        return Array.from(this.cache.keys());
    }

    public async refreshCache(): Promise<void> {
        try {
            // Pull latest changes
            await execAsync('git pull', { cwd: this.REPO_DIR });
            
            // Reload MIDI files
            this.cache.clear();
            await this.loadMidiFiles();
        } catch (error) {
            console.error('Failed to refresh MIDI cache:', error);
            throw error;
        }
    }
} 