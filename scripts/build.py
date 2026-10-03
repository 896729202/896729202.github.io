#!/usr/bin/env python3
"""Build the notebook and its dated experiment archive with one command."""
import build_core
import build_experiments


def main():
    build_experiments.configure(build_core)
    build_core.main()
    build_experiments.build(build_core)


if __name__ == "__main__":
    main()
