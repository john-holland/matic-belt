interface TextBlock {
    text: string;
    width: number;
    height: number;
    position: { x: number; y: number };
}

interface HouseStructure {
    leftPillar: TextBlock;
    rightPillar: TextBlock;
    roof: TextBlock;
    center: TextBlock;
}

export class DwarfHouseBuilder {
    private chatHistory: string[] = [];
    private readonly PILLAR_WIDTH = 5;
    private readonly PILLAR_HEIGHT = 3;
    private readonly ROOF_WIDTH = 15;
    private readonly ROOF_HEIGHT = 2;
    private readonly CENTER_TEXT = "Dwarf";

    constructor() {
        this.chatHistory = [];
    }

    public addChatMessage(message: string): void {
        this.chatHistory.push(message);
    }

    public buildHouse(): string {
        if (this.chatHistory.length < 3) {
            return "Not enough chat messages to build a house!";
        }

        const structure = this.selectBuildingMaterials();
        return this.renderHouse(structure);
    }

    private selectBuildingMaterials(): HouseStructure {
        // Filter messages to find suitable building materials
        const validMessages = this.chatHistory.filter(msg => 
            msg.length >= Math.max(this.PILLAR_WIDTH, this.ROOF_WIDTH)
        );

        // Select materials for each part
        const leftPillar = this.findSuitablePillar(validMessages);
        const rightPillar = this.findSuitablePillar(validMessages);
        const roof = this.findSuitableRoof(validMessages);

        return {
            leftPillar: {
                text: leftPillar,
                width: this.PILLAR_WIDTH,
                height: this.PILLAR_HEIGHT,
                position: { x: 0, y: 0 }
            },
            rightPillar: {
                text: rightPillar,
                width: this.PILLAR_WIDTH,
                height: this.PILLAR_HEIGHT,
                position: { x: this.PILLAR_WIDTH + 2, y: 0 }
            },
            roof: {
                text: roof,
                width: this.ROOF_WIDTH,
                height: this.ROOF_HEIGHT,
                position: { x: 0, y: this.PILLAR_HEIGHT }
            },
            center: {
                text: this.CENTER_TEXT,
                width: this.CENTER_TEXT.length,
                height: 1,
                position: { 
                    x: Math.floor((this.PILLAR_WIDTH * 2 + 2 - this.CENTER_TEXT.length) / 2),
                    y: Math.floor(this.PILLAR_HEIGHT / 2)
                }
            }
        };
    }

    private findSuitablePillar(messages: string[]): string {
        // Find a message that can be used as a pillar
        const suitableMessages = messages.filter(msg => 
            msg.length >= this.PILLAR_WIDTH && 
            this.hasGoodKerning(msg)
        );

        if (suitableMessages.length === 0) {
            return "     "; // Fallback empty pillar
        }

        const selected = suitableMessages[Math.floor(Math.random() * suitableMessages.length)];
        return this.extractPillarText(selected);
    }

    private findSuitableRoof(messages: string[]): string {
        // Find a message that can be used as a roof
        const suitableMessages = messages.filter(msg => 
            msg.length >= this.ROOF_WIDTH && 
            this.hasGoodKerning(msg)
        );

        if (suitableMessages.length === 0) {
            return "~~~~~~~~~~~~~"; // Fallback corrugated tilde roof
        }

        const selected = suitableMessages[Math.floor(Math.random() * suitableMessages.length)];
        return this.extractRoofText(selected);
    }

    private hasGoodKerning(text: string): boolean {
        // Check if the text has good spacing for building
        const spaces = text.split('').filter(char => char === ' ').length;
        return spaces >= 2; // At least 2 spaces for good structure
    }

    private extractPillarText(text: string): string {
        // Extract a suitable portion for a pillar
        const words = text.split(' ');
        if (words.length < 3) return "[[[]]"; // Fallback cinderblock bracket pillar

        // Find a good section for the pillar
        let pillarText = "";
        let currentLength = 0;
        
        for (const word of words) {
            if (currentLength + word.length <= this.PILLAR_WIDTH) {
                pillarText += word + " ";
                currentLength += word.length + 1;
            }
        }

        // Pad or trim to exact width
        return pillarText.padEnd(this.PILLAR_WIDTH).slice(0, this.PILLAR_WIDTH);
    }

    private extractRoofText(text: string): string {
        // Extract a suitable portion for the roof
        const words = text.split(' ');
        if (words.length < 4) return "               ";

        // Find a good section for the roof
        let roofText = "";
        let currentLength = 0;
        
        for (const word of words) {
            if (currentLength + word.length <= this.ROOF_WIDTH) {
                roofText += word + " ";
                currentLength += word.length + 1;
            }
        }

        // Pad or trim to exact width
        return roofText.padEnd(this.ROOF_WIDTH).slice(0, this.ROOF_WIDTH);
    }

    private renderHouse(structure: HouseStructure): string {
        const totalWidth = structure.rightPillar.position.x + structure.rightPillar.width;
        const totalHeight = structure.roof.position.y + structure.roof.height;
        
        // Create empty grid
        const grid: string[][] = Array(totalHeight)
            .fill(null)
            .map(() => Array(totalWidth).fill(' '));

        // Place left pillar
        this.placeTextBlock(grid, structure.leftPillar);
        
        // Place right pillar
        this.placeTextBlock(grid, structure.rightPillar);
        
        // Place roof
        this.placeTextBlock(grid, structure.roof);
        
        // Place center text
        this.placeTextBlock(grid, structure.center);

        // Convert grid to string
        return grid.map(row => row.join('')).join('\n');
    }

    private placeTextBlock(grid: string[][], block: TextBlock): void {
        const lines = block.text.split('\n');
        for (let y = 0; y < block.height; y++) {
            for (let x = 0; x < block.width; x++) {
                const char = lines[y]?.[x] || ' ';
                grid[block.position.y + y][block.position.x + x] = char;
            }
        }
    }

    public getHouseDescription(): string {
        return `*adjusts beard* Aye, I've built a fine lean-to from our chat! 
The left pillar is made of ${this.chatHistory[0]?.slice(0, 10)}...,
the right pillar from ${this.chatHistory[1]?.slice(0, 10)}...,
and the roof from ${this.chatHistory[2]?.slice(0, 10)}...!
A proper dwarf house, if I do say so myself! *nods approvingly*`;
    }
} 