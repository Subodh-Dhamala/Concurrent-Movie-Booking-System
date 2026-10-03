import type { EntityManager } from "typeorm";

import { Reservation, ReservationStatus } from "../entities/Reservation";
import { ReservationSeat } from "../entities/ReservationSeat";
import { Seat } from "../entities/Seat";
import { User } from "../entities/User";
import { createError } from "../lib/error";

export interface CreateReservationInput {
  userId: string;
  showId: string;
  seatIds: string[];
}

export async function createReservation(
  manager: EntityManager,
  { userId, showId, seatIds }: CreateReservationInput,
): Promise<{ reservation: Reservation; seatIds: string[] }> {
  if (!userId || !showId || seatIds.length === 0) {
    throw createError("userId, showId, and at least one seatId are required", 400);
  }

  if (new Set(seatIds).size !== seatIds.length) {
    throw createError("Duplicate seat selections are not allowed", 400);
  }

  const userExists = await manager.getRepository(User).exists({ where: { id: userId } });
  if (!userExists) {
    throw createError("User does not exist", 404);
  }

  const sortedSeatIds = [...seatIds].sort();
  const lockedSeats = await manager
    .createQueryBuilder(Seat, "seat")
    .where("seat.id IN (:...seatIds)", { seatIds: sortedSeatIds })
    .andWhere('seat."showId" = :showId', { showId })
    .orderBy("seat.id", "ASC")
    .setLock("pessimistic_write")
    .getMany();

  if (lockedSeats.length !== seatIds.length) {
    throw createError("One or more selected seats do not exist for this show", 404);
  }

  const now = new Date();
  await manager
    .createQueryBuilder()
    .update(Reservation)
    .set({ status: ReservationStatus.EXPIRED })
    .where(
      `id IN (
        SELECT reservation_seat."reservationId"
        FROM reservation_seats reservation_seat
        WHERE reservation_seat."seatId" IN (:...seatIds)
      )`,
      { seatIds: sortedSeatIds },
    )
    .andWhere('"status" = :held', { held: ReservationStatus.HELD })
    .andWhere('"expiresAt" IS NOT NULL')
    .andWhere('"expiresAt" <= :now', { now })
    .execute();

  const activeReservationSeat = await manager
    .getRepository(ReservationSeat)
    .createQueryBuilder("reservationSeat")
    .innerJoin("reservationSeat.reservation", "reservation")
    .where("reservationSeat.seatId IN (:...seatIds)", { seatIds: sortedSeatIds })
    .andWhere(
      "(reservation.status = :confirmed OR (reservation.status = :held AND (reservation.expiresAt IS NULL OR reservation.expiresAt > :now)))",
      {
        confirmed: ReservationStatus.CONFIRMED,
        held: ReservationStatus.HELD,
        now,
      },
    )
    .getOne();

  if (activeReservationSeat) {
    throw createError("One or more selected seats are already reserved", 409);
  }

  const reservation = manager.create(Reservation, {
    userId,
    status: ReservationStatus.HELD,
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
  });
  const savedReservation = await manager.save(reservation);

  const reservationSeatRows = seatIds.map((seatId) =>
    manager.create(ReservationSeat, {
      reservationId: savedReservation.id,
      seatId,
    }),
  );
  await manager.save(reservationSeatRows);

  return { reservation: savedReservation, seatIds };
}

export async function confirmReservation(
  manager: EntityManager,
  reservationId: string,
  userId: string,
): Promise<Reservation> {
  const reservation = await getOwnedReservation(manager, reservationId, userId);

  if (reservation.status === ReservationStatus.CONFIRMED) {
    throw createError("Reservation already confirmed", 409);
  }
  if (reservation.status === ReservationStatus.EXPIRED) {
    throw createError("Reservation expired", 410);
  }
  if (reservation.status === ReservationStatus.CANCELLED) {
    throw createError("Reservation already cancelled", 409);
  }
  if (reservation.expiresAt && reservation.expiresAt.getTime() <= Date.now()) {
    throw createError("Reservation expired", 410);
  }

  reservation.status = ReservationStatus.CONFIRMED;
  reservation.expiresAt = null;
  return manager.save(reservation);
}

export async function cancelReservation(
  manager: EntityManager,
  reservationId: string,
  userId: string,
): Promise<Reservation> {
  const reservation = await getOwnedReservation(manager, reservationId, userId);

  if (reservation.status === ReservationStatus.CONFIRMED) {
    throw createError("Reservation already confirmed", 409);
  }
  if (reservation.status === ReservationStatus.EXPIRED) {
    throw createError("Reservation expired", 410);
  }
  if (reservation.status === ReservationStatus.CANCELLED) {
    throw createError("Reservation already cancelled", 409);
  }
  if (reservation.expiresAt && reservation.expiresAt.getTime() <= Date.now()) {
    throw createError("Reservation expired", 410);
  }

  reservation.status = ReservationStatus.CANCELLED;
  reservation.expiresAt = null;
  return manager.save(reservation);
}

export async function expireDueReservations(manager: EntityManager): Promise<number> {
  const result = await manager
    .getRepository(Reservation)
    .createQueryBuilder()
    .update(Reservation)
    .set({ status: ReservationStatus.EXPIRED })
    .where('"status" = :status', { status: ReservationStatus.HELD })
    .andWhere('"expiresAt" IS NOT NULL')
    .andWhere('"expiresAt" <= CURRENT_TIMESTAMP')
    .execute();

  return result.affected ?? 0;
}

async function getOwnedReservation(
  manager: EntityManager,
  reservationId: string,
  userId: string,
): Promise<Reservation> {
  if (!reservationId || !userId) {
    throw createError("reservationId and userId are required", 400);
  }

  const reservation = await manager.getRepository(Reservation).findOne({
    where: { id: reservationId },
    lock: { mode: "pessimistic_write" },
  });

  if (!reservation) {
    throw createError("Reservation not found", 404);
  }
  if (reservation.userId !== userId) {
    throw createError("Reservation does not belong to this user", 403);
  }

  return reservation;
}
