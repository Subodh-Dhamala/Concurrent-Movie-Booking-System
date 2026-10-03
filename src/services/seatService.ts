import type { EntityManager } from "typeorm";

import { Seat } from "../entities/Seat";
import { Show } from "../entities/Show";
import { createError } from "../lib/error";

export interface CreateSeatInput {
  seatNumber: string;
  section?: string | null;
  price?: number;
}

export async function createSeatsForShow(
  manager: EntityManager,
  showId: string,
  seats: CreateSeatInput[],
): Promise<Seat[]> {
  if (!showId) {
    throw createError("showId is required", 400);
  }

  if (!Array.isArray(seats) || seats.length === 0) {
    throw createError("At least one seat is required", 400);
  }

  const showExists = await manager.getRepository(Show).exists({ where: { id: showId } });
  if (!showExists) {
    throw createError("Show does not exist", 404);
  }

  const existingSeats = await manager.getRepository(Seat).find({
    where: { showId },
  });

  const existingNumbers = new Set(existingSeats.map((seat) => seat.seatNumber));
  const seen = new Set<string>();
  const invalidSeatNumbers: string[] = [];

  seats.forEach((seat) => {
    const seatNumber = seat.seatNumber?.trim();
    if (!seatNumber) {
      invalidSeatNumbers.push("empty");
      return;
    }

    if (existingNumbers.has(seatNumber) || seen.has(seatNumber)) {
      invalidSeatNumbers.push(seatNumber);
      return;
    }

    seen.add(seatNumber);
  });

  if (invalidSeatNumbers.length > 0) {
    throw createError(
      `Duplicate or invalid seat numbers detected: ${invalidSeatNumbers.join(", ")}`,
      409,
    );
  }

  const seatRecords = seats.map((seat) =>
    manager.getRepository(Seat).create({
      showId,
      seatNumber: seat.seatNumber.trim(),
      section: seat.section ?? null,
      price: Number(seat.price ?? 0),
    }),
  );

  return manager.getRepository(Seat).save(seatRecords);
}
