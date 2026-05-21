import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import "./db/init.js";
import "./services/approvalHandlers.js"; // Phase 3: register approval action handlers
import { errorHandler, notFound } from "./middleware/error.js";
import { adminRouter } from "./routes/admin.js";
import { approvalsRouter } from "./routes/approvals.js";
import { authRouter } from "./routes/auth.js";
import { clientsRouter } from "./routes/clients.js";
import { portfolioRouter } from "./routes/portfolio.js";
import { pricingRouter } from "./routes/pricing.js";
import { productsRouter } from "./routes/products.js";
import { requestsRouter } from "./routes/requests.js";
import { settingsRouter } from "./routes/settings.js";
import { statementsRouter } from "./routes/statements.js";

dotenv.config();

export function createApp() {
  const app = express();

  // Trust the loopback proxy (Nginx on same host).
  // TRUST_PROXY=loopback (default) trusts only 127.0.0.1/::1.
  // Set TRUST_PROXY=1 if behind a single external load balancer.
  const trustProxy = process.env.TRUST_PROXY ?? "loopback";
  app.set("trust proxy", trustProxy);

  const origin = process.env.API_ORIGIN ?? "http://localhost:3000";

  app.use(helmet());
  app.use(
    cors({
      origin,
      credentials: false,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
    })
  );
  app.use(express.json({ limit: "1mb" }));

  // Request ID middleware: read X-Request-Id from upstream (CF/Nginx) or generate one.
  // Surfaces as response header and is available on req for log correlation.
  app.use((req, res, next) => {
    const incoming = req.header("x-request-id");
    const id = incoming && /^[A-Za-z0-9_-]{8,128}$/.test(incoming)
      ? incoming
      : Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    (req as unknown as { requestId: string }).requestId = id;
    res.setHeader("X-Request-Id", id);
    next();
  });
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/approvals", approvalsRouter);
  app.use("/api/clients", clientsRouter);
  app.use("/api/products", productsRouter);
  app.use("/api/portfolio", portfolioRouter);
  app.use("/api/pricing", pricingRouter);
  app.use("/api/requests", requestsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/statements", statementsRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
