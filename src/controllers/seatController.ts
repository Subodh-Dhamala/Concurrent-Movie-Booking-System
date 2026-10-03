import { Body, Controller, Get, Path, Post, Route, Tags } from "tsoa";

import { Seat } from "../entities/Seat";
import { AppDataSource } from "../lib/database";
import { createError } from "../lib/error";
import { createSeatsForShow, type CreateSeatInput } from "../services/seatService";

interface SeatBody {
  seatNumber?: string;
  section?: string | null;
  price?: number;
}

interface CreateSeatsBody extends SeatBody {
  seats?: SeatBody[];
}

@Route("shows/{showId}/seats")
@Tags("Seats")
export class SeatController extends Controller {
  @Get()
  public async getSeatsForShow(@Path() showId: string): Promise<Seat[]> {
    return AppDataSource.getRepository(Seat).find({
      where: { showId },
      order: { seatNumber: "ASC" },
    });
  }

  @Post()
  public async createSeatsForShow(
    @Path() showId: string,
    @Body() body: CreateSeatsBody,
  ): Promise<Seat[]> {
    const requestedSeats: SeatBody[] = body.seats ?? [
      { seatNumber: body.seatNumber, section: body.section, price: body.price },
    ];
    if (
      requestedSeats.some(
        (seat) =>
          typeof seat.seatNumber !== "string" ||
          !seat.seatNumber.trim() ||
          (seat.price !== undefined && (!Number.isFinite(seat.price) || seat.price < 0)),
      )
    ) {
      throw createError("Every seat needs a seatNumber and a non-negative price", 400);
    }

    const seats: CreateSeatInput[] = requestedSeats.map((seat) => ({
      seatNumber: seat.seatNumber!,
      section: seat.section,
      price: seat.price,
    }));
    const createdSeats = await AppDataSource.manager.transaction((manager) =>
      createSeatsForShow(manager, showId, seats),
    );
    this.setStatus(201);
    return createdSeats;
  }
}
