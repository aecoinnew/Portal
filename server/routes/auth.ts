import bcrypt from "bcrypt";
import { Router } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import type { AuthUser } from "../../lib/types/domain.js";
import { db } from "../db/connection.js";
import { authenticate, jwtSecret, type AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

type UserAuthRow = AuthUser & {
  password_hash: string;
};

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const row = db
      .prepare("SELECT id, name, email, password_hash, role, status FROM users WHERE email = ?")
      .get(body.email) as UserAuthRow | undefined;

    if (!row) {
      throw new ApiError(401, "Incorrect email or password", "invalid_credentials");
    }

    const validPassword = await bcrypt.compare(body.password, row.password_hash);
    if (!validPassword) {
      throw new ApiError(401, "Incorrect email or password", "invalid_credentials");
    }

    if (row.status === "suspended") {
      throw new ApiError(403, "Account is suspended", "account_suspended");
    }

    const user: AuthUser = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status
    };

    const signOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? "8h") as SignOptions["expiresIn"]
    };
    const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret(), signOptions);

    res.json({ token, user });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", authenticate, (req, res) => {
  res.json({ user: (req as AuthedRequest).user });
});
