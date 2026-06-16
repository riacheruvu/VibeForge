# Case Study: Format and Decision Fit

This public-safe case study shows a different kind of personal-fit failure:
the answer is helpful-looking, but it ignores exact formatting and takes over a
decision too quickly.

```bash
node skills/vibecheckbench/scripts/mine-conversation-history.mjs \
  --input examples/case-studies/format-decision-loop/conversation-export.json \
  --out reports/case-studies/format-decision-loop/history-review.json \
  --tasks-dir reports/case-studies/format-decision-loop/draft-tasks

node skills/vibecheckbench/scripts/promote-history-candidates.mjs \
  --review reports/case-studies/format-decision-loop/history-review.json \
  --decisions examples/case-studies/format-decision-loop/review-decisions.json \
  --out reports/case-studies/format-decision-loop/project.json \
  --tasks-dir reports/case-studies/format-decision-loop/tasks \
  --name "Format and decision fit"

node skills/vibecheckbench/scripts/score-answers.mjs \
  --input examples/case-studies/format-decision-loop/captured-answers.train.json \
  --out reports/case-studies/format-decision-loop/results.train.json

node skills/vibecheckbench/scripts/score-answers.mjs \
  --input examples/case-studies/format-decision-loop/captured-answers.heldout.json \
  --out reports/case-studies/format-decision-loop/results.heldout.json

node skills/vibecheckbench/scripts/gate-config-results.mjs \
  --train reports/case-studies/format-decision-loop/results.train.json \
  --heldout reports/case-studies/format-decision-loop/results.heldout.json \
  --out reports/case-studies/format-decision-loop/config-gate.json
```

The point is not to crown a universal best model. It is to show that small
preference mismatches can be captured, reviewed, and used to guide one focused
setup change.
