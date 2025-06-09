import { AudioFeatures } from './analyzer';

export interface PhoneticInterpretation {
    syllables: string[];
    joyScore: number;
    dorsalStream: number[];
    ventralStream: number[];
}

export class RNNModel {
    constructor();
    predictPhonetics(
        messages: string[],
        features?: (AudioFeatures | undefined)[]
    ): Promise<PhoneticInterpretation>;
} 