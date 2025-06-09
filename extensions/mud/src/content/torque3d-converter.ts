import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

interface Torque3DObject {
    name: string;
    class: string;
    position: string;
    rotation: string;
    scale: string;
    properties: Record<string, any>;
}

interface Torque3DLevel {
    objects: Torque3DObject[];
    environment: Record<string, any>;
}

export class Torque3DConverter {
    private basePath: string;
    private outputPath: string;

    constructor(basePath: string, outputPath: string) {
        this.basePath = basePath;
        this.outputPath = outputPath;
    }

    public async convertLevel(misFile: string, tamlFile: string): Promise<void> {
        // Read and parse the level files
        const misContent = await fs.promises.readFile(path.join(this.basePath, misFile), 'utf-8');
        const tamlContent = await fs.promises.readFile(path.join(this.basePath, tamlFile), 'utf-8');

        // Parse TAML file (YAML format)
        const tamlData = parse(tamlContent);

        // Parse MIS file (TorqueScript format)
        const misData = this.parseMisFile(misContent);

        // Convert to our scene graph format
        const sceneGraph = this.convertToSceneGraph(misData, tamlData);

        // Write the output
        const outputFile = path.join(this.outputPath, `${path.basename(misFile, '.mis')}.json`);
        await fs.promises.writeFile(outputFile, JSON.stringify(sceneGraph, null, 2));
    }

    private parseMisFile(content: string): Torque3DLevel {
        const objects: Torque3DObject[] = [];
        const environment: Record<string, any> = {};

        // Split content into lines and process each line
        const lines = content.split('\n');
        let currentObject: Partial<Torque3DObject> | null = null;

        for (const line of lines) {
            const trimmedLine = line.trim();

            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('//')) {
                continue;
            }

            // Check for new object definition
            if (trimmedLine.startsWith('new')) {
                if (currentObject) {
                    objects.push(currentObject as Torque3DObject);
                }

                const match = trimmedLine.match(/new\s+(\w+)\s*\(([^)]+)\)/);
                if (match) {
                    currentObject = {
                        class: match[1],
                        name: match[2].trim(),
                        properties: {}
                    };
                }
            }
            // Parse object properties
            else if (currentObject && trimmedLine.includes('=')) {
                const [key, value] = trimmedLine.split('=').map(s => s.trim());
                
                // Handle special properties
                if (key === 'position') {
                    currentObject.position = value;
                } else if (key === 'rotation') {
                    currentObject.rotation = value;
                } else if (key === 'scale') {
                    currentObject.scale = value;
                } else {
                    currentObject.properties![key] = this.parseValue(value);
                }
            }
            // Parse environment settings
            else if (trimmedLine.startsWith('$')) {
                const [key, value] = trimmedLine.split('=').map(s => s.trim());
                environment[key] = this.parseValue(value);
            }
        }

        // Add the last object
        if (currentObject) {
            objects.push(currentObject as Torque3DObject);
        }

        return { objects, environment };
    }

    private parseValue(value: string): any {
        // Remove quotes if present
        value = value.replace(/^"|"$/g, '');

        // Try to parse as number
        if (!isNaN(Number(value))) {
            return Number(value);
        }

        // Try to parse as boolean
        if (value === 'true') return true;
        if (value === 'false') return false;

        // Try to parse as vector
        if (value.startsWith('"') && value.endsWith('"')) {
            const vectorStr = value.slice(1, -1);
            const numbers = vectorStr.split(' ').map(Number);
            if (numbers.length === 3 && !numbers.some(isNaN)) {
                return numbers;
            }
        }

        return value;
    }

    private convertToSceneGraph(misData: Torque3DLevel, tamlData: any): any {
        const sceneGraph = {
            name: "Torque3D Level",
            nodes: [],
            materials: [],
            animations: []
        };

        // Convert objects to scene nodes
        for (const obj of misData.objects) {
            const node = this.convertObjectToNode(obj);
            if (node) {
                sceneGraph.nodes.push(node);
            }
        }

        // Add environment settings as properties
        sceneGraph.properties = {
            environment: misData.environment,
            timeOfDay: tamlData.timeOfDay || 'day',
            weather: tamlData.weather || 'clear'
        };

        return sceneGraph;
    }

    private convertObjectToNode(obj: Torque3DObject): any {
        // Skip certain object types
        if (['SimGroup', 'SimSet'].includes(obj.class)) {
            return null;
        }

        const node: any = {
            id: obj.name,
            type: this.mapTorqueClassToType(obj.class),
            transform: {
                position: this.parseVector(obj.position),
                rotation: this.parseVector(obj.rotation),
                scale: this.parseVector(obj.scale)
            }
        };

        // Map Torque3D properties to our format
        if (obj.properties) {
            node.properties = this.mapProperties(obj.properties);
        }

        return node;
    }

    private mapTorqueClassToType(torqueClass: string): string {
        const typeMap: Record<string, string> = {
            'StaticShape': 'model',
            'TSStatic': 'model',
            'ShapeBase': 'model',
            'LightBase': 'light',
            'Camera': 'camera',
            'ParticleEmitter': 'particle',
            'WaterBlock': 'water',
            'TerrainBlock': 'terrain'
        };

        return typeMap[torqueClass] || 'empty';
    }

    private parseVector(vectorStr: string): [number, number, number] {
        if (!vectorStr) return [0, 0, 0];

        // Remove quotes and split
        const cleanStr = vectorStr.replace(/^"|"$/g, '');
        const numbers = cleanStr.split(' ').map(Number);

        return [
            numbers[0] || 0,
            numbers[1] || 0,
            numbers[2] || 0
        ];
    }

    private mapProperties(props: Record<string, any>): Record<string, any> {
        const mapped: Record<string, any> = {};

        for (const [key, value] of Object.entries(props)) {
            // Map Torque3D property names to our format
            switch (key) {
                case 'material':
                    mapped.materialId = value;
                    break;
                case 'datablock':
                    mapped.assetId = value;
                    break;
                case 'collisionType':
                    mapped.collision = value;
                    break;
                default:
                    mapped[key] = value;
            }
        }

        return mapped;
    }
} 