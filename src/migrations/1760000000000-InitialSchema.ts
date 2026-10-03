import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1760000000000 implements MigrationInterface {
  name = "InitialSchema1760000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "users_role_enum" AS ENUM ('USER', 'ADMIN')`);
    await queryRunner.query(
      `CREATE TYPE "reservations_status_enum" AS ENUM ('HELD', 'CONFIRMED', 'EXPIRED', 'CANCELLED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "username" character varying(100) NOT NULL,
        "email" character varying(255) NOT NULL,
        "password" character varying(255) NOT NULL,
        "role" "users_role_enum" NOT NULL DEFAULT 'USER',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "shows" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" character varying(255) NOT NULL,
        "hall" character varying(100) NOT NULL,
        "showTime" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shows_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "seats" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "showId" uuid NOT NULL,
        "seatNumber" character varying(20) NOT NULL,
        "section" character varying(50),
        "price" numeric(10,2) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_seats_id" PRIMARY KEY ("id"),
        CONSTRAINT "uq_seats_show_id_seat_number" UNIQUE ("showId", "seatNumber"),
        CONSTRAINT "FK_seats_showId" FOREIGN KEY ("showId")
          REFERENCES "shows"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reservations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "status" "reservations_status_enum" NOT NULL DEFAULT 'HELD',
        "expiresAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reservations_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reservations_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reservation_seats" (
        "reservationId" uuid NOT NULL,
        "seatId" uuid NOT NULL,
        CONSTRAINT "PK_reservation_seats" PRIMARY KEY ("reservationId", "seatId"),
        CONSTRAINT "FK_reservation_seats_reservationId" FOREIGN KEY ("reservationId")
          REFERENCES "reservations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reservation_seats_seatId" FOREIGN KEY ("seatId")
          REFERENCES "seats"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_reservations_status_expiresAt" ON "reservations" ("status", "expiresAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_reservation_seats_seatId" ON "reservation_seats" ("seatId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_reservation_seats_seatId"`);
    await queryRunner.query(`DROP INDEX "IDX_reservations_status_expiresAt"`);
    await queryRunner.query(`DROP TABLE "reservation_seats"`);
    await queryRunner.query(`DROP TABLE "reservations"`);
    await queryRunner.query(`DROP TABLE "seats"`);
    await queryRunner.query(`DROP TABLE "shows"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "reservations_status_enum"`);
    await queryRunner.query(`DROP TYPE "users_role_enum"`);
  }
}
