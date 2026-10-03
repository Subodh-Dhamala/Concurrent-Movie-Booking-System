import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

import { ReservationSeat } from "./ReservationSeat";
import { Show } from "./Show";

@Entity("seats")
@Unique("uq_seats_show_id_seat_number", ["showId", "seatNumber"])
export class Seat {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  showId!: string;

  @Column({ type: "varchar", length: 20 })
  seatNumber!: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  section!: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  price!: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => Show, (show) => show.seats, { onDelete: "CASCADE" })
  @JoinColumn({ name: "showId" })
  show!: Show;

  @OneToMany(() => ReservationSeat, (reservationSeat) => reservationSeat.seat)
  reservationSeats!: ReservationSeat[];
}
