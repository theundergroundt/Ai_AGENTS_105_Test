# Agent Instructions

These instructions apply to this repository and its subdirectories.

## Scope

- This repo is for private analysis, planning, and product code.
- Keep upstream codebases such as Claw3D in separate repositories.

## Repo Rules

- Put Claw3D analysis under `analysis/claw3d`.
- Put project-wide documentation under `docs`.
- Put application code under `apps`.
- Put throwaway or validation work under `experiments`.
- Put upstream comparison notes under `refs/upstream-notes`.

## Writing Rules

- Separate facts, hypotheses, and proposals.
- Prefer small focused documents over large mixed notes.
- Reference upstream files by path instead of copying large code blocks.

## Safety

- Do not commit secrets, tokens, or machine-specific private instructions.
- Do not vendor entire upstream repositories into this repo without an explicit reason.
