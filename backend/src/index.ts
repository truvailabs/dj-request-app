import "dotenv/config";
import express from "express";
import cors from "cors";
import { env } from "./lib/env.js";
import { requestsRouter } from "./routes/requests.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { tiersRouter } from "./routes/tiers.js";
import { eventRouter } from "./routes/event.js";

const app = express();

app.use(cors({ origin: env.corsOrigin }));

// Must come before express.json(): Stripe's signature check needs the raw,
// unparsed request body — JSON body-parsing would break it.
app.use("/webhooks/stripe", express.raw({ type: "application/json" }));
app.use(webhooksRouter);

app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(requestsRouter);
app.use(tiersRouter);
app.use(eventRouter);

app.listen(Number(env.port), () => {
  console.log(`API listening on :${env.port}`);
});
