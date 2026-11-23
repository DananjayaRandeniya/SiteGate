# SiteGate Git workflow

## Before every step

1. **Check the checkout.** Confirm that the existing SiteGate folder points to
   `DananjayaRandeniya/SiteGate`. Reuse it and clone the team repository into
   the intended SiteGate folder only if there is no checkout. Run
   `git status --short --branch` and preserve local work.
2. **Refresh and review GitHub.** Fetch the remote branches with
   `git fetch origin --prune`. Check `origin/main`, the current story branch,
   relevant teammate branches, and open and recently merged PRs. Read the
   relevant diffs, including changes from teammates whose work the step uses.
3. **Match the code to the requested step.** Check which requirements are
   already implemented, what is still missing, and what depends on an unmerged
   PR. Look for overlap or merge conflicts in the same files, APIs, database
   models, Kafka contracts, and configuration. Verify and reuse existing work.
   Resolve safe conflicts within the story and raise any behavior decision
   that needs the team's input.
4. **Implement and verify.** Work on the approved story branch, based on
   current `origin/main` or its required prerequisite branch. Run the
   relevant checks and review the diff again. Explain any overlap, the test
   results, and the PR decision in the ten-point lesson walkthrough.

## Pull requests

- Use team-style branch names such as `feat/worker-profile` and
  `docs/git-step-workflow`. Avoid the `codex/` prefix.
- Group related lessons into one change a teammate can review and test. Use
  a conventional commit and describe why the change is needed, what changed,
  and how to verify it.
- Target protected `main` once the change and its dependencies are ready.
  When a story depends on an open PR, keep it on its own branch. After the
  prerequisite merges, compare it against the new `origin/main` before
  opening its PR. Get one teammate approval and squash merge.
