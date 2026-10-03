import { Queue } from "bullmq";

import { redisConnection } from "../config/redis";

export type ReservationExpiryJobData = Record<string, never>;

export const reservationExpiryQueue = new Queue<ReservationExpiryJobData>(
  "reservation-expiry",
  { connection: redisConnection },
);
