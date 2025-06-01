# Memory Examiner Runbook

## Overview
This runbook provides instructions for building, testing, and running the Memory Examiner service, which includes memory monitoring, pattern recognition, and visualization components.

## Prerequisites
- Node.js (v16 or higher)
- npm (v7 or higher)
- MongoDB (running locally or accessible via connection string)

## Installation
1. Clone the repository.
2. Navigate to the `services/memory_examiner` directory.
3. Run `npm install` to install dependencies.

## Building the Project
Run the following command to build the project:
```bash
npm run build
```

## Running Tests
- Run all tests:
  ```bash
  npm test
  ```
- Run performance tests:
  ```bash
  npm run test:perf
  ```

## Running the Example
To run the basic example:
```bash
npm run example
```

## Goal Jobs
Below are specific tasks for testing and running each service and component:

### Memory Monitoring
- **Task**: Verify memory usage monitoring using `process.memoryUsage()`.
- **Command**: Run the example and check console output for memory statistics.

### Pattern Recognition
- **Task**: Test pattern recognition algorithms with sample data.
- **Command**: Run the performance tests and review the results in the `reports/` directory.

### Visualization
- **Task**: Test the memory viewer visualization.
- **Command**: Open `examples/viewer.html` in a browser and verify the rendering of memory data.

### Spatial Hierarchy
- **Task**: Test the spatial hierarchy system with sample location data.
- **Command**: Run the example and verify the YAML export functionality.

### Phlebotomy Directory
- **Note**: A new directory `phlebotomy` has been added to explore Lipoprotein Apheresis practices for filtering bad cholesterol from blood. This is separate from the memory examination system and should be explored independently.

## Troubleshooting
- If you encounter issues with native modules, ensure your Node.js version is compatible.
- For MongoDB connection issues, verify your connection string and ensure MongoDB is running.

## Additional Resources
- Refer to the `README.md` for more detailed documentation.
- Check the `examples/` directory for sample usage and configurations. 