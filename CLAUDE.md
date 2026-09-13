# Working in this repo

## Production secrets: never read their values

**Do not read, print, or otherwise cause the display of the value of any
production environment variable or secret.** This applies to the Convex
deployment, the VM's `.env`, the container environment, Portainer, GitHub
Actions secrets, and anything else holding real credentials.

Checking that a variable **exists** is allowed — but only when it is genuinely
necessary to answer the question at hand, and only in a form that cannot print
the value. Otherwise work from `.env.example`, which carries every variable
name, its shape, and a note on what it is for. That file is the reference; the
real values are not.

### Forbidden

These print values. Do not run them, or any variation of them, against
production:

```
npx convex env list --prod
npx convex env get <NAME> --prod
docker exec <container> env
docker exec <container> printenv
docker inspect <container>          # .Config.Env contains every value
cat .env  /  cat .env.local  /  cat .env.production
echo "$SOME_SECRET"
```

Reading `.env.example` is fine and encouraged — it contains only placeholders.

### Allowed, when necessary

Prefer the application's own report, which is designed for this and publishes a
boolean rather than names:

```
curl -s https://commit.kunjdeveloper.com/api/health
```

`integrations.auth` says whether sign-in is configured. When it is false, the
**container log** names what is missing — the endpoint deliberately does not,
because it is public. See `src/lib/auth/readiness.ts`.

If a per-variable existence check is genuinely required, it must print names
only, and it must be **one line**:

```
docker exec commit sh -c 'for v in AUTH_SECRET AUTH_JWT_KID; do [ -n "$(printenv $v)" ] && echo "$v set" || echo "$v MISSING"; done'
```

Never break a command like that across lines when handing it to someone to
paste. A wrapped `[ -n` is split from its `]`, the test becomes a syntax error,
and the shell then executes each **value** as a command — printing the secrets
it was written to avoid printing.

### Why this rule exists

Both of these happened in this repo, in a single session:

1. `npx convex env list --prod` was run to check whether a variable was set. It
   printed every production value, including `AUTH_JWT_PRIVATE_KEY` — a key that
   can mint a valid Convex token for any user. Five secrets needed rotating.
2. A multi-line existence check was pasted into a terminal, wrapped, and
   executed the values. The Google and GitHub OAuth client secrets were
   disclosed and needed rotating.

Neither was necessary. In both cases the question was "is this set?", and in
both cases the answer was available without the value — from `/api/health`, from
the application's own behaviour, or from a correctly written one-line check.

A leaked secret cannot be unleaked. It has to be rotated, on a live system,
usually in a hurry. The cost of being careful here is a few seconds; the cost of
not being is an unplanned rotation of production credentials.

## Related

- `.env.example` — every variable, with placeholders and notes.
- `src/lib/auth/readiness.ts` — what "configured" means for auth, and why the
  health endpoint reports a boolean rather than a list of names.
- `docs/HANDOFF.md` — deployment topology, and the owner-only actions.
