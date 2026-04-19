import type OpenAI from 'openai';

export interface ZoneLlmAdvice {
    detectedMaterials: string[];
    hazards: string[];
    suggestedShielding: string;
    transmutationRisk: number;
    rationale: string;
    enrichedImageDescription?: string;
}

const SYSTEM = `You are a simulation assistant for fictional "quantum stability zones" in software.
Return ONLY valid JSON with keys: detectedMaterials (string[]), hazards (string[]), suggestedShielding (string),
transmutationRisk (number 0-1), rationale (string), enrichedImageDescription (optional string).
Materials should be chemical element symbols when possible (e.g. C, H, O, Fe). No medical or safety guarantees.`;

export class ZoneLlmAdvisor {
    constructor(private readonly openai: OpenAI | null) {}

    async adviseFromImageDescription(imageDescription: string): Promise<ZoneLlmAdvice | null> {
        if (!this.openai || !imageDescription.trim()) {
            return null;
        }
        try {
            const res = await this.openai.chat.completions.create({
                model: process.env.OPENAI_ZONE_MODEL || 'gpt-4o-mini',
                temperature: 0.2,
                max_tokens: 500,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: SYSTEM },
                    {
                        role: 'user',
                        content: `Camera / scene text (simulation): ${imageDescription.slice(0, 4000)}`
                    }
                ]
            });
            const raw = res.choices[0]?.message?.content;
            if (!raw) return null;
            const parsed = JSON.parse(raw) as ZoneLlmAdvice;
            return {
                detectedMaterials: Array.isArray(parsed.detectedMaterials) ? parsed.detectedMaterials : [],
                hazards: Array.isArray(parsed.hazards) ? parsed.hazards : [],
                suggestedShielding: String(parsed.suggestedShielding || 'standard_dampeners'),
                transmutationRisk: Math.max(0, Math.min(1, Number(parsed.transmutationRisk) || 0)),
                rationale: String(parsed.rationale || ''),
                enrichedImageDescription: parsed.enrichedImageDescription
            };
        } catch {
            return null;
        }
    }
}
