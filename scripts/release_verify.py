import json, sys
from pathlib import Path
cfg = json.loads(Path("release.config.json").read_text())
ok = cfg.get("environment") == "production" and cfg.get("allowProductionRelease") is True
print("SAFE TO SHIP" if ok else "RELEASE BLOCKED")
sys.exit(0 if ok else 1)
