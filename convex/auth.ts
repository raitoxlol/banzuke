import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";

// Env on the Convex deployment: AUTH_GITHUB_ID, AUTH_GITHUB_SECRET, SITE_URL (+ JWT keys from `npx @convex-dev/auth`).
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [GitHub({
    profile: (p) => ({ id: String(p.id), name: p.name ?? p.login, image: p.avatar_url, email: p.email ?? undefined, githubLogin: p.login }),
  })],
});
