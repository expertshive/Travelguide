#!/usr/bin/env python3
"""Start a service in its own session so it outlives the launching shell.

Usage: run-detached.py <workdir> <logfile> <command> [args...]
Environment overrides may be passed as KEY=VALUE pairs before the command.
"""
import os
import sys


def main() -> int:
    if len(sys.argv) < 4:
        print(__doc__, file=sys.stderr)
        return 2

    workdir, logfile = sys.argv[1], sys.argv[2]
    rest = sys.argv[3:]

    env = os.environ.copy()
    # Strip inherited PORT/DATABASE_URL so each service reads its own .env.
    for key in ("PORT", "DATABASE_URL"):
        env.pop(key, None)

    while rest and "=" in rest[0] and not os.path.exists(rest[0]):
        key, _, value = rest[0].partition("=")
        env[key] = value
        rest = rest[1:]

    if not rest:
        print("no command given", file=sys.stderr)
        return 2

    if os.fork() != 0:
        return 0

    os.setsid()
    os.chdir(workdir)

    with open(logfile, "wb", 0) as log, open(os.devnull, "rb") as devnull:
        os.dup2(devnull.fileno(), 0)
        os.dup2(log.fileno(), 1)
        os.dup2(log.fileno(), 2)
        os.execvpe(rest[0], rest, env)

    return 0


if __name__ == "__main__":
    sys.exit(main())
