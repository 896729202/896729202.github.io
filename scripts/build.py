#!/usr/bin/env python3
"""Build the notebook, experiment summaries and current dataset inventory."""
import build_core
import build_experiments
import experiment_summaries
import dataset_inventory


def main():
    build_experiments.configure(build_core)
    build_core.main()
    experiment_summaries.build(build_core)
    dataset_inventory.build(build_core)


if __name__ == "__main__":
    main()
