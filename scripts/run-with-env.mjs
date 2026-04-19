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

function shouldProtectViteSource(commandParts) {
  return commandParts[0] === "npx" && commandParts[1] === "vercel" && commandParts[2] === "dev";
}

function hideDistDuringVercelDev(cwd) {
  const distPath = path.join(cwd, "dist");
  const backupPath = path.join(cwd, ".dist.vercel-dev-backup");

  if (!fs.existsSync(distPath)) {
    return () => {};
  }

  if (fs.existsSync(backupPath)) {
    throw new Error(
      "Found .dist.vercel-dev-backup. Restore or remove it before starting local dev."
    );
  }

  fs.renameSync(distPath, backupPath);
  console.log("Temporarily moved dist/ so vercel dev serves Vite source instead of stale build output.");

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;

    if (fs.existsSync(backupPath) && !fs.existsSync(distPath)) {
      fs.renameSync(backupPath, distPath);
    }
  };
}

const [, , mode, ...commandParts] = process.argv;

if (!mode || commandParts.length === 0) {
  console.error(
    "Usage: node scripts/run-with-env.mjs <development|test|production> <command> [args...]"
  );
  process.exit(1);
}

const env = {
  ...process.env,
  ...loadModeEnv(mode),
  NODE_ENV:
    mode === "production"
      ? "production"
      : mode === "test"
      ? "test"
      : "development",
  VITE_APP_ENV: mode,
};

const cwd = process.cwd();
let restoreDist = () => {};

if (shouldProtectViteSource(commandParts)) {
  restoreDist = hideDistDuringVercelDev(cwd);
}

const restoreAndExit = (code = 0, signal) => {
  try {
    restoreDist();
  } finally {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code);
  }
};

const child = spawn(commandParts[0], commandParts.slice(1), {
  stdio: "inherit",
  shell: false,
  env,
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  restoreAndExit(code ?? 0, signal);
});
