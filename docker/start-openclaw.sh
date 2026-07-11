#!/bin/sh
set -eu

CONFIG_DIR="${OPENCLAW_CONFIG_DIR:-/home/node/.openclaw}"
CONFIG_PATH="$CONFIG_DIR/openclaw.json"

mkdir -p "$CONFIG_DIR"

node <<'NODE'
const fs = require("node:fs");

const configPath = process.env.CONFIG_PATH;
const port = Number.parseInt(process.env.OPENCLAW_GATEWAY_PORT || "18789", 10);
const useLocalProvider = (process.env.VIBEFORGE_PROVIDER || "").trim().toLowerCase() === "local";

const sandboxEnv = {
  ...(process.env.VIBEFORGE_PROVIDER
    ? { VIBEFORGE_PROVIDER: process.env.VIBEFORGE_PROVIDER }
    : {}),
  ...(process.env.VIBEFORGE_LOCAL_MODEL
    ? { VIBEFORGE_LOCAL_MODEL: process.env.VIBEFORGE_LOCAL_MODEL }
    : {}),
  ...(process.env.VIBEFORGE_LOCAL_FAST
    ? { VIBEFORGE_LOCAL_FAST: process.env.VIBEFORGE_LOCAL_FAST }
    : {}),
  ...(!useLocalProvider && process.env.OPENAI_API_KEY
    ? { OPENAI_API_KEY: process.env.OPENAI_API_KEY }
    : {}),
  ...(!useLocalProvider && process.env.ANTHROPIC_API_KEY
    ? { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }
    : {}),
};

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge(base, patch) {
  const output = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = deepMerge(output[key], value);
      continue;
    }
    output[key] = value;
  }
  return output;
}

let current = {};
if (fs.existsSync(configPath)) {
  try {
    current = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    current = {};
  }
}

if (
  current?.agents?.defaults?.sandbox?.docker &&
  isPlainObject(current.agents.defaults.sandbox.docker)
) {
  current.agents.defaults.sandbox.docker = {
    ...current.agents.defaults.sandbox.docker,
    env: {},
  };
}

const managed = {
  gateway: {
    mode: "local",
    bind: process.env.OPENCLAW_GATEWAY_BIND || "lan",
    controlUi: {
      allowedOrigins: [
        `http://localhost:${port}`,
        `http://127.0.0.1:${port}`,
      ],
    },
  },
  agents: {
    defaults: {
      sandbox: {
        mode: process.env.OPENCLAW_SANDBOX_MODE || "all",
        backend: "docker",
        scope: process.env.OPENCLAW_SANDBOX_SCOPE || "session",
        workspaceAccess: process.env.OPENCLAW_SANDBOX_WORKSPACE_ACCESS || "none",
        docker: {
          image: process.env.OPENCLAW_SANDBOX_IMAGE || "vibeforge-openclaw-sandbox:local",
          network: process.env.OPENCLAW_SANDBOX_NETWORK || "bridge",
          readOnlyRoot: false,
          user: "0:0",
          env: sandboxEnv,
        },
      },
    },
  },
  skills: {
    entries: {
      VibeForge: {
        enabled: true,
      },
    },
  },
};

const merged = deepMerge(current, managed);
fs.writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`);
NODE

exec node dist/index.js gateway --allow-unconfigured --bind "${OPENCLAW_GATEWAY_BIND:-lan}" --port "${OPENCLAW_GATEWAY_PORT:-18789}"
