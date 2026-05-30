# /vibecheckbench - Export or run a preference-fit eval

## Default: Promptfoo Export

Use this path unless the user explicitly asks for A/B judge scoring.

```text
/vibecheckbench export --profile examples/public-agent-profile.yaml --case-file examples/public-agent-cases.json --prompt-file examples/public-agent-system-prompt.txt --provider openai:chat:gpt-4.1-mini --out promptfooconfig.yaml
```

Run:

```bash
node skills/vibecheckbench/scripts/export-promptfoo.mjs --profile "$PROFILE" --case-file "$CASE_FILE" --prompt-file "$PROMPT_FILE" --provider "$PROVIDER" --out "$OUT"
```

Then suggest:

```bash
npx promptfoo@latest eval -c "$OUT"
```

`npx promptfoo@latest` may download Promptfoo if it is not already cached or installed. Ask before running it in restricted/no-network contexts.

Report the generated config path, provider id, test count, and whether this is a local/private or hosted run.

## Validate

```bash
node skills/vibecheckbench/scripts/export-promptfoo.mjs --profile examples/public-agent-profile.yaml --case-file examples/public-agent-cases.json --prompt-file examples/public-agent-system-prompt.txt --provider echo --out promptfooconfig.yaml
```

Echo is a plumbing check only. Echoed prompts should fail the generated rubrics because non-answers are guarded against.

Use `--stdout` when validating without writing files.

## Optional Legacy A/B

Use only when requested:

```bash
node skills/vibecheckbench/scripts/run-profile.mjs --profile preferences.yaml --prompt-file prompt.txt --cases 3 --repeat 3 --save-report
```

For serious A/B runs, prefer:

```bash
--judge-provider openai --judge-model gpt-4.1-mini
```

## Flags

| Flag | Description |
|---|---|
| `--profile path` | Preference YAML |
| `--case-file path` | JSON case bank keyed by preference id/type |
| `--prompt-file path` | System prompt/config to test |
| `--provider id` | Promptfoo provider id |
| `--out path` | Promptfoo config output path |
| `--stdout` | Print generated config instead of writing it |
| `--threshold N` | JavaScript assertion pass threshold |
| `--cases N` | Legacy runner cases per preference |
| `--repeat N` | Legacy runner repeat count |
| `--judge-provider name` | Legacy separate judge provider |
| `--judge-model name` | Legacy separate judge model |

## Behavior

- Default to Promptfoo export.
- Keep privacy explicit when using hosted providers.
- Treat deterministic rubrics as regression checks, not proof of model quality.
- Avoid presenting tiny runs as conclusive.
