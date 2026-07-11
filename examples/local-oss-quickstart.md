# Local OSS Quickstart

This path compares small local models as **subjects**: the models answer the
VibeForge cases, then the tool scores those answers and makes a chart.

It does not require OpenAI, Anthropic, or other hosted API keys. It does require
Ollama and whichever local models you choose to download.

## Tiny models to try first

These are useful smoke-test models because they are small and quick:

```bash
ollama pull gemma3:270m
ollama pull qwen3:0.6b
ollama pull smollm2:360m
ollama pull llama3.2:1b
```

Suggested first comparison:

```bash
node skills/vibeforge/scripts/run-local-subjects.mjs \
  --provider ollama:chat:gemma3:270m \
  --provider ollama:chat:qwen3:0.6b \
  --provider ollama:chat:llama3.2:1b \
  --limit 1 \
  --out reports/answers.ollama-tiny.json \
  --scored-out reports/results.ollama-tiny.json \
  --chart-out reports/skill-chart.ollama-tiny.html
```

`--limit 1` runs one prompt per preference area. Remove it for the full suite.

## More capable local models

If your machine can handle them, these are better for meaningful preference-fit
testing:

```bash
ollama pull gemma3:1b
ollama pull smollm2:1.7b
ollama pull llama3.2:3b
ollama pull qwen3:8b
```

Then run:

```bash
node skills/vibeforge/scripts/run-local-subjects.mjs \
  --provider ollama:chat:gemma3:1b \
  --provider ollama:chat:llama3.2:3b \
  --provider ollama:chat:qwen3:8b \
  --limit 1 \
  --out reports/answers.ollama-small.json \
  --scored-out reports/results.ollama-small.json \
  --chart-out reports/skill-chart.ollama-small.html
```

## Read the chart carefully

Tiny models are useful for testing the workflow, but they may fail for reasons
that are not very interesting: weak instruction following, short context, or
low reasoning quality. Treat their charts as "does the local path work?" before
treating them as serious evidence about personal fit.
