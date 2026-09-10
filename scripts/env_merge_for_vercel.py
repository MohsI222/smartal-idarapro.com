#!/usr/bin/env python3
"""
دمج ملفي .env و .env.local (الثاني يطغى)، تخطي VERCEL_*.
الخرج: سطر لكل مفتاح KEY=value (قيمة بدون أسطر جديدة).
"""
import sys
from pathlib import Path
from typing import Dict


def parse_env_file(path: Path) -> Dict[str, str]:
    out: Dict[str, str] = {}
    if not path.is_file():
        return out
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip("\r")
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        if "=" not in line:
            continue
        key, _, rest = line.partition("=")
        key = key.strip()
        if not key or key.startswith("VERCEL_"):
            continue
        val = rest.lstrip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        out[key] = val
    return out


def main() -> None:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    base = parse_env_file(root / ".env")
    over = parse_env_file(root / ".env.local")
    merged = {**base, **over}
    for k, v in sorted(merged.items()):
        if k.startswith("VERCEL_"):
            continue
        if "\n" in v or "\r" in v:
            continue
        sys.stdout.write(f"{k}={v}\n")


if __name__ == "__main__":
    main()
