#include <stdio.h>
#include <stdlib.h>
#include "vtable.h"

// Define method indices
#define MAKE_SOUND_INDEX 0
#define MOVE_INDEX 1
#define WAG_TAIL_INDEX 2

// Define data structures
typedef struct {
    int age;
    char* name;
} AnimalData;

typedef struct {
    AnimalData base;
    int tailLength;
} DogData;

// Define base class
DEFINE_CLASS(Animal, Object, AnimalData);

// Define base class methods
DEFINE_METHOD(Animal, makeSound, void) {
    AnimalData* data = (AnimalData*)thisData;
    printf("Animal %s (age %d) makes a sound\n", data->name, data->age);
}

DEFINE_METHOD(Animal, move, void) {
    AnimalData* data = (AnimalData*)thisData;
    printf("Animal %s moves\n", data->name);
}

// Define derived class
DEFINE_CLASS(Dog, Animal, DogData);

// Define derived class methods
DEFINE_METHOD(Dog, makeSound, void) {
    DogData* data = (DogData*)thisData;
    printf("Dog %s (age %d) barks: Woof!\n", data->base.name, data->base.age);
}

DEFINE_METHOD(Dog, wagTail, void) {
    DogData* data = (DogData*)thisData;
    printf("Dog %s wags tail (length: %d cm) happily\n", 
           data->base.name, data->tailLength);
}

// Initialize classes
INIT_CLASS(Animal, Object,
    ADD_METHOD(Animal, makeSound),
    ADD_METHOD(Animal, move)
);

INIT_CLASS(Dog, Animal,
    ADD_METHOD(Dog, makeSound),
    ADD_METHOD(Dog, move),
    ADD_METHOD(Dog, wagTail)
);

int main() {
    // Create a dog instance with data
    DogData dogData = {
        .base = { .age = 5, .name = "Rex" },
        .tailLength = 30
    };
    
    Dog* dog = NEW_WITH_DATA(Dog, DogData, &dogData);
    if (!dog) {
        printf("Failed to create dog instance\n");
        return 1;
    }

    // Call methods
    printf("Testing dog methods:\n");
    CALL(dog, makeSound);
    CALL(dog, move);
    CALL(dog, wagTail);

    // Clean up
    DELETE(dog);

    return 0;
} 