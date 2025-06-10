#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <math.h>
#include "swellpro_flight.h"
#include "swellpro_bait.h"
#include "swellpro_wing_control.h"

// Glide Configuration
#define GLIDE_CONFIG {
    .ARM_ANGLE = 45.0,        // Degrees from vertical
    .WING_SPAN = 2.5,         // Meters
    .WING_CHORD = 0.4,        // Meters
    .ARM_LENGTH = 1.2,        // Meters
    .MIN_ALTITUDE = 100.0,    // Meters
    .GLIDE_RATIO = 15.0,      // L/D ratio
    .ROTOR_SPIN_DOWN = 2.0,   // Seconds
    .BAIT_TOGGLE_INTERVAL = 5.0 // Seconds
}

typedef struct {
    float armAngle;
    float wingDeployment;
    float currentAltitude;
    float targetAltitude;
    float glideSpeed;
    bool rotorsSpinning;
    bool baitActive;
    float lastBaitToggle;
} GlideState;

// Global state
GlideState glideState;
SwellproFlight* flightController;
SwellproBait* baitController;
SwellproWing* wingController;

// Initialize glide system
void initializeGlide() {
    flightController = swellproFlightInit();
    baitController = swellproBaitInit();
    wingController = swellproWingInit();

    if (!flightController || !baitController || !wingController) {
        printf("Failed to initialize glide system\n");
        exit(1);
    }

    // Initialize glide state
    glideState.armAngle = 0.0;
    glideState.wingDeployment = 0.0;
    glideState.currentAltitude = 0.0;
    glideState.targetAltitude = GLIDE_CONFIG.MIN_ALTITUDE;
    glideState.glideSpeed = 0.0;
    glideState.rotorsSpinning = true;
    glideState.baitActive = false;
    glideState.lastBaitToggle = 0.0;
}

// Deploy spider-plant style wing system
void deployWingSystem() {
    // Calculate required arm angle based on current conditions
    float targetArmAngle = GLIDE_CONFIG.ARM_ANGLE;
    float currentArmAngle = glideState.armAngle;

    // Smooth arm deployment
    while (fabs(currentArmAngle - targetArmAngle) > 0.1) {
        currentArmAngle += (targetArmAngle - currentArmAngle) * 0.1;
        
        // Update arm position
        SwellproArmCommand armCmd = {
            .angle = currentArmAngle,
            .speed = 0.5
        };
        swellproExecuteArmCommand(wingController, &armCmd);
        
        delay(20);
    }

    // Deploy wings
    float targetDeployment = 1.0;
    float currentDeployment = glideState.wingDeployment;

    while (fabs(currentDeployment - targetDeployment) > 0.1) {
        currentDeployment += (targetDeployment - currentDeployment) * 0.1;
        
        // Update wing deployment
        SwellproWingCommand wingCmd = {
            .deployment = currentDeployment,
            .flapAngle = 0.0,
            .ventOpen = 0.0,
            .pocketDepth = 0.0
        };
        swellproExecuteWingCommand(wingController, &wingCmd);
        
        delay(20);
    }
}

// Spin down rotors
void spinDownRotors() {
    if (!glideState.rotorsSpinning) return;

    // Gradually reduce rotor speed
    float currentSpeed = 1.0;
    float targetSpeed = 0.0;
    float spinDownTime = 0.0;

    while (spinDownTime < GLIDE_CONFIG.ROTOR_SPIN_DOWN) {
        currentSpeed = 1.0 - (spinDownTime / GLIDE_CONFIG.ROTOR_SPIN_DOWN);
        
        // Update rotor speed
        SwellproRotorCommand rotorCmd = {
            .speed = currentSpeed,
            .mode = ROTOR_GLIDE
        };
        swellproExecuteRotorCommand(flightController, &rotorCmd);
        
        spinDownTime += 0.02;
        delay(20);
    }

    glideState.rotorsSpinning = false;
}

// Toggle bait system
void toggleBaitSystem() {
    float currentTime = swellproGetTime();
    
    if (currentTime - glideState.lastBaitToggle >= GLIDE_CONFIG.BAIT_TOGGLE_INTERVAL) {
        glideState.baitActive = !glideState.baitActive;
        
        // Update bait system
        SwellproBaitCommand baitCmd = {
            .action = glideState.baitActive ? BAIT_ACTIVATE : BAIT_DEACTIVATE,
            .amount = 0.0
        };
        swellproExecuteBaitCommand(baitController, &baitCmd);
        
        glideState.lastBaitToggle = currentTime;
    }
}

// Calculate glide parameters
void calculateGlideParameters() {
    // Calculate optimal glide speed
    float sinkRate = glideState.currentAltitude / GLIDE_CONFIG.GLIDE_RATIO;
    glideState.glideSpeed = sqrt(2 * 9.81 * sinkRate);

    // Update flight controller
    SwellproFlightCommand flightCmd = {
        .type = FLIGHT_GLIDE,
        .speed = glideState.glideSpeed,
        .heading = 0.0, // Maintain current heading
        .altitude = glideState.targetAltitude
    };
    swellproExecuteFlightCommand(flightController, &flightCmd);
}

// Main glide control loop
void glideControlLoop() {
    // Deploy wing system
    deployWingSystem();

    // Spin down rotors
    spinDownRotors();

    while (1) {
        // Update current altitude
        SwellproFlightData flightData;
        swellproGetFlightData(flightController, &flightData);
        glideState.currentAltitude = flightData.altitude;

        // Check if we need to exit glide mode
        if (glideState.currentAltitude < GLIDE_CONFIG.MIN_ALTITUDE * 0.5) {
            // Restart rotors and retract wings
            SwellproRotorCommand rotorCmd = {
                .speed = 1.0,
                .mode = ROTOR_NORMAL
            };
            swellproExecuteRotorCommand(flightController, &rotorCmd);
            glideState.rotorsSpinning = true;

            // Retract wings
            SwellproWingCommand wingCmd = {
                .deployment = 0.0,
                .flapAngle = 0.0,
                .ventOpen = 0.0,
                .pocketDepth = 0.0
            };
            swellproExecuteWingCommand(wingController, &wingCmd);

            break;
        }

        // Toggle bait system
        toggleBaitSystem();

        // Update glide parameters
        calculateGlideParameters();

        // Small delay for stability
        delay(20);
    }
}

int main() {
    // Initialize glide system
    initializeGlide();

    // Start glide control loop
    glideControlLoop();

    return 0;
} 