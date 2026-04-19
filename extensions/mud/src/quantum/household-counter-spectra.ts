import { SpectrographicAnalyzer } from './spectrographic-analyzer';
import { runQuantumPython } from './quantum-python-runner';

/** Common household materials → element mass fractions (simulation KB). */
export const HOUSEHOLD_MATERIAL_ELEMENTS: Record<string, Record<string, number>> = {
    stainless_steel: { Fe: 0.7, Cr: 0.18, Ni: 0.1, Mn: 0.02 },
    plastic_hdpe: { C: 0.86, H: 0.14 },
    glass_soda_lime: { Si: 0.35, O: 0.45, Na: 0.08, Ca: 0.12 },
    wood_pine: { C: 0.5, H: 0.06, O: 0.43, N: 0.01 },
    cotton_fabric: { C: 0.45, H: 0.06, O: 0.49 },
    ceramic_glazed: { Si: 0.25, O: 0.45, Al: 0.15, Ca: 0.1, Na: 0.05 },
    salt_table: { Na: 0.39, Cl: 0.61 },
    baking_soda: { Na: 0.27, H: 0.02, C: 0.14, O: 0.57 },
    vinegar: { C: 0.4, H: 0.07, O: 0.53 },
    soil_garden: { Si: 0.28, O: 0.45, Al: 0.08, Ca: 0.05, Fe: 0.04, K: 0.03, Mg: 0.02, C: 0.05 },
    compost_organic: { C: 0.35, H: 0.05, O: 0.45, N: 0.08, P: 0.02, K: 0.05 },
    water: { H: 0.112, O: 0.888 }
};

export interface CounterSpectrumInput {
    spectrum: {
        timestamp: number;
        wavelength: number;
        intensity: number;
        elements: string[];
        anomalies: string[];
    };
    inventoryMaterials?: string[];
}

export class HouseholdCounterSpectra {
    constructor(private readonly spectro: SpectrographicAnalyzer) {}

    async recommend(input: CounterSpectrumInput): Promise<{
        recommendedHouseholdMix: { material: string; fraction: number }[];
        spectralResidual: number;
        notes: string[];
        anomalyReport: { hasAnomalies: boolean; anomalies: string[]; confidence: number };
    }> {
        const notes: string[] = ['simulation: not laboratory spectroscopy'];
        const anomalyReport = await this.spectro.analyzeSpectrography(input.spectrum);

        let inv: Record<string, Record<string, number>> =
            input.inventoryMaterials && input.inventoryMaterials.length
                ? Object.fromEntries(
                      input.inventoryMaterials
                          .filter((m) => HOUSEHOLD_MATERIAL_ELEMENTS[m])
                          .map((m) => [m, HOUSEHOLD_MATERIAL_ELEMENTS[m]])
                  )
                : { ...HOUSEHOLD_MATERIAL_ELEMENTS };
        if (Object.keys(inv).length === 0) {
            inv = { ...HOUSEHOLD_MATERIAL_ELEMENTS };
        }

        const elems = [...new Set(input.spectrum.elements)];
        if (elems.length === 0) {
            notes.push('no spectral elements; returning uniform small mix');
            return {
                recommendedHouseholdMix: [{ material: 'water', fraction: 1 }],
                spectralResidual: 1,
                notes,
                anomalyReport
            };
        }

        const targetFractions = elems.map(() => 1 / elems.length);
        const py = await runQuantumPython<{
            recommendedMix: { material: string; fraction: number }[];
            spectralResidual: number;
        }>({
            op: 'mixture_nnls',
            materials: inv,
            targetElements: elems,
            targetFractions
        });

        if (!py.ok || !py.result) {
            notes.push(`python nnls unavailable: ${py.error}`);
            return {
                recommendedHouseholdMix: [{ material: 'water', fraction: 1 }],
                spectralResidual: 1,
                notes,
                anomalyReport
            };
        }

        return {
            recommendedHouseholdMix: py.result.recommendedMix.map((m) => ({
                material: m.material,
                fraction: m.fraction
            })),
            spectralResidual: py.result.spectralResidual,
            notes,
            anomalyReport
        };
    }
}
