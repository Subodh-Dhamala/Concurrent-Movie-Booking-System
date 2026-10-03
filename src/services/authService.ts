import bcrypt from "bcrypt";
import type { DataSource } from "typeorm";

import { User, UserRole } from "../entities/User";
import { createError } from "../lib/error";
import { generateToken } from "../lib/jwt";
import { AppDataSource } from "../lib/database";

const SALT_ROUNDS = 12;

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };
}

export async function register(
  username: string,
  email: string,
  password: string,
  dataSource: DataSource = AppDataSource,
) {
  const normalizedUsername = username.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedUsername || !normalizedEmail || !password) {
    throw createError("Username, email, and password are required", 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw createError("A valid email is required", 400);
  }
  if (normalizedUsername.length > 100 || normalizedEmail.length > 255) {
    throw createError("Username or email is too long", 400);
  }
  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    throw createError("Password must be at least 8 characters and no more than 72 UTF-8 bytes", 400);
  }

  const userRepository = dataSource.getRepository(User);
  const existingUser = await userRepository.findOne({ where: { email: normalizedEmail } });
  if (existingUser) {
    throw createError("User already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const user = userRepository.create({
    username: normalizedUsername,
    email: normalizedEmail,
    password: hashedPassword,
    role: UserRole.USER,
  });

  try {
    const savedUser = await userRepository.save(user);
    return { user: toPublicUser(savedUser), token: generateToken(savedUser.id) };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw createError("User already exists", 409);
    }
    throw error;
  }
}

export async function login(
  email: string,
  password: string,
  dataSource: DataSource = AppDataSource,
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw createError("Email and password are required", 400);
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw createError("Invalid email or password", 401);
  }

  const user = await dataSource.getRepository(User).findOne({
    where: { email: normalizedEmail },
  });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw createError("Invalid email or password", 401);
  }

  return { user: toPublicUser(user), token: generateToken(user.id) };
}
