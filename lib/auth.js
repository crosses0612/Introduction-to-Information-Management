import jwt from "jsonwebtoken";
import { ApiError } from "./apiError.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-this";

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: "2h" }
  );
}

export function getUserFromRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    throw new ApiError(401, "Unauthorized");
  }

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    throw new ApiError(401, "Invalid token");
  }
}

export function assertRole(user, role) {
  if (!user || user.role !== role) {
    throw new ApiError(403, "Forbidden");
  }
}
