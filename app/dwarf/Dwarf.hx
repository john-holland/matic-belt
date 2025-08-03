class Dwarf {
    private var log: Array<String>;
    private var splatLog: Array<String>;

    public function new() {
        log = [];
        splatLog = [];
    }

    public function pourBeer(): String {
        var message = "Dwarf pours a beer for you!";
        log.push(message);
        return message;
    }

    public function logSplatActivity(activity: String): String {
        var timestamp = Date.now().toString();
        var logEntry = 'SPLAT Activity: $activity (at $timestamp)';
        splatLog.push(logEntry);
        return logEntry;
    }

    public function getLog(): Array<String> {
        return log;
    }

    public function getSplatLog(): Array<String> {
        return splatLog;
    }

    public function getAllLogs(): String {
        var allLogs = "=== DWARF LOGS ===\n";
        allLogs += "Beer Activities:\n";
        for (entry in log) {
            allLogs += "  🍺 " + entry + "\n";
        }
        allLogs += "\nSPLAT Activities:\n";
        for (entry in splatLog) {
            allLogs += "  🕷️ " + entry + "\n";
        }
        return allLogs;
    }

    public function wakeUp(): String {
        var message = "🧙‍♂️ Dwarf wakes up and stretches!";
        log.push(message);
        return message;
    }

    public function observeSystem(): String {
        var message = "🧙‍♂️ Dwarf observes the system with keen eyes...";
        log.push(message);
        return message;
    }
} 