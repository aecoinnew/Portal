import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  db,
  resolveStatementPath,
  statementsDir,
  statementsQuarantineDir,
  uid
} from "../db/connection.js";
import { authenticate, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { auditLog } from "../services/auditService.js";
import { submitForApproval } from "../services/approvalExecutor.js";
import { mapStatement } from "../services/mappers.js";

export const statementsRouter = Router();

const uploadBodySchema = z.object({
  userId: z.string().min(1),
  period: z.string().min(2).max(80)
});

// Phase 3: uploads land in quarantine. They are NOT visible to clients until executed.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, statementsQuarantineDir),
  filename: (_req, file, cb) => {
    const clean = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-");
    cb(null, `${uid("stmtfile")}-${clean}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf" && !file.originalname.toLowerCase().endsWith(".pdf")) {
      cb(new ApiError(400, "Only PDF statements are allowed", "pdf_required"));
      return;
    }
    cb(null, true);
  }
});

statementsRouter.use(authenticate);

statementsRouter.get("/", (req, res) => {
  const user = (req as unknown as AuthedRequest).user;
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : null;
  const filters: string[] = [];
  const values: unknown[] = [];

  if (user.role !== "admin") {
    filters.push("s.user_id = ?");
    values.push(user.id);
  } else if (clientId) {
    filters.push("s.user_id = ?");
    values.push(clientId);
  }

  const rows = db
    .prepare(
      `
      SELECT s.*, u.name AS client_name
      FROM statements s
      JOIN users u ON u.id = s.user_id
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY s.created_at DESC
      `
    )
    .all(...values) as Array<Record<string, unknown>>;

  res.json({ statements: rows.map(mapStatement) });
});

// Phase 3: upload to quarantine, submit for approval. Statement record is NOT
// inserted into the statements table until execution.
statementsRouter.post("/", requireAdmin, upload.single("file"), (req, res, next) => {
  try {
    const body = uploadBodySchema.parse(req.body);
    const admin = (req as unknown as AuthedRequest).user;
    const file = req.file;

    if (!file) throw new ApiError(400, "Statement PDF is required", "file_required");
    assertClient(body.userId);

    // Sanity-check that the file is actually inside the quarantine dir.
    const quarantinePath = path.resolve(file.path);
    if (!quarantinePath.startsWith(statementsQuarantineDir + path.sep)) {
      // multer should have placed it there; bail safely
      try { fs.unlinkSync(file.path); } catch { /* ignore */ }
      throw new ApiError(500, "Upload did not land in quarantine", "quarantine_violation");
    }

    const statementId = uid("stmt");
    const approval = submitForApproval({
      entityType: "statement",
      entityId: statementId,
      action: "statement.uploaded",
      requestedBy: admin,
      beforePayload: null,
      afterPayload: {
        userId: body.userId,
        period: body.period,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        quarantinePath
      },
      reason: `Statement upload for client ${body.userId}, period ${body.period}`
    });

    auditLog(admin, "statement.upload.submitted", "statement", statementId, {
      approvalId: approval.id,
      userId: body.userId,
      period: body.period,
      fileName: file.originalname,
      fileSize: file.size
    });

    res.status(202).json({
      pending: true,
      approvalId: approval.id,
      statementId,
      message: "Statement uploaded to quarantine. Awaiting approval before publication."
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
    next(error);
  }
});

statementsRouter.get("/:id/download", (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const row = db
      .prepare("SELECT id, user_id, file_name, file_path FROM statements WHERE id = ?")
      .get(req.params.id) as { id: string; user_id: string; file_name: string; file_path: string } | undefined;

    if (!row) throw new ApiError(404, "Statement not found", "statement_not_found");
    if (user.role !== "admin" && row.user_id !== user.id) {
      throw new ApiError(403, "Cannot access another client's statement", "ownership_required");
    }

    const resolved = resolveStatementPath(row.file_path);
    if (!fs.existsSync(resolved)) throw new ApiError(404, "Statement file not found", "statement_file_not_found");

    res.setHeader("Content-Type", "application/pdf");
    res.download(resolved, path.basename(row.file_name));
  } catch (error) {
    next(error);
  }
});

statementsRouter.delete("/:id", requireAdmin, (req, res, next) => {
  try {
    const admin = (req as unknown as AuthedRequest).user;
    const row = db
      .prepare("SELECT id, user_id, file_path FROM statements WHERE id = ?")
      .get(req.params.id) as { id: string; user_id: string; file_path: string } | undefined;

    if (!row) throw new ApiError(404, "Statement not found", "statement_not_found");

    const approval = submitForApproval({
      entityType: "statement",
      entityId: req.params.id,
      action: "statement.deleted",
      requestedBy: admin,
      beforePayload: { userId: row.user_id, filePath: row.file_path },
      afterPayload: null,
      reason: `Statement ${req.params.id} delete`
    });

    auditLog(admin, "statement.delete.submitted", "statement", req.params.id, {
      approvalId: approval.id
    });

    res.status(202).json({ pending: true, approvalId: approval.id });
  } catch (error) {
    next(error);
  }
});

function assertClient(userId: string) {
  const row = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'client'").get(userId);
  if (!row) throw new ApiError(400, "Client not found", "client_not_found");
}
