import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function parseEnvFile(contents) {
  const parsed = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function loadModeEnv(mode) {
  const cwd = process.cwd();
  const files = [
    path.join(cwd, `.env.${mode}`),
    path.join(cwd, `.env.${mode}.local`),
  ];

  const loaded = {};

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    Object.assign(loaded, parseEnvFile(fs.readFileSync(filePath, "utf8")));
  }

  return loaded;
}

const [, , mode] = process.argv;

if (!mode) {
  console.error("Usage: node scripts/run-local-stack.mjs <development|test|production>");
  process.exit(1);
}

const frontendPort = mode === "test" ? "8081" : "8080";
const apiPort = mode === "test" ? "3002" : "3001";

const baseEnv = {
  ...process.env,
  ...loadModeEnv(mode),
  NODE_ENV:
    mode === "production"
      ? "production"
      : mode === "test"
      ? "test"
      : "development",
  VITE_APP_ENV: mode,
  VITE_API_PROXY_TARGET: `http://localhost:${apiPort}`,
  APP_URL: `http://localhost:${frontendPort}`,
};

console.log(`Starting local stack for ${mode}`);
console.log(`Frontend: http://localhost:${frontendPort}`);
console.log(`API:      http://localhost:${apiPort}`);

const processes = [];
let shuttingDown = false;

function spawnNamed(name, command, args, env) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    env,
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const proc of processes) {
      if (proc !== child) proc.kill("SIGTERM");
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  processes.push(child);
  return child;
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const proc of processes) proc.kill(signal);
  });
}

spawnNamed(
  "api",
  "npx",
  ["vercel", "dev", "--listen", apiPort],
  baseEnv
);

spawnNamed(
  "frontend",
  "npx",
  ["vite", "--mode", mode, "--host", "127.0.0.1", "--port", frontendPort],
  baseEnv
);
