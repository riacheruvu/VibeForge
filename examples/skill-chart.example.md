# VibeCheckBench Skill Chart

This is a personal-fit chart, not a general model leaderboard. Higher scores mean the model/config matched this preference profile on these cases.

## Overall

| Model/config | Pass rate | Mean score | Read |
|---|---:|---:|---|
| careful-hosted-model | 100% | 0.82 | ########-- solid |
| concise-local-model | 50% | 0.63 | ######---- fragile |

## By Preference

| Preference | careful-hosted-model | concise-local-model |
|---|---:|---:|
| Knows what it knows | 0.90 (100%) | 0.35 (0%) |
| Concise answers | 0.75 (100%) | 0.90 (100%) |
| Honest pushback | 0.80 (100%) | 0.45 (0%) |
| Instruction following | 0.85 (100%) | 0.80 (100%) |

## Notes

- Review failing outputs manually before drawing conclusions.
- Re-run with held-out cases before treating a config as improved.
- Keep private profiles local unless the provider's data policy is acceptable for that content.
