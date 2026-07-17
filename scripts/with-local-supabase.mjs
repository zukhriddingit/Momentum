import { execFileSync, spawn } from "node:child_process";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  throw new Error(
    "Usage: node scripts/with-local-supabase.mjs <command> [...args]",
  );
}

const output = execFileSync(
  "pnpm",
  ["exec", "supabase", "status", "--output", "env"],
  { encoding: "utf8" },
);

const local = Object.fromEntries(
  output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      const key = line.slice(0, separator);
      const value = line.slice(separator + 1).replace(/^"|"$/g, "");
      return [key, value];
    }),
);

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY ?? local.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY ?? local.SECRET_KEY,
  DATABASE_URL: local.DB_URL,
  MOMENTUM_ENVIRONMENT: process.env.MOMENTUM_ENVIRONMENT ?? "local",
  MOMENTUM_DEMO_EMAIL: process.env.MOMENTUM_DEMO_EMAIL ?? "demo@momentum.local",
  MOMENTUM_DEMO_PASSWORD: process.env.MOMENTUM_DEMO_PASSWORD ?? "momentum-demo",
  MOMENTUM_DEMO_TEAMMATE_EMAIL:
    process.env.MOMENTUM_DEMO_TEAMMATE_EMAIL ?? "teammate@momentum.local",
};

const child = spawn(command, args, { env, stdio: "inherit", shell: false });
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
