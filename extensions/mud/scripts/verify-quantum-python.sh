#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="${QUANTUM_PYTHON_BIN:-python3}"
CLI="$ROOT/python/quantum_geo/cli.py"
if [[ ! -f "$CLI" ]]; then
  echo "missing $CLI" >&2
  exit 1
fi
echo '{"op":"ecef_llh","lat":40.7,"lon":-74,"alt_m":10,"body":"earth"}' | "$PY" "$CLI" | head -c 200
echo
"$PY" -c "import numpy, scipy; print('numpy', numpy.__version__, 'scipy', scipy.__version__)"
echo "OK"
