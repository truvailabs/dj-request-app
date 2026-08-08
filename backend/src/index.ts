import "dotenv/config";
import express from "express";
import cors from "cors";
import { env } from "./lib/env.js";
import { requestsRouter } from "./routes/requests.js";

const app = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(requestsRouter);

app.listen(Number(env.port), () => {
  console.log(`API listening on :${env.port}`);
});
