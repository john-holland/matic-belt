import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { MemoryExaminer } from '../src';
import VRMemoryViewer from '../src/visualization/VRMemoryViewer';
import HoloLensMemoryViewer from '../src/visualization/HoloLensMemoryViewer';
import { MemoryRegion, MemoryPattern, Anomaly } from '../src/types';

const App: React.FC = () => {
    const [regions, setRegions] = useState<MemoryRegion[]>([]);
    const [patterns, setPatterns] = useState<MemoryPattern[]>([]);
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [selectedRegion, setSelectedRegion] = useState<MemoryRegion | null>(null);
    const [isHoloLens, setIsHoloLens] = useState(false);

    useEffect(() => {
        // Check if running on HoloLens
        if (navigator.xr) {
            navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
                setIsHoloLens(supported);
            });
        }

        // Initialize memory examiner
        const examiner = new MemoryExaminer();

        examiner.on('memoryUpdate', (newRegions: MemoryRegion[]) => {
            setRegions(newRegions);
        });

        examiner.on('analysis', (result) => {
            setPatterns(result.patterns);
            setAnomalies(result.anomalies);
        });

        examiner.start();

        return () => {
            examiner.stop();
        };
    }, []);

    const handleRegionSelect = (region: MemoryRegion) => {
        setSelectedRegion(region);
        console.log('Selected region:', region);
    };

    const handleAskMUD = () => {
        if (selectedRegion) {
            console.log('Asking MUD about region:', selectedRegion);
            // Implement MUD interaction here
        }
    };

    return (
        <div>
            {isHoloLens ? (
                <HoloLensMemoryViewer
                    regions={regions}
                    patterns={patterns}
                    anomalies={anomalies}
                    onRegionSelect={handleRegionSelect}
                    onAskMUD={handleAskMUD}
                />
            ) : (
                <VRMemoryViewer
                    regions={regions}
                    patterns={patterns}
                    anomalies={anomalies}
                    onRegionSelect={handleRegionSelect}
                    onAskMUD={handleAskMUD}
                />
            )}
        </div>
    );
};

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('root')
); 