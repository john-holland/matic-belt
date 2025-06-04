package dwarf;

class Main {
  public static function main() {
    var dwarf = new Dwarf();
    var message = dwarf.pourBeer();
    trace(message);
    trace("Dwarf's log: " + dwarf.getLog());
  }
} 