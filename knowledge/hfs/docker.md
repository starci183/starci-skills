# The image canon

Every app builds its own image. This is the pattern; `slots.yaml` (`repo.app-image`, `app.dockerignore`, `app.ci-images`) and the
rules R187 to R191 (`HFS_DOCKER_*`, `scripts/hfs/rules/docker.mjs`) enforce it, and `starci app scaffold` writes it. It is adapted from the
Dockerfiles of the nivo back end and front end to the shape of an app: one `package.json` and one lockfile at the app root, a Nest
monorepo of back-end apps (the `be.app.*` slots) and an npm-workspaces monorepo of front-end apps and packages (`fe.app.next`, `repo.packages`).

## What stays from the nivo images

- The build context is the context root, here the APP ROOT: `starci docker build <app>`. The header
  comment of every Dockerfile states that verb, and states every deliberate divergence from this canon.
- Multi-stage: a `build` stage installs and builds, a last `runtime` stage ships only what it needs. `npm ci`, never `npm install`.
- The runtime is unprivileged (`USER node`), exposes the port it serves and answers a healthcheck.
- The base is pinned: an exact node version on an exact alpine release (`NODE_IMAGE` in `scripts/hfs/rules/docker.mjs`, one pin for the
  family), or an image pinned by digest. Any extra stage (a downloaded binary) is checksum-verified.
- No secret is built in. The `.dockerignore` (slot `app.dockerignore`) keeps the secret-bearing slots (`app.plaintext-env`,
  `app.starcistacks`) out of the context itself (a file that is never copied is still uploaded to the daemon and cached);
  credentials are mounted at run time.

## What differs in this shape

- One `.dockerignore`, at the app root, rendered by `starci app sync` (`templates/app/docker-ignore`). Every image shares it.
- The workspace manifests come first. The lockfile lists every fe workspace, so `starci npm ci` needs their `package.json` files: a `manifests`
  stage copies the root manifests and the `fe/` tree and deletes every file but `package.json`, and the build and runtime stages start from it.
  The install layer is cached until a manifest changes.
- A be image (api, worker, cli): `starci docker build <app>` runs tsc and tsc-alias into `be/dist`, from `be/tsconfig.build.json`, in the build stage;
  `starci npm ci` supplies the clean lockfile install, while the runtime keeps only production dependencies, ignores lifecycle scripts and copies `be/dist`. The entry is `node be/dist/apps/<app>/src/main.js`.
  - api: `ENV PORT`, `EXPOSE` the same port, a HEALTHCHECK of `/health/live`.
  - worker: no listener, a process HEALTHCHECK.
  - cli (and the migrate kind): one image for every one-off action, run with the command as arguments (`migrate run`): `ENTRYPOINT` is the
    entry, `CMD ["--help"]`, `HEALTHCHECK NONE`, no `EXPOSE`.
- An fe image (Next): the build stage copies the contract snapshots (`be.contract.*`), the packages (`repo.packages`), `scripts`
  (slot `app.scripts`, the codegen) and its own app (`fe.app.next`), runs
  `starci docker build <app>` runs code generation and the filtered turbo build; `next.config.ts` sets `output: "standalone"` and pins
  `outputFileTracingRoot` to the app root. The runtime copies `.next/standalone`, `.next/static` and `public`, installs nothing, and starts
  `node` on the standalone `server.js` of the app. `NEXT_PUBLIC_*` values are the one kind of build argument (they are published to every browser by design).
- The Dockerfile is app-owned: scaffold writes it once, the app edits it (a system package, a build argument), and the rules judge its
  structure. The `.dockerignore` and the images workflow (`<repo>/.github/workflows/images.yml`) are managed (drift is `HFS_MANAGED_FILE_DRIFT`).
- The root scripts `docker:build:<app>` (the exact command the header states, tag `<project>/<app>:dev`) and `docker:build` (every image, one after the other)
  are managed by `starci app sync`; none pushes.
- CI builds every image on pull requests and on main, path-filtered per app (`images.yml`: a matrix of image, Dockerfile and paths), and
  never pushes. Publishing an image is the product's decision.

## The rules

| Rule | Code | Judges |
| --- | --- | --- |
| R187 | `HFS_DOCKER_BUILD_CONTEXT` | the header names the app's own build command; no COPY or ADD source leaves the context |
| R188 | `HFS_DOCKER_STAGES` | `build` then `runtime`; `USER node`; no build in the runtime; `starci npm ci`; the install flags of each side |
| R189 | `HFS_DOCKER_ENTRY` | the app's own entry; port, EXPOSE and HEALTHCHECK by kind; the standalone output of a Next app |
| R190 | `HFS_DOCKER_BASE_PIN` | every FROM is a prior stage, the canon node image or a digest-pinned image |
| R191 | `HFS_DOCKER_SECRETS` | no secret file, URL download or credential-named ARG or ENV |
