import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { ReservationSeat } from "./ReservationSeat";
import { User } from "./User";

export enum ReservationStatus {
  HELD = "HELD",
  CONFIRMED = "CONFIRMED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
}

@Entity("reservations")
export class Reservation {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "enum", enum: ReservationStatus, default: ReservationStatus.HELD })
  status!: ReservationStatus;

  @Column({ type: "timestamptz", nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.reservations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @OneToMany(() => ReservationSeat, (reservationSeat) => reservationSeat.reservation)
  seats!: ReservationSeat[];
}
