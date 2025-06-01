interface Point {
    x: number;
    y: number;
}

interface Line {
    slope: number;
    intercept: number;
    confidence: number;
    period: number;
    correlation: number;
}

export class HoughTransform {
    private thetaStep: number = Math.PI / 180; // 1 degree in radians
    private rhoStep: number = 0.01;
    private threshold: number = 0.5;

    public detectLines(points: Point[]): Line[] {
        if (points.length < 2) {
            return [];
        }

        // Calculate the range of rho values
        const maxRho = Math.sqrt(2); // Maximum possible distance from origin
        const rhoRange = Math.ceil(2 * maxRho / this.rhoStep);
        const thetaRange = Math.ceil(Math.PI / this.thetaStep);

        // Initialize accumulator
        const accumulator = new Array(rhoRange).fill(0).map(() => 
            new Array(thetaRange).fill(0)
        );

        // Fill accumulator
        points.forEach(point => {
            for (let thetaIndex = 0; thetaIndex < thetaRange; thetaIndex++) {
                const theta = thetaIndex * this.thetaStep;
                const rho = point.x * Math.cos(theta) + point.y * Math.sin(theta);
                const rhoIndex = Math.round((rho + maxRho) / this.rhoStep);
                
                if (rhoIndex >= 0 && rhoIndex < rhoRange) {
                    accumulator[rhoIndex][thetaIndex]++;
                }
            }
        });

        // Find peaks in accumulator
        const peaks = this.findPeaks(accumulator);
        
        // Convert peaks to lines
        return peaks.map(peak => {
            const theta = peak.thetaIndex * this.thetaStep;
            const rho = (peak.rhoIndex * this.rhoStep) - maxRho;
            
            // Convert from polar to slope-intercept form
            const slope = -Math.cos(theta) / Math.sin(theta);
            const intercept = rho / Math.sin(theta);

            // Calculate confidence based on number of points
            const confidence = peak.value / points.length;

            // Calculate period and correlation
            const period = this.calculatePeriod(points, slope, intercept);
            const correlation = this.calculateCorrelation(points, slope, intercept);

            return {
                slope,
                intercept,
                confidence,
                period,
                correlation
            };
        });
    }

    private findPeaks(accumulator: number[][]): Array<{rhoIndex: number, thetaIndex: number, value: number}> {
        const peaks: Array<{rhoIndex: number, thetaIndex: number, value: number}> = [];
        const threshold = Math.max(...accumulator.flat()) * this.threshold;

        for (let rhoIndex = 1; rhoIndex < accumulator.length - 1; rhoIndex++) {
            for (let thetaIndex = 1; thetaIndex < accumulator[0].length - 1; thetaIndex++) {
                const value = accumulator[rhoIndex][thetaIndex];
                
                if (value > threshold) {
                    // Check if it's a local maximum
                    const isPeak = this.isLocalMaximum(accumulator, rhoIndex, thetaIndex);
                    if (isPeak) {
                        peaks.push({ rhoIndex, thetaIndex, value });
                    }
                }
            }
        }

        // Sort peaks by value
        return peaks.sort((a, b) => b.value - a.value);
    }

    private isLocalMaximum(accumulator: number[][], rhoIndex: number, thetaIndex: number): boolean {
        const value = accumulator[rhoIndex][thetaIndex];
        
        // Check 8-connected neighborhood
        for (let dr = -1; dr <= 1; dr++) {
            for (let dt = -1; dt <= 1; dt++) {
                if (dr === 0 && dt === 0) continue;
                
                const newRhoIndex = rhoIndex + dr;
                const newThetaIndex = thetaIndex + dt;
                
                if (newRhoIndex >= 0 && newRhoIndex < accumulator.length &&
                    newThetaIndex >= 0 && newThetaIndex < accumulator[0].length) {
                    if (accumulator[newRhoIndex][newThetaIndex] >= value) {
                        return false;
                    }
                }
            }
        }
        
        return true;
    }

    private calculatePeriod(points: Point[], slope: number, intercept: number): number {
        // Project points onto the line
        const projections = points.map(point => {
            const x = point.x;
            const y = point.y;
            const projectedX = (x + slope * (y - intercept)) / (1 + slope * slope);
            const projectedY = slope * projectedX + intercept;
            return Math.sqrt(
                Math.pow(projectedX - x, 2) + 
                Math.pow(projectedY - y, 2)
            );
        });

        // Calculate autocorrelation
        const autocorr = this.autocorrelation(projections);
        
        // Find first peak after zero
        for (let i = 1; i < autocorr.length; i++) {
            if (autocorr[i] > autocorr[i-1] && autocorr[i] > autocorr[i+1]) {
                return i;
            }
        }
        
        return 0;
    }

    private calculateCorrelation(points: Point[], slope: number, intercept: number): number {
        // Calculate distances from points to line
        const distances = points.map(point => {
            const x = point.x;
            const y = point.y;
            return Math.abs(slope * x - y + intercept) / Math.sqrt(slope * slope + 1);
        });

        // Calculate mean distance
        const meanDistance = distances.reduce((a, b) => a + b) / distances.length;

        // Calculate correlation coefficient
        const numerator = distances.reduce((sum, d) => 
            sum + (d - meanDistance) * (d - meanDistance), 0);
        
        const denominator = distances.reduce((sum, d) => 
            sum + Math.pow(d - meanDistance, 2), 0);

        return denominator === 0 ? 0 : 1 - (numerator / denominator);
    }

    private autocorrelation(values: number[]): number[] {
        const n = values.length;
        const result: number[] = [];
        
        for (let lag = 0; lag < n; lag++) {
            let sum = 0;
            for (let i = 0; i < n - lag; i++) {
                sum += values[i] * values[i + lag];
            }
            result.push(sum / (n - lag));
        }
        
        return result;
    }
} 