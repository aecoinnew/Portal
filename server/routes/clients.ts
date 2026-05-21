import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import type { UserRole, UserStatus } from "../../lib/types/domain.js";
import { db, nowIso, uid } from "../db/connection.js";
import { authenticate, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { auditLog } from "../services/auditService.js";
import { mapClient } from "../services/mappers.js";

export const clientsRouter = Router();

clientsRouter.use(authenticate, requireAdmin);

const userCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(10),
  role: z.enum(["client", "admin"]).default("client"),
  status: z.enum(["active", "suspended"]).default("active"),
  phone: z.string().optional().nullable(),
  relationshipManager: z.string().optional().nullable()
});

const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(10).optional(),
  role: z.enum(["client", "admin"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  phone: z.string().optional().nullable(),
  relationshipManager: z.string().optional().nullable()
});

clientsRouter.get("/", (req, res) => {
  const role = req.query.role === "admin" ? "admin" : "client";
  const rows = db
    .prepare(
      `
      SELECT id, name, email, role, status, phone, relationship_manager, created_at, updated_at
      FROM users
      WHERE role = ?
      ORDER BY name
      `
    )
    .all(role) as Array<Record<string, unknown>>;

  res.json({ clients: rows.map(mapClient) });
});

clientsRouter.post("/", async (req, res, next) => {
  try {
    const body = userCreateSchema.parse(req.body);
    const admin = (req as unknown as AuthedRequest).user;
    const id = uid("usr");
    const timestamp = nowIso();
    const passwordHash = await bcrypt.hash(body.password, 12);

    db.prepare(
      `
      INSERT INTO users
      (id, name, email, password_hash, role, status, phone, relationship_manager, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      id,
      body.name,
      body.email,
      passwordHash,
      body.role,
      body.status,
      body.phone ?? null,
      body.relationshipManager ?? null,
      timestamp,
      timestamp
    );

    auditLog(admin, "user.created", "user", id, {
      email: body.email,
      role: body.role,
      status: body.status
    });

    const row = db
      .prepare("SELECT id, name, email, role, status, phone, relationship_manager, created_at, updated_at FROM users WHERE id = ?")
      .get(id) as Record<string, unknown>;

    res.status(201).json({ client: mapClient(row) });
  } catch (error) {
    if (String(error).includes("UNIQUE constraint failed")) {
      return next(new ApiError(409, "Email already exists", "email_exists"));
    }
    next(error);
  }
});

clientsRouter.get("/:id", (req, res, next) => {
  const row = db
    .prepare("SELECT id, name, email, role, status, phone, relationship_manager, created_at, updated_at FROM users WHERE id = ?")
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!row) return next(new ApiError(404, "Client not found", "client_not_found"));
  return res.json({ client: mapClient(row) });
});

clientsRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = userUpdateSchema.parse(req.body);
    const admin = (req as unknown as AuthedRequest).user;
    const existing = db.prepare("SELECT id, role, status FROM users WHERE id = ?").get(req.params.id) as
      | { id: string; role: UserRole; status: UserStatus }
      | undefined;

    if (!existing) throw new ApiError(404, "Client not found", "client_not_found");

    const updates: string[] = [];
    const values: unknown[] = [];

    const set = (column: string, value: unknown) => {
      updates.push(`${column} = ?`);
      values.push(value);
    };

    if (body.name !== undefined) set("name", body.name);
    if (body.email !== undefined) set("email", body.email);
    if (body.role !== undefined) set("role", body.role);
    if (body.status !== undefined) set("status", body.status);
    if (body.phone !== undefined) set("phone", body.phone);
    if (body.relationshipManager !== undefined) set("relationship_manager", body.relationshipManager);
    if (body.password !== undefined) set("password_hash", await bcrypt.hash(body.password, 12));

    if (updates.length > 0) {
      set("updated_at", nowIso());
      db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values, req.params.id);
      auditLog(admin, "user.updated", "user", req.params.id, {
        fields: Object.keys(body)
      });
    }

    const row = db
      .prepare("SELECT id, name, email, role, status, phone, relationship_manager, created_at, updated_at FROM users WHERE id = ?")
      .get(req.params.id) as Record<string, unknown>;

    res.json({ client: mapClient(row) });
  } catch (error) {
    if (String(error).includes("UNIQUE constraint failed")) {
      return next(new ApiError(409, "Email already exists", "email_exists"));
    }
    next(error);
  }
});
