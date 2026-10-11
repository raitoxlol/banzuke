# Go live (Convex)

Already done on the box: Convex project `banzuke-61d6b` (team `wright-w`), dev deployment
`fantastic-lapwing-798`, functions pushed, JWT keys, `GITHUB_WEBHOOK_SECRET`, `AUTH_GITHUB_ID/SECRET` set.

- Client URL: `https://fantastic-lapwing-798.ap-southeast-2.convex.cloud`
- Site URL (HTTP actions): `https://fantastic-lapwing-798.ap-southeast-2.convex.site`

## 1. GitHub OAuth app (sign-in)
GitHub → Settings → Developer settings → OAuth Apps → your app:
- **Authorization callback URL:** `https://fantastic-lapwing-798.ap-southeast-2.convex.site/api/auth/callback/github`
- Homepage URL: your Vercel URL

## 2. Vercel
Env vars (Production + Preview):
- `NEXT_PUBLIC_CONVEX_URL=https://fantastic-lapwing-798.ap-southeast-2.convex.cloud`

That's enough for today (Vercel serves the UI, functions are already on the dev deployment).
Optional, to push functions on every deploy: add `CONVEX_DEPLOY_KEY` (Convex dashboard → Settings → Deploy keys)
and set the build command to `npx convex deploy --cmd 'npm run build'` (this targets the prod deployment; redo steps 1, 3, 4 env for prod with `--prod`).

## 3. Point Convex Auth at the site
```
npx convex env set SITE_URL https://<your-app>.vercel.app
```

## 4. GitHub App (real-time, incl. private repos)
GitHub → Settings → Developer settings → GitHub Apps → New:
- Homepage URL: `https://<your-app>.vercel.app`
- **Webhook URL:** `https://fantastic-lapwing-798.ap-southeast-2.convex.site/github/webhook`
- **Webhook secret:** `cat /workspace/.banzuke-webhook-secret` on the box (already set on Convex)
- Permissions: Contents read, Metadata read, Pull requests read. Events: Push, Pull request, Release.
- Where can it be installed: Any account. Then share `https://github.com/apps/<slug>/installations/new` on the join page / slides.

## 5. Optional
- `npx convex env set GITHUB_TOKEN <fine-grained PAT, public read only>`: backfill at 5000 req/h. 80 people × ≤3 calls = 240, so needed only if many join from one IP-less burst (unauthenticated limit is 60/h for the deployment).

## Check
- Open `/join`, sign in → "You're in <stable>" and your 72h shows on `/`.
- `GITHUB_WEBHOOK_SECRET=$(cat /workspace/.banzuke-webhook-secret) node scripts/simulate.mjs <login> https://fantastic-lapwing-798.ap-southeast-2.convex.site/github/webhook --private` → 200, board shows "pushed to a private repo".
- Host tools: `npx convex run room:addPlayer '{"login":"x"}'`, `npx convex run room:removePlayer '{"login":"x"}'`.

New Convex deployment from scratch: `npx convex dev --once --configure new --project banzuke`, `node scripts/convex-auth-keys.mjs`, then the `env set` lines above.
