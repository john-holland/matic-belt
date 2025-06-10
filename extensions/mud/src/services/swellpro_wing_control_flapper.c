#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <math.h>
#include "swellpro_flight.h"
#include "swellpro_bait.h"

// Wing Configuration
#define NUM_SECTIONS 8
#define BAIT_DROP_SECTIONS 4  // Number of sections with bait drop capability

// Flight Parameters
#define CRUISE_ALTITUDE 50.0
#define VTOL_ALTITUDE 10.0
#define BAIT_DROP_ALTITUDE 5.0
#define MAX_BANK_ANGLE 30.0
#define MIN_AIRSPEED 5.0

typedef struct {
    float position[3];
    float velocity[3];
    float attitude[3];  // Roll, Pitch, Yaw
    float altitude;
    float airspeed;
    bool isVtolMode;
    bool isBaitDropMode;
} FlightState;

typedef struct {
    int sectionId;
    float flapAngle;
    float ventOpen;
    float pocketDepth;
    bool hasBaitDrop;
    float baitLoad;
    bool baitReleased;
} WingSection;

// Global state
FlightState flightState;
WingSection sections[NUM_SECTIONS];
SwellproFlight* flightController;
SwellproBait* baitController;

// Initialize Swellpro controllers
void initializeControllers() {
    flightController = swellproFlightInit();
    baitController = swellproBaitInit();

    if (!flightController || !baitController) {
        printf("Failed to initialize Swellpro controllers\n");
        exit(1);
    }
}

// Update flight state from Swellpro
void updateFlightState() {
    SwellproFlightData flightData;
    swellproGetFlightData(flightController, &flightData);

    flightState.position[0] = flightData.position.x;
    flightState.position[1] = flightData.position.y;
    flightState.position[2] = flightData.position.z;
    flightState.velocity[0] = flightData.velocity.x;
    flightState.velocity[1] = flightData.velocity.y;
    flightState.velocity[2] = flightData.velocity.z;
    flightState.attitude[0] = flightData.attitude.roll;
    flightState.attitude[1] = flightData.attitude.pitch;
    flightState.attitude[2] = flightData.attitude.yaw;
    flightState.altitude = flightData.altitude;
    flightState.airspeed = flightData.airspeed;
}

// Calculate wing configuration based on flight mode
void calculateWingConfig() {
    if (flightState.isVtolMode) {
        // VTOL configuration
        for (int i = 0; i < NUM_SECTIONS; i++) {
            if (flightState.velocity[2] > 0) {
                // Ascending
                sections[i].flapAngle = -30.0;
                sections[i].ventOpen = 0.3;
                sections[i].pocketDepth = 0.0;
            } else {
                // Descending
                sections[i].flapAngle = 45.0;
                sections[i].ventOpen = 0.0;
                sections[i].pocketDepth = 0.15;
            }
        }
    } else if (flightState.isBaitDropMode) {
        // Bait drop configuration
        for (int i = 0; i < NUM_SECTIONS; i++) {
            if (sections[i].hasBaitDrop && !sections[i].baitReleased) {
                sections[i].flapAngle = 20.0;
                sections[i].ventOpen = 0.0;
                sections[i].pocketDepth = 0.0;
            } else {
                sections[i].flapAngle = 0.0;
                sections[i].ventOpen = 0.0;
                sections[i].pocketDepth = 0.0;
            }
        }
    } else {
        // Cruise configuration
        for (int i = 0; i < NUM_SECTIONS; i++) {
            sections[i].flapAngle = 0.0;
            sections[i].ventOpen = 0.0;
            sections[i].pocketDepth = 0.0;
        }
    }
}

// Execute bait drop sequence
void executeBaitDrop() {
    if (!flightState.isBaitDropMode) return;

    // Check altitude and airspeed
    if (flightState.altitude > BAIT_DROP_ALTITUDE || 
        flightState.airspeed < MIN_AIRSPEED) {
        return;
    }

    // Release bait from each section
    for (int i = 0; i < NUM_SECTIONS; i++) {
        if (sections[i].hasBaitDrop && !sections[i].baitReleased) {
            // Coordinate with Swellpro bait system
            SwellproBaitCommand cmd = {
                .sectionId = i,
                .action = BAIT_RELEASE,
                .amount = sections[i].baitLoad
            };
            
            if (swellproExecuteBaitCommand(baitController, &cmd) == 0) {
                sections[i].baitReleased = true;
                sections[i].baitLoad = 0.0;
            }
        }
    }
}

// Update flight mode based on conditions
void updateFlightMode() {
    // Check altitude for VTOL mode
    if (flightState.altitude < VTOL_ALTITUDE) {
        flightState.isVtolMode = true;
        flightState.isBaitDropMode = false;
    } else if (flightState.altitude > CRUISE_ALTITUDE) {
        flightState.isVtolMode = false;
        flightState.isBaitDropMode = false;
    }

    // Check bank angle for stability
    if (fabs(flightState.attitude[0]) > MAX_BANK_ANGLE) {
        // Correct bank angle
        SwellproFlightCommand cmd = {
            .type = FLIGHT_CORRECT_ATTITUDE,
            .roll = 0.0,
            .pitch = flightState.attitude[1],
            .yaw = flightState.attitude[2]
        };
        swellproExecuteFlightCommand(flightController, &cmd);
    }
}

// Main control loop
void controlLoop() {
    while (1) {
        // Update flight state
        updateFlightState();

        // Update flight mode
        updateFlightMode();

        // Calculate wing configuration
        calculateWingConfig();

        // Execute bait drop if in bait drop mode
        if (flightState.isBaitDropMode) {
            executeBaitDrop();
        }

        // Apply wing configuration to flight controller
        for (int i = 0; i < NUM_SECTIONS; i++) {
            SwellproWingCommand cmd = {
                .sectionId = i,
                .flapAngle = sections[i].flapAngle,
                .ventOpen = sections[i].ventOpen,
                .pocketDepth = sections[i].pocketDepth
            };
            swellproExecuteWingCommand(flightController, &cmd);
        }

        // Small delay for stability
        delay(20);
    }
}

int main() {
    // Initialize controllers
    initializeControllers();

    // Initialize wing sections
    for (int i = 0; i < NUM_SECTIONS; i++) {
        sections[i].sectionId = i;
        sections[i].flapAngle = 0.0;
        sections[i].ventOpen = 0.0;
        sections[i].pocketDepth = 0.0;
        sections[i].hasBaitDrop = (i < BAIT_DROP_SECTIONS);
        sections[i].baitLoad = sections[i].hasBaitDrop ? 1.0 : 0.0;
        sections[i].baitReleased = false;
    }

    // Start control loop
    controlLoop();

    return 0;
} 