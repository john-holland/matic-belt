import { GPSLocation, SensorData, ObjectDescription } from '../types';
import { SpatialOctree } from '../spatial/SpatialOctree';

export class SensorDataCollector {
    private spatialOctree: SpatialOctree;
    private currentLocation: GPSLocation | null = null;
    private sensorData: SensorData | null = null;

    constructor(spatialOctree: SpatialOctree) {
        this.spatialOctree = spatialOctree;
        this.initializeSensors();
    }

    private async initializeSensors(): Promise<void> {
        if (navigator.geolocation) {
            navigator.geolocation.watchPosition(
                this.handleLocationUpdate.bind(this),
                this.handleLocationError.bind(this),
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 5000
                }
            );
        }

        // Initialize other sensors if available
        if ('AmbientLightSensor' in window) {
            // @ts-ignore
            const lightSensor = new AmbientLightSensor();
            lightSensor.addEventListener('reading', () => {
                this.updateSensorData({ light: lightSensor.illuminance });
            });
            lightSensor.start();
        }

        // Add more sensor initializations as needed
    }

    private handleLocationUpdate(position: GeolocationPosition): void {
        this.currentLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude || undefined,
            accuracy: position.coords.accuracy || undefined,
            timestamp: new Date(position.timestamp)
        };

        this.updateSpatialData();
    }

    private handleLocationError(error: GeolocationPositionError): void {
        console.error('Error getting location:', error);
    }

    private updateSensorData(data: Partial<SensorData>): void {
        this.sensorData = {
            ...this.sensorData,
            ...data,
            timestamp: new Date(),
            deviceId: 'default-device' // Replace with actual device ID
        } as SensorData;

        this.updateSpatialData();
    }

    private async updateSpatialData(): Promise<void> {
        if (!this.currentLocation || !this.sensorData) return;

        // Get current location hierarchy (e.g., ["USA", "MA", "Boston", "Summer St"])
        const locationHierarchy = await this.getLocationHierarchy(this.currentLocation);

        // Add or update spatial data
        await this.spatialOctree.addLocation(
            locationHierarchy,
            this.currentLocation,
            this.sensorData,
            {} // Empty description as it will be updated by object recognition
        );
    }

    private async getLocationHierarchy(location: GPSLocation): Promise<string[]> {
        // This would typically call a geocoding service to get the full hierarchy
        // For now, return a mock hierarchy
        return ['USA', 'MA', 'Boston', 'Summer St'];
    }

    public async addObjectDescription(
        path: string[],
        description: Partial<ObjectDescription>
    ): Promise<void> {
        await this.spatialOctree.updateDescription(path, description);
    }

    public async getCurrentLocationData(): Promise<{
        location: GPSLocation;
        sensorData: SensorData;
        hierarchy: string[];
    } | null> {
        if (!this.currentLocation || !this.sensorData) return null;

        const hierarchy = await this.getLocationHierarchy(this.currentLocation);
        return {
            location: this.currentLocation,
            sensorData: this.sensorData,
            hierarchy
        };
    }
} 