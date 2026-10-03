import "reflect-metadata";
import dotenv from "dotenv";
import express from "express";

import { errorHandler } from "./middleware/errorMiddleware";
import { authRateLimiter } from "./middleware/rateLimiter";
import { AppDataSource } from "./lib/database";
import { logger } from "./lib/logger";
import { RegisterRoutes } from "./routes/routes";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(express.json());

app.use("/api/auth", authRateLimiter);
RegisterRoutes(app);
app.use(errorHandler);

async function startServer(): Promise<void> {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET must be configured before starting the API");
    }

    await AppDataSource.initialize();
    logger.info("Database connected");

    app.listen(port, () => {
      logger.info({ port }, "API server started");
    });
  } catch (error) {
    logger.error({ err: error }, "API startup failed");
    process.exit(1);
  }
}

startServer();

export default app;
