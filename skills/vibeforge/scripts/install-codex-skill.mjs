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
const skillsRoot = path.join(codexHome, "skills");
const destination = path.join(skillsRoot, "vibeforge");

// Remove legacy skill id if present
const legacy = path.join(skillsRoot, "vibecheckbench");
if (fs.existsSync(legacy)) {
  fs.rmSync(legacy, { recursive: true, force: true });
  console.log(`Removed legacy skill: ${legacy}`);
}

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(skillDir, destination, { recursive: true });

console.log(`Installed VibeForge skill: ${destination}`);
console.log("Invoke as $vibeforge in Codex.");
