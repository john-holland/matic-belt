#!/bin/bash

# SPLAT Demo Script

echo "🎬 SPLAT Demo - System Process Lookup and Analysis Tool"
echo "========================================================"
echo ""

# Check if SPLAT is available
if command -v splat &> /dev/null; then
    SPLAT_CMD="splat"
elif [ -f "./dist/index.js" ]; then
    SPLAT_CMD="./dist/index.js"
else
    echo "❌ SPLAT not found. Please run 'npm run build' first."
    exit 1
fi

echo "1️⃣  Basic System Analysis"
echo "------------------------"
$SPLAT_CMD analyze
echo ""

echo "2️⃣  Getting Suggestions with Food Metaphor"
echo "----------------------------------------"
$SPLAT_CMD suggest -m "so i was trying to make a sandwich with grep, and the salami in the library of congress open source lib went bad, can you run to the store???"
echo ""

echo "3️⃣  Pipe Analysis Example"
echo "------------------------"
echo "I need help with grep and my library is broken" | $SPLAT_CMD pipe
echo ""

echo "4️⃣  Real-time Monitoring (5 seconds)"
echo "-----------------------------------"
echo "Starting monitoring for 5 seconds..."
timeout 5s $SPLAT_CMD monitor || true
echo ""

echo "5️⃣  Verbose Analysis with Ports"
echo "------------------------------"
$SPLAT_CMD analyze -v -p
echo ""

echo "🎉 Demo Complete!"
echo ""
echo "💡 Try these commands:"
echo "   splat analyze -d                    # Show daemon processes"
echo "   splat suggest -m 'your message'     # Get personalized suggestions"
echo "   splat monitor -i 2                  # Fast monitoring (2s intervals)"
echo "   ps aux | splat pipe                 # Analyze process list"
echo "   tail -f /var/log/syslog | splat pipe # Monitor logs" 