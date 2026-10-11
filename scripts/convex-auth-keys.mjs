// Generates Convex Auth JWT keys and sets them on the current Convex deployment (non-interactive `npx @convex-dev/auth`).
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { execFileSync } from "node:child_process";
const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
const priv = (await exportPKCS8(privateKey)).trimEnd().replace(/\n/g, " ");
const jwks = JSON.stringify({ keys: [{ use: "sig", ...(await exportJWK(publicKey)) }] });
const prod = process.argv.includes("--prod") ? ["--prod"] : [];
execFileSync("npx", ["convex", "env", "set", ...prod, "--", "JWT_PRIVATE_KEY", priv], { stdio: "inherit" });
execFileSync("npx", ["convex", "env", "set", ...prod, "--", "JWKS", jwks], { stdio: "inherit" });
