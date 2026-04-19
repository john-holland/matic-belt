import type { CameraData, EnvironmentalData } from './stability-zone-analyzer';

export interface GalacticPosition {
    ra_deg?: number;
    dec_deg?: number;
    distance_ly?: number;
    systemId?: string;
}

export type PlanetaryBody = 'earth' | 'mars' | 'custom';

export interface PlanetaryGps {
    lat: number;
    lon: number;
    alt_m: number;
    body: PlanetaryBody;
    planetRadius_m?: number;
}

export interface LocalBoundsEnu {
    east_m: number;
    north_m: number;
    up_m: number;
}

export interface TransmutationVolume {
    id: string;
    anchorRelativeToZoneCenter: boolean;
    localMin_m: LocalBoundsEnu;
    localMax_m: LocalBoundsEnu;
    allowedOperations: Array<'organic_to_fruit' | 'soil_enrich' | 'organic_to_meat'>;
    maxPower: number;
    minStability: number;
    shieldingModel: 'standard_dampeners' | 'enhanced' | 'minimal';
}

export interface ProximityEntity {
    id?: string;
    kind: 'human' | 'animal';
    distance_m: number;
    azimuth_deg?: number;
    weight_kg?: number;
    bmi?: number;
    /** Optional explicit mass fractions by element symbol (simulation). */
    customElementalMassFraction?: Record<string, number>;
}

export interface QuantumZoneRecord {
    id: string;
    name: string;
    fieldStabilization: boolean;
    galacticPosition: GalacticPosition;
    gps: PlanetaryGps;
    /** Optional safety envelope radius (m) around zone GPS center for proximity checks. */
    safetyRadius_m?: number;
    environmentalData: EnvironmentalData;
    cameraData: CameraData;
    stabilityScore: number;
    transmutationVolumes: TransmutationVolume[];
    proximityEntities: ProximityEntity[];
    lastUpdated: number;
    llmNotes?: string;
}

export interface CreateQuantumZoneBody {
    name: string;
    fieldStabilization?: boolean;
    galacticPosition: GalacticPosition;
    gps: PlanetaryGps;
    safetyRadius_m?: number;
    environmentalData?: Partial<EnvironmentalData>;
    cameraData: CameraData;
    customMaterials?: string[];
    proximityEntities?: ProximityEntity[];
    useLlmForCamera?: boolean;
}
