import { Vector3, Ray, Plane, Intersection } from 'three';
import { EventEmitter } from 'events';

export interface Quad {
    position: Vector3;
    normal: Vector3;
    size: Vector3;
    specularity: number;
}

export interface RayTraceResult {
    intersection: Vector3;
    normal: Vector3;
    distance: number;
    quad: Quad;
}

export class LightInterpolator extends EventEmitter {
    private quads: Map<string, Quad>;
    private readonly MAX_RAY_DISTANCE = 100;
    private readonly SPECULAR_THRESHOLD = 0.7;
    private enabled: boolean;
    private lightIntensity: number;

    constructor() {
        super();
        this.quads = new Map();
        this.enabled = false;
        this.lightIntensity = 0;
    }

    public toggle(enabled: boolean): void {
        this.enabled = enabled;
        if (enabled) {
            this.startInterpolation();
        } else {
            this.stopInterpolation();
        }
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public addQuad(position: Vector3, normal: Vector3, size: Vector3, specularity: number): void {
        const key = this.getQuadKey(position);
        this.quads.set(key, { position, normal, size, specularity });
    }

    public removeQuad(position: Vector3): void {
        const key = this.getQuadKey(position);
        this.quads.delete(key);
    }

    public getInterpolatedLight(position: Vector3, direction: Vector3): number {
        if (!this.enabled) return 0;

        const rayTraceResults = this.traceRays(position, direction);
        return this.calculateLightIntensity(rayTraceResults);
    }

    private startInterpolation(): void {
        // Start the light interpolation process
        this.lightIntensity = 0;
        this.emit('lightIntensityChanged', this.lightIntensity);
    }

    private stopInterpolation(): void {
        // Stop the light interpolation process
        this.lightIntensity = 0;
        this.emit('lightIntensityChanged', this.lightIntensity);
    }

    private getQuadKey(position: Vector3): string {
        return `${position.x.toFixed(2)},${position.y.toFixed(2)},${position.z.toFixed(2)}`;
    }

    private traceRays(position: Vector3, direction: Vector3): RayTraceResult[] {
        const results: RayTraceResult[] = [];
        const numRays = 5; // Number of rays to trace for interpolation

        for (let i = 0; i < numRays; i++) {
            const rayDirection = this.getRayDirection(direction, i);
            const result = this.traceRay(position, rayDirection);
            if (result) {
                results.push(result);
            }
        }

        return results;
    }

    private getRayDirection(baseDirection: Vector3, index: number): Vector3 {
        // Create a slightly different direction for each ray
        const angle = (index / 5) * Math.PI / 4; // Spread rays in a cone
        const rotationAxis = new Vector3(0, 1, 0);
        return baseDirection.clone().applyAxisAngle(rotationAxis, angle);
    }

    private traceRay(origin: Vector3, direction: Vector3): RayTraceResult | null {
        let closestIntersection: RayTraceResult | null = null;
        let minDistance = Infinity;

        for (const quad of this.quads.values()) {
            const intersection = this.rayQuadIntersection(origin, direction, quad);
            if (intersection && intersection.distance < minDistance) {
                minDistance = intersection.distance;
                closestIntersection = intersection;
            }
        }

        return closestIntersection;
    }

    private rayQuadIntersection(origin: Vector3, direction: Vector3, quad: Quad): RayTraceResult | null {
        // Ray-plane intersection
        const denom = direction.dot(quad.normal);
        if (Math.abs(denom) < 1e-6) return null; // Ray is parallel to plane

        const t = quad.position.clone().sub(origin).dot(quad.normal) / denom;
        if (t < 0) return null; // Intersection is behind ray origin

        const intersection = origin.clone().add(direction.clone().multiplyScalar(t));

        // Check if intersection is within quad bounds
        const localPoint = intersection.clone().sub(quad.position);
        const halfSize = quad.size.clone().multiplyScalar(0.5);

        if (Math.abs(localPoint.x) > halfSize.x || 
            Math.abs(localPoint.y) > halfSize.y || 
            Math.abs(localPoint.z) > halfSize.z) {
            return null;
        }

        return {
            intersection,
            normal: quad.normal,
            distance: t,
            quad
        };
    }

    private calculateLightIntensity(results: RayTraceResult[]): number {
        if (results.length === 0) return 0;

        let totalIntensity = 0;
        for (const result of results) {
            const specularReflection = this.calculateSpecularReflection(result);
            totalIntensity += specularReflection;
        }

        const averageIntensity = totalIntensity / results.length;
        this.lightIntensity = averageIntensity;
        this.emit('lightIntensityChanged', this.lightIntensity);
        return averageIntensity;
    }

    private calculateSpecularReflection(result: RayTraceResult): number {
        const { normal, quad } = result;
        const reflection = this.calculateReflection(normal);
        return reflection * quad.specularity;
    }

    private calculateReflection(normal: Vector3): number {
        // Simple reflection calculation
        return Math.max(0, normal.y); // Assume light comes from above
    }
} 