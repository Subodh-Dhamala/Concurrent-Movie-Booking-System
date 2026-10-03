import "reflect-metadata";
import { Worker } from "bullmq";
import dotenv from "dotenv";

import { redisConnection } from "../config/redis";
import { AppDataSource } from "../lib/database";
import { logger } from "../lib/logger";
import { reservationExpiryQueue, type ReservationExpiryJobData } from "../queue/reservationExpiryQueue";
import { expireDueReservations } from "../services/reservationService";

dotenv.config();

async function startWorker(): Promise<void> {
  await AppDataSource.initialize();
  logger.info("Reservation expiry worker connected to the database");

  await reservationExpiryQueue.upsertJobScheduler(
    "expire-overdue-reservations",
    { pattern: "* * * * *", immediately: true },
    {
      name: "expire-overdue-reservations",
      data: {},
      opts: {
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    },
  );

  logger.info("BullMQ cron scheduler registered to check overdue reservations every minute");

  const worker = new Worker<ReservationExpiryJobData>(
    "reservation-expiry",
    async () => {
      const expiredCount = await AppDataSource.manager.transaction((manager) =>
        expireDueReservations(manager),
      );

      if (expiredCount > 0) {
        logger.info({ expiredCount }, "Expired overdue reservations");
      }
    },
    { connection: redisConnection, concurrency: 10 },
  );

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, err: error }, "Reservation expiry job failed");
  });

  worker.on("error", (error) => {
    logger.error({ err: error }, "Reservation expiry worker error");
  });

  const shutdown = async () => {
    await worker.close();
    await reservationExpiryQueue.close();
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

startWorker().catch((error: unknown) => {
  logger.error({ err: error }, "Failed to start reservation expiry worker");
  process.exitCode = 1;
});
