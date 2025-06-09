import { DwarfDanceController } from './dwarf-dance';
import { DwarfHouseBuilder } from './dwarf-house';
import { EventEmitter } from 'events';

export class DwarfCommandHandler extends EventEmitter {
    private dwarfController: DwarfDanceController;
    private houseBuilder: DwarfHouseBuilder;
    private isAwake: boolean = false;
    private isDancing: boolean = false;

    constructor() {
        super();
        this.dwarfController = new DwarfDanceController();
        this.houseBuilder = new DwarfHouseBuilder();
        
        // Set up event listeners
        this.dwarfController.on('status', (data) => {
            this.emit('status', data);
        });
        
        this.dwarfController.on('motion', (data) => {
            this.emit('motion', data);
        });
        
        this.dwarfController.on('midi', (data) => {
            this.emit('midi', data);
        });
    }

    public handleCommand(command: string): void {
        const normalizedCommand = command.toLowerCase().trim();
        
        // Always add the command to the house builder's chat history
        this.houseBuilder.addChatMessage(command);
        
        switch (normalizedCommand) {
            case 'wake up dwarf':
            case 'hey dwarf':
            case 'dwarf wake up':
                this.wakeUpDwarf();
                break;
                
            case 'watch me dance':
                if (this.isAwake) {
                    this.isDancing = true;
                    this.dwarfController.startDancing();
                } else {
                    this.emit('status', {
                        message: "*snoring* Zzz... *mumbles* Let me sleep...",
                        energy: 0,
                        mood: 'sleeping'
                    });
                }
                break;
                
            case 'done dancing':
            case 'coda':
                if (this.isAwake && this.isDancing) {
                    this.isDancing = false;
                    this.dwarfController.stopDancing();
                    this.buildHouse();
                }
                break;
                
            case 'how are you dwarf':
            case 'dwarf status':
                this.getDwarfStatus();
                break;
                
            case 'show me your moves':
            case 'dwarf moves':
                this.showAvailableMoves();
                break;
                
            case 'build house':
            case 'make house':
                if (this.isAwake) {
                    this.buildHouse();
                } else {
                    this.emit('status', {
                        message: "*snoring* Zzz...",
                        energy: 0,
                        mood: 'sleeping'
                    });
                }
                break;
                
            default:
                // Check if command contains "dwarf" and the dwarf is awake
                if (normalizedCommand.includes('dwarf') && this.isAwake) {
                    this.emit('status', {
                        message: "*adjusts beard* Aye, what can I do for you?",
                        energy: this.dwarfController.getState().energy,
                        mood: this.dwarfController.getState().mood
                    });
                }
                break;
        }
    }

    private wakeUpDwarf(): void {
        if (this.isAwake) {
            this.emit('status', {
                message: "*yawns* I'm already awake, laddie!",
                energy: this.dwarfController.getState().energy,
                mood: this.dwarfController.getState().mood
            });
            return;
        }
        
        this.isAwake = true;
        this.dwarfController.wakeUp();
    }

    private getDwarfStatus(): void {
        if (!this.isAwake) {
            this.emit('status', {
                message: "*snoring* Zzz...",
                energy: 0,
                mood: 'sleeping'
            });
            return;
        }
        
        const state = this.dwarfController.getState();
        let statusMessage = `*adjusts beard* Current status:\n`;
        statusMessage += `- Energy: ${Math.round(state.energy * 100)}%\n`;
        statusMessage += `- Mood: ${state.mood}\n`;
        statusMessage += `- Current Style: ${state.currentStyle}\n`;
        statusMessage += `- Dancing: ${state.isDancing ? 'Yes' : 'No'}`;
        
        this.emit('status', {
            message: statusMessage,
            energy: state.energy,
            mood: state.mood
        });
    }

    private showAvailableMoves(): void {
        if (!this.isAwake) {
            this.emit('status', {
                message: "*snoring* Zzz...",
                energy: 0,
                mood: 'sleeping'
            });
            return;
        }
        
        const moves = this.dwarfController.getAvailableMoves();
        let movesMessage = "*straightens beard* Here are my moves:\n";
        moves.forEach((move, index) => {
            movesMessage += `${index + 1}. ${move}\n`;
        });
        
        this.emit('status', {
            message: movesMessage,
            energy: this.dwarfController.getState().energy,
            mood: this.dwarfController.getState().mood
        });
    }

    private buildHouse(): void {
        const house = this.houseBuilder.buildHouse();
        const description = this.houseBuilder.getHouseDescription();
        
        this.emit('status', {
            message: `${description}\n\n${house}`,
            energy: this.dwarfController.getState().energy,
            mood: this.dwarfController.getState().mood
        });
    }
} 