import jwt, { SignOptions } from "jsonwebtoken";

const SECRET: string = process.env.JWT_SECRET || "dev";

export type JwtClaims = { sub: string };

export function sign(userId: string) {
  const options: SignOptions = { algorithm: "HS256", expiresIn: "30m" as const };
  return jwt.sign({ sub: userId }, SECRET, options);
}


export function verify(token: string): JwtClaims {
  return jwt.verify(token, SECRET) as JwtClaims;
}

// Use shorter JWT expiry and refresh
const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";
// Issue refresh tokens and an endpoint to rotate them
