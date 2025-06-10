#ifndef VTABLE_H
#define VTABLE_H

#include <stddef.h>

// Function pointer types
typedef void* (*MethodPtr)(void* self, void* thisData, ...);
typedef void* (*ConstructorPtr)(void* self, void* thisData, ...);
typedef void (*DestructorPtr)(void* self, void* thisData);

// V-Table structure
typedef struct {
    const char* className;
    ConstructorPtr constructor;
    DestructorPtr destructor;
    MethodPtr* methods;
    size_t methodCount;
    void* thisData;  // Class-specific data pointer
} VTable;

// Base object structure
typedef struct {
    const VTable* vtable;
} Object;

// Macro to define a new class with templated data
#define DEFINE_CLASS(ClassName, ParentClass, DataType) \
    typedef struct { \
        ParentClass parent; \
        DataType* thisData; \
    } ClassName; \
    \
    static VTable ClassName##_vtable; \
    \
    static void* ClassName##_constructor(void* self, void* thisData, ...) { \
        ClassName* obj = (ClassName*)self; \
        obj->parent.vtable = &ClassName##_vtable; \
        obj->thisData = (DataType*)thisData; \
        obj->parent.vtable->thisData = thisData; \
        /* Initialize your class-specific members here */ \
        return obj; \
    } \
    \
    static void ClassName##_destructor(void* self, void* thisData) { \
        ClassName* obj = (ClassName*)self; \
        /* Clean up your class-specific members here */ \
    }

// Macro to define a method
#define DEFINE_METHOD(ClassName, MethodName, ReturnType, ...) \
    static ReturnType ClassName##_##MethodName(void* self, void* thisData, ##__VA_ARGS__); \
    \
    static ReturnType ClassName##_##MethodName(void* self, void* thisData, ##__VA_ARGS__)

// Macro to add a method to the V-Table
#define ADD_METHOD(ClassName, MethodName) \
    (MethodPtr)ClassName##_##MethodName

// Macro to initialize a class
#define INIT_CLASS(ClassName, ParentClassName, ...) \
    static MethodPtr ClassName##_methods[] = { \
        __VA_ARGS__ \
    }; \
    \
    static VTable ClassName##_vtable = { \
        .className = #ClassName, \
        .constructor = ClassName##_constructor, \
        .destructor = ClassName##_destructor, \
        .methods = ClassName##_methods, \
        .methodCount = sizeof(ClassName##_methods) / sizeof(MethodPtr), \
        .thisData = NULL \
    }

// Macro to create a new instance with data
#define NEW_WITH_DATA(ClassName, DataType, data) \
    ({ \
        ClassName* obj = (ClassName*)malloc(sizeof(ClassName)); \
        if (obj) { \
            ClassName##_constructor(obj, data); \
        } \
        obj; \
    })

// Macro to create a new instance without data
#define NEW(ClassName) \
    NEW_WITH_DATA(ClassName, void, NULL)

// Macro to delete an instance
#define DELETE(obj) \
    do { \
        if (obj) { \
            obj->vtable->destructor(obj, obj->vtable->thisData); \
            free(obj); \
        } \
    } while(0)

// Macro to call a method
#define CALL(obj, MethodName, ...) \
    ((obj)->vtable->methods[MethodName##_INDEX])(obj, (obj)->vtable->thisData, ##__VA_ARGS__)

// Example usage:
/*
// Define a data structure for a class
typedef struct {
    int age;
    char* name;
} AnimalData;

// Define a base class with data
DEFINE_CLASS(Animal, Object, AnimalData);
DEFINE_METHOD(Animal, makeSound, void);
DEFINE_METHOD(Animal, move, void);

// Define a derived class with its own data
typedef struct {
    AnimalData base;
    int tailLength;
} DogData;

DEFINE_CLASS(Dog, Animal, DogData);
DEFINE_METHOD(Dog, makeSound, void);
DEFINE_METHOD(Dog, wagTail, void);

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

// Create and use objects with data
DogData dogData = {
    .base = { .age = 5, .name = "Rex" },
    .tailLength = 30
};
Dog* dog = NEW_WITH_DATA(Dog, DogData, &dogData);
CALL(dog, makeSound);
CALL(dog, wagTail);
DELETE(dog);
*/

#endif // VTABLE_H 