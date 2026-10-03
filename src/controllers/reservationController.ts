import { Body, Controller, Path, Post, Request, Route, Security, Tags } from "tsoa";
import type { Request as ExpressRequest } from "express";

import { AppDataSource } from "../lib/database";
import { createError } from "../lib/error";
import {
  cancelReservation,
  confirmReservation,
  createReservation,
} from "../services/reservationService";

interface CreateReservationBody {
  showId: string;
  seatIds: string[];
}

interface AuthenticatedRequest extends ExpressRequest {
  auth?: { userId: string };
}

@Route("reservations")
@Tags("Reservations")
export class ReservationController extends Controller {
  @Post()
  @Security("jwt")
  public async create(
    @Request() request: AuthenticatedRequest,
    @Body() body: CreateReservationBody,
  ) {
    const userId = request.auth?.userId;
    if (!userId) {
      throw createError("Authentication required", 401);
    }

    const result = await AppDataSource.manager.transaction((manager) =>
      createReservation(manager, {
        userId,
        showId: body.showId,
        seatIds: body.seatIds,
      }),
    );
    this.setStatus(201);
    return { message: "Reservation held successfully", ...result };
  }

  @Post("{reservationId}/confirm")
  @Security("jwt")
  public async confirm(
    @Request() request: AuthenticatedRequest,
    @Path() reservationId: string,
  ) {
    const userId = request.auth?.userId;
    if (!userId) {
      throw createError("Authentication required", 401);
    }

    const reservation = await AppDataSource.manager.transaction((manager) =>
      confirmReservation(manager, reservationId, userId),
    );
    return { message: "Reservation confirmed", reservation };
  }

  @Post("{reservationId}/cancel")
  @Security("jwt")
  public async cancel(
    @Request() request: AuthenticatedRequest,
    @Path() reservationId: string,
  ) {
    const userId = request.auth?.userId;
    if (!userId) {
      throw createError("Authentication required", 401);
    }

    const reservation = await AppDataSource.manager.transaction((manager) =>
      cancelReservation(manager, reservationId, userId),
    );
    return { message: "Reservation cancelled", reservation };
  }
}
