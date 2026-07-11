#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.resolve(scriptDir, "..");
const codexHome = process.env.CODEX_HOME
  ? path.resolve(process.env.CODEX_HOME)
  : path.join(os.homedir(), ".codex");

// Install under both ids so $vibecheckbench and $vibeforge resolve during rename.
const skillNames = ["vibecheckbench", "vibeforge"];

for (const name of skillNames) {
  const destination = path.join(codexHome, "skills", name);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(skillDir, destination, { recursive: true });

  // Alias skill keeps the same scripts but presents as vibeforge in frontmatter when installed under that name.
  if (name === "vibeforge") {
    const skillMd = path.join(destination, "SKILL.md");
    if (fs.existsSync(skillMd)) {
      let text = fs.readFileSync(skillMd, "utf8");
      text = text.replace(/^name:\s*vibecheckbench\s*$/m, "name: vibeforge");
      fs.writeFileSync(skillMd, text, "utf8");
    }
    const agentYaml = path.join(destination, "agents", "openai.yaml");
    if (fs.existsSync(agentYaml)) {
      let yaml = fs.readFileSync(agentYaml, "utf8");
      yaml = yaml.replace(
        /default_prompt:.*$/m,
        'default_prompt: "Use $vibeforge to turn my preferences into a local fit review or setup comparison. Default to draft-only unless I ask to run models."',
      );
      fs.writeFileSync(agentYaml, yaml, "utf8");
    }
  }

  console.log(`Installed VibeForge skill as "${name}": ${destination}`);
}

console.log("Both vibecheckbench and vibeforge point at the same skill content.");
