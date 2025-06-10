#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <wiringPi.h>
#include <softPwm.h>
#include <math.h>

// GPIO Pin Definitions
#define FLAP_SERVO_BASE 18  // PWM pin for flap servos
#define VENT_SERVO_BASE 23  // PWM pin for vent servos
#define POCKET_SERVO_BASE 24 // PWM pin for pocket servos
#define NUM_SECTIONS 8

// Servo Configuration
#define SERVO_MIN_PULSE 500
#define SERVO_MAX_PULSE 2500
#define SERVO_FREQ 50

// Sensor Pins
#define PRESSURE_SENSOR 17
#define ACCELEROMETER_X 27
#define ACCELEROMETER_Y 22
#define ACCELEROMETER_Z 4

typedef struct {
    float position[3];
    float velocity[3];
    float angle;
    bool isVtolMode;
    int flapStates[NUM_SECTIONS];
    int ventStates[NUM_SECTIONS];
    int pocketStates[NUM_SECTIONS];
} WingState;

typedef struct {
    int servoPin;
    int currentAngle;
    int targetAngle;
    float springForce;
    float dampingForce;
} WingSection;

// Global state
WingState wingState;
WingSection sections[NUM_SECTIONS];

// Initialize GPIO and PWM
void initializeGPIO() {
    if (wiringPiSetupGpio() == -1) {
        printf("Failed to initialize WiringPi\n");
        exit(1);
    }

    // Initialize PWM for all servos
    for (int i = 0; i < NUM_SECTIONS; i++) {
        softPwmCreate(FLAP_SERVO_BASE + i, 0, 100);
        softPwmCreate(VENT_SERVO_BASE + i, 0, 100);
        softPwmCreate(POCKET_SERVO_BASE + i, 0, 100);
    }

    // Initialize sensor pins
    pinMode(PRESSURE_SENSOR, INPUT);
    pinMode(ACCELEROMETER_X, INPUT);
    pinMode(ACCELEROMETER_Y, INPUT);
    pinMode(ACCELEROMETER_Z, INPUT);
}

// Convert angle to PWM value
int angleToPWM(float angle) {
    return (int)((angle + 90) * (SERVO_MAX_PULSE - SERVO_MIN_PULSE) / 180 + SERVO_MIN_PULSE);
}

// Update servo position
void updateServo(int pin, float angle) {
    int pwm = angleToPWM(angle);
    softPwmWrite(pin, pwm);
}

// Read pressure sensor
float readPressure() {
    return analogRead(PRESSURE_SENSOR) / 1023.0;
}

// Read accelerometer
void readAccelerometer(float* x, float* y, float* z) {
    *x = analogRead(ACCELEROMETER_X) / 1023.0;
    *y = analogRead(ACCELEROMETER_Y) / 1023.0;
    *z = analogRead(ACCELEROMETER_Z) / 1023.0;
}

// Calculate required forces
void calculateForces(WingSection* section, float pressure, float accel[3]) {
    // Spring force calculation
    section->springForce = 5000.0 * (section->targetAngle - section->currentAngle);

    // Damping force calculation
    section->dampingForce = 100.0 * (section->targetAngle - section->currentAngle);

    // Add pressure and acceleration effects
    section->springForce += pressure * 1000.0;
    section->springForce += accel[2] * 500.0; // Vertical acceleration effect
}

// Update wing section
void updateSection(WingSection* section, int index) {
    // Calculate net force
    float netForce = section->springForce + section->dampingForce;

    // Update servo positions
    updateServo(FLAP_SERVO_BASE + index, section->currentAngle);
    updateServo(VENT_SERVO_BASE + index, section->ventOpen);
    updateServo(POCKET_SERVO_BASE + index, section->pocketDepth);

    // Update section state
    section->currentAngle += netForce * 0.01; // Scale factor for smooth movement
    section->currentAngle = fmaxf(-45, fminf(60, section->currentAngle));
}

// Main control loop
void controlLoop() {
    float pressure;
    float accel[3];

    while (1) {
        // Read sensors
        pressure = readPressure();
        readAccelerometer(&accel[0], &accel[1], &accel[2]);

        // Update each section
        for (int i = 0; i < NUM_SECTIONS; i++) {
            calculateForces(&sections[i], pressure, accel);
            updateSection(&sections[i], i);
        }

        // Small delay for stability
        delay(20);
    }
}

int main() {
    // Initialize system
    initializeGPIO();

    // Initialize wing sections
    for (int i = 0; i < NUM_SECTIONS; i++) {
        sections[i].servoPin = FLAP_SERVO_BASE + i;
        sections[i].currentAngle = 0;
        sections[i].targetAngle = 0;
        sections[i].springForce = 0;
        sections[i].dampingForce = 0;
    }

    // Start control loop
    controlLoop();

    return 0;
} 