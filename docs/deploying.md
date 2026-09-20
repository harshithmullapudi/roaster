# Deploying

The root `Dockerfile` builds the web app into a self-contained image. Build
context is the repository root, not `apps/web` — the workspace packages are
consumed as TypeScript source.

```bash
docker build -t roster-web --build-arg NEXT_PUBLIC_APP_URL=https://roster.example.com .
docker run -p 3000:3000 --env-file .env roster-web
```

On [Railway](https://railway.com), point a service at this repo — `railway.json`
already selects the Dockerfile builder — then:

1. **Add a Postgres database**, and set `DATABASE_URL` to its connection string.
2. **Set the rest** from `.env.example`: `BETTER_AUTH_SECRET`,
   `SUPERSET_KEY_SECRET`, and, once the service has a domain,
   `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL`. The first of those is baked into
   the browser bundle at build time, so **changing it needs a rebuild, not a
   restart.**
3. **Nothing, for the schema.** The service migrates itself on boot, and a
   database from before migrations existed is adopted on that same boot.
4. **Mount a volume at `/app/uploads`** — where the image points `UPLOADS_DIR`.
   Without one, a redeploy throws the files away and leaves the rows, so every
   preview 404s. `docker-entrypoint.sh` re-owns the mount before dropping to
   `nextjs`, so this needs no `RAILWAY_RUN_UID=0`.

   A volume costs something: **it rules out replicas**, a redeploy blips while
   the mount changes hands, and a service gets exactly one — 0.5 GB on Free,
   5 GB on Hobby, 50 GB on Pro. Outgrowing that means object storage;
   `packages/api/src/services/attachments.ts` is the only module touching disk.
5. **Centrifugo is optional.** Leave `CENTRIFUGO_*` empty and realtime turns
   itself off, falling back to plain tRPC. To wire it up, run it as a second
   service with `CENTRIFUGO_URL` set to its private URL and declare all three
   namespaces — a publish to one Centrifugo does not know is rejected, and a
   missing `user` makes the unread dot lag by a poll:

   ```
   CENTRIFUGO_CHANNEL_NAMESPACES=[{"name":"channel","presence":true,"history_size":300,"history_ttl":"30m","force_recovery":true},{"name":"thread","presence":false,"history_size":300,"history_ttl":"30m","force_recovery":true},{"name":"user","presence":false,"history_size":100,"history_ttl":"30m","force_recovery":true}]
   ```

`PORT` comes from the environment, which is how Railway routes to the container.
