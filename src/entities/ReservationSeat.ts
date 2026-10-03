import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";

import { Reservation } from "./Reservation";
import { Seat } from "./Seat";

@Entity("reservation_seats")
export class ReservationSeat {
  @PrimaryColumn({ type: "uuid" })
  reservationId!: string;

  @PrimaryColumn({ type: "uuid" })
  seatId!: string;

  @ManyToOne(() => Reservation, (reservation) => reservation.seats, { onDelete: "CASCADE" })
  @JoinColumn({ name: "reservationId" })
  reservation!: Reservation;

  @ManyToOne(() => Seat, (seat) => seat.reservationSeats, { onDelete: "CASCADE" })
  @JoinColumn({ name: "seatId" })
  seat!: Seat;
}
