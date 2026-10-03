import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import dotenv from "dotenv";
import { DataSource } from "typeorm";

import { Reservation, ReservationStatus } from "../entities/Reservation";
import { ReservationSeat } from "../entities/ReservationSeat";
import { Seat } from "../entities/Seat";
import { Show } from "../entities/Show";
import { User } from "../entities/User";
import { verifyToken } from "../lib/jwt";
import { InitialSchema1760000000000 } from "../migrations/1760000000000-InitialSchema";
import {
  cancelReservation,
  confirmReservation,
  createReservation,
  expireDueReservations,
} from "../services/reservationService";
import { login, register } from "../services/authService";

dotenv.config();

const testDatabaseName = process.env.TEST_DB_DATABASE;
const testDataSource = testDatabaseName
  ? new DataSource({
      type: "postgres",
      host: process.env.DB_HOST ?? "localhost",
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? "postgres",
      password: process.env.DB_PASSWORD ?? "postgres",
      database: testDatabaseName,
      entities: [User, Show, Seat, Reservation, ReservationSeat],
      migrations: [InitialSchema1760000000000],
      synchronize: false,
    })
  : undefined;

before(async () => {
  if (!testDataSource) return;
  await testDataSource.initialize();
  await testDataSource.runMigrations();
});

after(async () => {
  if (testDataSource?.isInitialized) {
    await testDataSource.destroy();
  }
});

test(
  "competing seat requests allow only one live hold, and expired holds release seats",
  { skip: !testDataSource ? "Set TEST_DB_DATABASE to a dedicated test database" : false },
  async () => {
    assert.ok(testDataSource);

    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const registration = await register(
      `booking-test-${uniqueId}`,
      `booking-test-${uniqueId}@example.test`,
      "integration-test-password",
      testDataSource,
    );
    assert.equal("password" in registration.user, false);
    const authenticated = await login(
      registration.user.email,
      "integration-test-password",
      testDataSource,
    );
    assert.equal(verifyToken(authenticated.token).userId, registration.user.id);

    const user = await testDataSource.getRepository(User).findOneByOrFail({
      id: registration.user.id,
    });
    const show = await testDataSource.getRepository(Show).save(
      testDataSource.getRepository(Show).create({
        title: "Concurrency test",
        hall: "Test hall",
        showTime: new Date(Date.now() + 60 * 60 * 1000),
      }),
    );
    const seat = await testDataSource.getRepository(Seat).save(
      testDataSource.getRepository(Seat).create({
        showId: show.id,
        seatNumber: "A1",
        section: "Test",
        price: 1,
      }),
    );
    const secondSeat = await testDataSource.getRepository(Seat).save(
      testDataSource.getRepository(Seat).create({
        showId: show.id,
        seatNumber: "B1",
        section: "Test",
        price: 1,
      }),
    );

    try {
      const attempts = await Promise.allSettled(
        [user.id, user.id].map((userId) =>
          testDataSource.manager.transaction((manager) =>
            createReservation(manager, { userId, showId: show.id, seatIds: [seat.id] }),
          ),
        ),
      );

      assert.equal(
        attempts.filter((attempt) => attempt.status === "fulfilled").length,
        1,
        attempts
          .map((attempt) => attempt.status === "rejected" ? String(attempt.reason) : "fulfilled")
          .join("\n"),
      );
      assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
      const winningAttempt = attempts.find(
        (
          attempt,
        ): attempt is PromiseFulfilledResult<{ reservation: Reservation; seatIds: string[] }> =>
          attempt.status === "fulfilled",
      );
      assert.ok(winningAttempt);
      assert.equal(
        await testDataSource.getRepository(Reservation).count({
          where: { userId: user.id, status: ReservationStatus.HELD },
        }),
        1,
      );

      await testDataSource.getRepository(Reservation).update(
        { id: winningAttempt.value.reservation.id },
        { expiresAt: new Date(Date.now() - 1000) },
      );

      const expiredCount = await testDataSource.manager.transaction((manager) =>
        expireDueReservations(manager),
      );
      assert.equal(expiredCount, 1);

      const nextHold = await testDataSource.manager.transaction((manager) =>
        createReservation(manager, { userId: user.id, showId: show.id, seatIds: [seat.id] }),
      );
      assert.equal(nextHold.reservation.status, ReservationStatus.HELD);

      const confirmed = await testDataSource.manager.transaction((manager) =>
        confirmReservation(manager, nextHold.reservation.id, user.id),
      );
      assert.equal(confirmed.status, ReservationStatus.CONFIRMED);

      const cancelHold = await testDataSource.manager.transaction((manager) =>
        createReservation(manager, { userId: user.id, showId: show.id, seatIds: [secondSeat.id] }),
      );
      const cancelled = await testDataSource.manager.transaction((manager) =>
        cancelReservation(manager, cancelHold.reservation.id, user.id),
      );
      assert.equal(cancelled.status, ReservationStatus.CANCELLED);
    } finally {
      await testDataSource.getRepository(Show).delete(show.id);
      await testDataSource.getRepository(User).delete(user.id);
    }
  },
);
