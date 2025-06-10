export interface EnvironmentalData {
    temperature: number;
    humidity: number;
    pressure: number;
    magneticField: number;
    radiationLevel: number;
}

interface MaterialComposition {
    elements: Map<string, number>; // element -> percentage
    quantumSignature: string;
    stability: number;
}

interface CameraData {
    resolution: string;
    frameRate: number;
    quantumSensitivity: number;
    imageDescription?: string;
    detectedMaterials?: string[];
}

interface StabilityZone {
    id: string;
    name: string;
    environmentalData: EnvironmentalData;
    materialComposition: MaterialComposition;
    cameraData: CameraData;
    stabilityScore: number;
    lastUpdated: number;
}

export class StabilityZoneAnalyzer {
    private stabilityZones: Map<string, StabilityZone>;
    private readonly EARTH_BASELINE: EnvironmentalData;
    private readonly MATERIAL_PATTERNS: Map<string, string[]>;

    constructor() {
        this.stabilityZones = new Map();
        this.EARTH_BASELINE = {
            temperature: 293.15, // 20°C
            humidity: 0.5, // 50%
            pressure: 101325, // 1 atm
            magneticField: 25e-6, // 25 μT
            radiationLevel: 0.1 // 0.1 μSv/h
        };

        // Initialize material patterns for image description analysis
        this.MATERIAL_PATTERNS = new Map([
            ['hair', ['C', 'H', 'N', 'O', 'S']],
            ['skin', ['C', 'H', 'N', 'O', 'P', 'S', 'Na', 'K', 'Ca']],
            ['metal', ['Fe', 'Al', 'Cu', 'Zn', 'Ni']],
            ['wood', ['C', 'H', 'O', 'N']],
            ['plastic', ['C', 'H', 'O', 'Cl']],
            ['glass', ['Si', 'O', 'Na', 'Ca', 'Mg']]
        ]);
    }

    /**
     * Create a new stability zone
     */
    async createStabilityZone(
        name: string,
        environmentalData: Partial<EnvironmentalData>,
        cameraData: CameraData,
        customMaterials?: string[]
    ): Promise<StabilityZone> {
        // Merge with Earth baseline data
        const fullEnvironmentalData = {
            ...this.EARTH_BASELINE,
            ...environmentalData
        };

        // Analyze image description for materials
        const detectedMaterials = this.analyzeImageDescription(cameraData.imageDescription);
        
        // Combine with custom materials
        const allMaterials = [...new Set([
            ...(detectedMaterials || []),
            ...(customMaterials || [])
        ])];

        // Calculate material composition
        const materialComposition = await this.calculateMaterialComposition(allMaterials);

        // Calculate stability score
        const stabilityScore = this.calculateStabilityScore(
            fullEnvironmentalData,
            materialComposition,
            cameraData
        );

        const zone: StabilityZone = {
            id: `zone_${Date.now()}`,
            name,
            environmentalData: fullEnvironmentalData,
            materialComposition,
            cameraData,
            stabilityScore,
            lastUpdated: Date.now()
        };

        this.stabilityZones.set(zone.id, zone);
        return zone;
    }

    /**
     * Analyze image description for materials
     */
    private analyzeImageDescription(description?: string): string[] {
        if (!description) return [];

        const materials: string[] = [];
        for (const [pattern, elements] of this.MATERIAL_PATTERNS.entries()) {
            if (description.toLowerCase().includes(pattern)) {
                materials.push(...elements);
            }
        }
        return [...new Set(materials)];
    }

    /**
     * Calculate material composition from detected materials
     */
    async calculateMaterialComposition(materials: string[]): Promise<MaterialComposition> {
        const elementMap = new Map<string, number>();
        const totalElements = materials.length;

        // Calculate percentages
        materials.forEach(element => {
            const current = elementMap.get(element) || 0;
            elementMap.set(element, current + (1 / totalElements));
        });

        // Generate quantum signature
        const quantumSignature = this.generateQuantumSignature(elementMap);

        // Calculate stability
        const stability = this.calculateMaterialStability(elementMap);

        return {
            elements: elementMap,
            quantumSignature,
            stability
        };
    }

    /**
     * Generate quantum signature from material composition
     */
    private generateQuantumSignature(elements: Map<string, number>): string {
        const signature = Array.from(elements.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([element, percentage]) => `${element}_${percentage.toFixed(2)}`)
            .join('_');
        return `quantum_${signature}`;
    }

    /**
     * Calculate material stability
     */
    private calculateMaterialStability(elements: Map<string, number>): number {
        // Define stability factors for different elements
        const stabilityFactors = new Map([
            ['H', 0.8],
            ['He', 0.9],
            ['C', 0.7],
            ['N', 0.6],
            ['O', 0.7],
            ['Na', 0.5],
            ['Mg', 0.6],
            ['Al', 0.7],
            ['Si', 0.8],
            ['P', 0.5],
            ['S', 0.6],
            ['Cl', 0.4],
            ['K', 0.5],
            ['Ca', 0.6],
            ['Fe', 0.8],
            ['Ni', 0.7],
            ['Cu', 0.6],
            ['Zn', 0.5]
        ]);

        let totalStability = 0;
        let totalPercentage = 0;

        elements.forEach((percentage, element) => {
            const factor = stabilityFactors.get(element) || 0.5;
            totalStability += factor * percentage;
            totalPercentage += percentage;
        });

        return totalPercentage > 0 ? totalStability / totalPercentage : 0;
    }

    /**
     * Calculate overall stability score
     */
    private calculateStabilityScore(
        environmentalData: EnvironmentalData,
        materialComposition: MaterialComposition,
        cameraData: CameraData
    ): number {
        // Environmental stability (0-1)
        const envStability = this.calculateEnvironmentalStability(environmentalData);

        // Material stability (0-1)
        const matStability = materialComposition.stability;

        // Camera stability (0-1)
        const camStability = cameraData.quantumSensitivity;

        // Weighted average
        return (envStability * 0.4 + matStability * 0.4 + camStability * 0.2);
    }

    /**
     * Calculate environmental stability
     */
    private calculateEnvironmentalStability(data: EnvironmentalData): number {
        const tempFactor = 1 - Math.abs(data.temperature - this.EARTH_BASELINE.temperature) / 100;
        const humidityFactor = 1 - Math.abs(data.humidity - this.EARTH_BASELINE.humidity);
        const pressureFactor = 1 - Math.abs(data.pressure - this.EARTH_BASELINE.pressure) / 100000;
        const magneticFactor = 1 - Math.abs(data.magneticField - this.EARTH_BASELINE.magneticField) / 1e-5;
        const radiationFactor = 1 - Math.abs(data.radiationLevel - this.EARTH_BASELINE.radiationLevel);

        return (tempFactor + humidityFactor + pressureFactor + magneticFactor + radiationFactor) / 5;
    }

    /**
     * Get stability zone by ID
     */
    getStabilityZone(zoneId: string): StabilityZone | null {
        return this.stabilityZones.get(zoneId) || null;
    }

    /**
     * Update stability zone
     */
    async updateStabilityZone(
        zoneId: string,
        updates: Partial<StabilityZone>
    ): Promise<StabilityZone | null> {
        const zone = this.stabilityZones.get(zoneId);
        if (!zone) return null;

        const updatedZone = {
            ...zone,
            ...updates,
            lastUpdated: Date.now()
        };

        // Recalculate stability score if needed
        if (updates.environmentalData || updates.materialComposition || updates.cameraData) {
            updatedZone.stabilityScore = this.calculateStabilityScore(
                updatedZone.environmentalData,
                updatedZone.materialComposition,
                updatedZone.cameraData
            );
        }

        this.stabilityZones.set(zoneId, updatedZone);
        return updatedZone;
    }

    /**
     * List all stability zones
     */
    listStabilityZones(): StabilityZone[] {
        return Array.from(this.stabilityZones.values());
    }

    /**
     * Delete stability zone
     */
    deleteStabilityZone(zoneId: string): boolean {
        return this.stabilityZones.delete(zoneId);
    }
} 