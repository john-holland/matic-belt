import { ObjectId } from 'mongodb';
import { GPSLocation, SensorData } from '../types';

interface SpatialNode {
    id: ObjectId;
    name: string;
    type: 'universe' | 'galaxy' | 'planet' | 'country' | 'state' | 'city' | 'street' | 'building' | 'room' | 'object' | 'zip';
    location?: GPSLocation;
    sensorData?: SensorData;
    description: {
        top?: string;
        right?: string;
        left?: string;
        bottom?: string;
        front?: string;
        back?: string;
    };
    children: SpatialNode[];
    metadata: {
        timestamp: Date;
        confidence: number;
        source: string;
    };
}

export class SpatialOctree {
    private root: SpatialNode;
    private mongoCollection: any; // MongoDB collection reference

    constructor(mongoCollection: any) {
        this.mongoCollection = mongoCollection;
        this.root = this.createNode('universe', 'universe');
    }

    private createNode(name: string, type: SpatialNode['type']): SpatialNode {
        return {
            id: new ObjectId(),
            name,
            type,
            children: [],
            description: {},
            metadata: {
                timestamp: new Date(),
                confidence: 1.0,
                source: 'system'
            }
        };
    }

    async addLocation(
        path: string[],
        location: GPSLocation,
        sensorData: SensorData,
        description: Partial<SpatialNode['description']>
    ): Promise<void> {
        let current = this.root;
        const pathCopy = [...path];

        // Navigate/create hierarchy
        while (pathCopy.length > 0) {
            const name = pathCopy.shift()!;
            let child = current.children.find(c => c.name === name);

            if (!child) {
                child = this.createNode(name, this.determineType(name));
                current.children.push(child);
            }

            current = child;
        }

        // Update leaf node with location and sensor data
        current.location = location;
        current.sensorData = sensorData;
        current.description = { ...current.description, ...description };
        current.metadata.timestamp = new Date();

        // Save to MongoDB
        await this.mongoCollection.updateOne(
            { _id: current.id },
            { $set: current },
            { upsert: true }
        );
    }

    private determineType(name: string): SpatialNode['type'] {
        // Simple type determination based on name patterns
        if (name.match(/^[A-Z][a-z]+$/)) return 'city';
        if (name.match(/^[A-Z]{2}$/)) return 'state';
        if (name.match(/^\d+$/)) return 'zip';
        if (name.match(/^[A-Z][a-z]+ Street$/)) return 'street';
        return 'object';
    }

    async queryByLocation(location: GPSLocation, radius: number): Promise<SpatialNode[]> {
        // Query MongoDB for nodes within radius of location
        return this.mongoCollection.find({
            'location': {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [location.longitude, location.latitude]
                    },
                    $maxDistance: radius
                }
            }
        }).toArray();
    }

    async getHierarchy(path: string[]): Promise<SpatialNode | null> {
        let current: SpatialNode | null = this.root;
        for (const name of path) {
            if (!current) return null;
            current = current.children.find(c => c.name === name) || null;
        }
        return current;
    }

    async updateDescription(
        path: string[],
        description: Partial<SpatialNode['description']>
    ): Promise<void> {
        const node = await this.getHierarchy(path);
        if (node) {
            node.description = { ...node.description, ...description };
            node.metadata.timestamp = new Date();
            await this.mongoCollection.updateOne(
                { _id: node.id },
                { $set: { description: node.description, metadata: node.metadata } }
            );
        }
    }

    async exportToYAML(): Promise<string> {
        const buildYAML = (node: SpatialNode, depth: number = 0): string => {
            const indent = '  '.repeat(depth);
            let yaml = `${indent}${node.name}:\n`;
            
            if (node.location) {
                yaml += `${indent}  location:\n`;
                yaml += `${indent}    lat: ${node.location.latitude}\n`;
                yaml += `${indent}    lon: ${node.location.longitude}\n`;
            }

            if (Object.keys(node.description).length > 0) {
                yaml += `${indent}  description:\n`;
                for (const [key, value] of Object.entries(node.description)) {
                    if (value) yaml += `${indent}    ${key}: "${value}"\n`;
                }
            }

            if (node.children.length > 0) {
                for (const child of node.children) {
                    yaml += buildYAML(child, depth + 1);
                }
            }

            return yaml;
        };

        return buildYAML(this.root);
    }
} 