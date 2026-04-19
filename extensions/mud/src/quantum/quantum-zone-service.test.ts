import { QuantumZoneService, DEFAULT_FIELD_STABILIZATION } from './quantum-zone-service';
import { listStableElementSymbols } from './stable-element-table';

describe('QuantumZoneService', () => {
    it('uses default fieldStabilization false', () => {
        expect(DEFAULT_FIELD_STABILIZATION).toBe(false);
    });

    it('rejects assertFieldStabilized when flag false', async () => {
        const svc = new QuantumZoneService(null);
        const zone = await svc.createZone({
            name: 'test',
            galacticPosition: { systemId: 'sol' },
            gps: { lat: 0, lon: 0, alt_m: 0, body: 'earth' },
            cameraData: { resolution: '1080p', frameRate: 30, quantumSensitivity: 0.9 }
        });
        expect(zone.fieldStabilization).toBe(false);
        const gate = svc.assertFieldStabilized(zone.id);
        expect(gate.ok).toBe(false);
        if (!gate.ok) {
            expect(gate.message).toContain('fieldStabilization');
        }
    });

    it('allows assertFieldStabilized when true', async () => {
        const svc = new QuantumZoneService(null);
        const zone = await svc.createZone({
            name: 'st',
            fieldStabilization: true,
            galacticPosition: { systemId: 'sol' },
            gps: { lat: 1, lon: 2, alt_m: 3, body: 'mars' },
            cameraData: { resolution: '1080p', frameRate: 30, quantumSensitivity: 0.9 }
        });
        const gate = svc.assertFieldStabilized(zone.id);
        expect(gate.ok).toBe(true);
    });
});

describe('stable element table', () => {
    it('excludes technetium and promethium', () => {
        const s = listStableElementSymbols();
        expect(s).not.toContain('Tc');
        expect(s).not.toContain('Pm');
        expect(s).toContain('Pb');
        expect(s).toContain('H');
    });
});
