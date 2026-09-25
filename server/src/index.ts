import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import staticPlugin from "@fastify/static";
import { createApp } from "./app";
import { SQLiteScoreRepository } from "./db/database";
try {
  if (existsSync(".env")) loadEnvFile(".env");
  const db = new SQLiteScoreRepository(
    process.env.DATABASE_PATH ?? "./data/leaderboard.sqlite",
  );
  const app = createApp(db, db);
  if (existsSync(resolve("dist")))
    await app.register(staticPlugin, { root: resolve("dist") });
  await app.listen({
    port: Number(process.env.PORT ?? 3001),
    host: process.env.HOST ?? "127.0.0.1",
  });
  console.log("Hologram Defender API ready on port", process.env.PORT ?? 3001);
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => {
      void app.close().then(() => process.exit(0));
    });
} catch (error) {
  console.error(
    "Leaderboard could not start. The Vite client remains playable offline.",
    error,
  );
  process.exitCode = 1;
}
