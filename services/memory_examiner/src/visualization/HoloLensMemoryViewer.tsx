import React, { useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { XR, Controllers, useXR, Hands } from '@react-three/xr';
import { OrbitControls } from '@react-three/drei';
import { MemoryRegion, MemoryPattern, Anomaly } from '../types';
import VRMemoryViewer from './VRMemoryViewer';

interface HoloLensMemoryViewerProps {
    regions: MemoryRegion[];
    patterns: MemoryPattern[];
    anomalies: Anomaly[];
    onRegionSelect: (region: MemoryRegion) => void;
    onAskMUD: () => void;
}

const HoloLensMemoryViewer: React.FC<HoloLensMemoryViewerProps> = (props) => {
    const { player } = useXR();
    const handRef = useRef<THREE.Group>(null);

    useEffect(() => {
        // HoloLens-specific initialization
        if (navigator.xr) {
            navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
                if (supported) {
                    console.log('HoloLens AR supported');
                }
            });
        }
    }, []);

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <Canvas>
                <XR>
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} />
                    <Controllers />
                    <Hands />
                    <OrbitControls />

                    {/* Extend VRMemoryViewer with HoloLens-specific features */}
                    <VRMemoryViewer {...props} />

                    {/* HoloLens-specific UI elements */}
                    <mesh position={[0, 1.5, -1]}>
                        <textGeometry
                            args={[
                                'HoloLens Memory Viewer',
                                { size: 0.1, height: 0.1 }
                            ]}
                        />
                        <meshStandardMaterial color="white" />
                    </mesh>

                    {/* Air tap gesture indicator */}
                    <mesh position={[0, 1.2, -1]}>
                        <textGeometry
                            args={[
                                'Air tap to select memory regions',
                                { size: 0.05, height: 0.05 }
                            ]}
                        />
                        <meshStandardMaterial color="white" />
                    </mesh>
                </XR>
            </Canvas>
        </div>
    );
};

export default HoloLensMemoryViewer; 