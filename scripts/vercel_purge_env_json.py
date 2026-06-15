#!/usr/bin/env python3
"""Parse `vercel env list <env> --format json` stdout → list of keys (one per line)."""
import json
import re
import sys


def main() -> None:
    raw = sys.stdin.read()
    m = re.search(r"\{", raw)
    if not m:
        sys.stderr.write("vercel_purge_env_json: no JSON object in stdin\n")
        sys.exit(1)
    data = json.loads(raw[m.start() :])
    envs = data.get("envs") or []
    for row in envs:
        key = row.get("key")
        if key:
            print(key)


if __name__ == "__main__":
    main()
