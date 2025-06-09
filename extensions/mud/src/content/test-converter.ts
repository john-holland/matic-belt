import { Torque3DConverter } from './torque3d-converter';
import * as path from 'path';

async function testConverter() {
    // Initialize converter
    const converter = new Torque3DConverter(
        path.join(__dirname, '../../../torque3d-levels'),
        path.join(__dirname, '../../../assets/scenes')
    );

    try {
        // Convert ChinaTown level
        await converter.convertLevel(
            'data/FPSGameplay/fpstutorial/levels/ChinaTown_Day.mis',
            'data/FPSGameplay/fpstutorial/levels/ChinaTown_Dusk.asset.taml'
        );

        console.log('Level conversion completed successfully!');
    } catch (error) {
        console.error('Error converting level:', error);
    }
}

// Run the test
testConverter().catch(console.error); 