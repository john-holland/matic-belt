#!/bin/bash

# Create reports directory if it doesn't exist
mkdir -p reports

# Run performance tests and save output
echo "Running performance tests..."
npm run test:perf > reports/perf-test-output.txt 2>&1

# Extract timing information
echo "Generating performance report..."
grep -A 2 "should handle" reports/perf-test-output.txt > reports/timing-info.txt

# Calculate averages
echo "Calculating averages..."
awk '
BEGIN { count = 0; total = 0; }
/expect\(duration\)\.toBeLessThan/ {
    if (match($0, /([0-9]+)/, arr)) {
        total += arr[1];
        count++;
    }
}
END {
    if (count > 0) {
        print "Average duration threshold:", total/count, "ms";
    }
}
' reports/timing-info.txt > reports/averages.txt

# Generate summary
echo "Generating summary..."
echo "Performance Test Summary" > reports/summary.txt
echo "======================" >> reports/summary.txt
echo "" >> reports/summary.txt
echo "Test Categories:" >> reports/summary.txt
echo "1. Pattern Recognition" >> reports/summary.txt
echo "2. QuadTree Operations" >> reports/summary.txt
echo "3. End-to-End Performance" >> reports/summary.txt
echo "" >> reports/summary.txt
echo "See timing-info.txt for detailed results" >> reports/summary.txt
echo "See averages.txt for average thresholds" >> reports/summary.txt

echo "Performance test report generated in reports/" 