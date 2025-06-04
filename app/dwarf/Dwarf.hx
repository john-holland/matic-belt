package dwarf;

class Dwarf {
    private var log: Array<String>;

    public function new() {
        log = [];
    }

    public function pourBeer(): String {
        var message = "Dwarf pours a beer for you!";
        log.push(message);
        return message;
    }

    public function getLog(): Array<String> {
        return log;
    }
} 