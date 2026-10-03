#!/usr/bin/env python3
"""Build the notebook and dated experiment summaries with one command."""
import build_core
import build_experiments
import experiment_summaries


def main():
    build_experiments.configure(build_core)
    build_core.main()
    experiment_summaries.build(build_core)


if __name__ == "__main__":
    main()
