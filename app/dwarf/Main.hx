class Main {
  public static function main() {
    var dwarf = new Dwarf();
    
    // Wake up the dwarf
    trace(dwarf.wakeUp());
    
    // Pour a beer
    trace(dwarf.pourBeer());
    
    // Log some SPLAT activities
    trace(dwarf.logSplatActivity("System analysis started"));
    trace(dwarf.logSplatActivity("Port scanning completed"));
    trace(dwarf.logSplatActivity("Process monitoring active"));
    trace(dwarf.logSplatActivity("Spider detected high CPU usage"));
    
    // Observe the system
    trace(dwarf.observeSystem());
    
    // Show all logs
    trace("\n" + dwarf.getAllLogs());
  }
} 