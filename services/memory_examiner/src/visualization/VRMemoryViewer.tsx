import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { VRButton, XR, Controllers, useXR } from '@react-three/xr';
import { OrbitControls } from '@react-three/drei';
import { MemoryRegion, MemoryPattern, Anomaly } from '../types';
import { QuadTree } from '../quadTree';

interface VRMemoryViewerProps {
    regions: MemoryRegion[];
    patterns: MemoryPattern[];
    anomalies: Anomaly[];
    onRegionSelect: (region: MemoryRegion) => void;
    onAskMUD: () => void;
}

const MemoryRegionMesh: React.FC<{
    region: MemoryRegion;
    onClick: () => void;
}> = ({ region, onClick }) => {
    const color = region.type === 'code' ? '#ff0000' : 
                 region.type === 'data' ? '#00ff00' :
                 region.type === 'heap' ? '#0000ff' : '#ffff00';

    return (
        <mesh
            position={[region.address / 1e9, 0, 0]}
            scale={[region.size / 1e6, 1, 1]}
            onClick={onClick}
        >
            <boxGeometry />
            <meshStandardMaterial color={color} />
        </mesh>
    );
};

const VRMemoryViewer: React.FC<VRMemoryViewerProps> = ({
    regions,
    patterns,
    anomalies,
    onRegionSelect,
    onAskMUD
}) => {
    const { player } = useXR();
    const [selectedRegion, setSelectedRegion] = useState<MemoryRegion | null>(null);
    const quadTree = useRef(new QuadTree());

    useEffect(() => {
        quadTree.current.update(regions);
    }, [regions]);

    const handleRegionClick = (region: MemoryRegion) => {
        setSelectedRegion(region);
        onRegionSelect(region);
    };

    const handleAskMUD = () => {
        onAskMUD();
    };

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <VRButton />
            <Canvas>
                <XR>
                    <ambientLight intensity={0.5} />
                    <pointLight position={[10, 10, 10]} />
                    <Controllers />
                    <OrbitControls />

                    {/* Memory Regions */}
                    {regions.map((region, index) => (
                        <MemoryRegionMesh
                            key={index}
                            region={region}
                            onClick={() => handleRegionClick(region)}
                        />
                    ))}

                    {/* MUD Button */}
                    <mesh
                        position={[0, 2, -2]}
                        onClick={handleAskMUD}
                    >
                        <boxGeometry args={[1, 0.5, 0.1]} />
                        <meshStandardMaterial color="#4CAF50" />
                    </mesh>

                    {/* Selected Region Info */}
                    {selectedRegion && (
                        <mesh position={[0, 2, 0]}>
                            <textGeometry
                                args={[
                                    `Selected: ${selectedRegion.type}\nSize: ${selectedRegion.size}`,
                                    { size: 0.1, height: 0.1 }
                                ]}
                            />
                            <meshStandardMaterial color="white" />
                        </mesh>
                    )}
                </XR>
            </Canvas>
        </div>
    );
};

export default VRMemoryViewer; 