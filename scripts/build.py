#!/usr/bin/env python3
"""Build the notebook, experiment summaries, datasets and RL topics."""
import build_core
import build_experiments
import experiment_summaries
import dataset_inventory
import rl_notes


def main():
    build_experiments.configure(build_core)
    build_core.main()
    experiment_summaries.build(build_core)
    dataset_inventory.build(build_core)
    rl_notes.build(build_core)


if __name__ == "__main__":
    main()
