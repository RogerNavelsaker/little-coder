# Task: Build Tailored Distroless OCI Images via Nix `dockerTools`

## Context & Architecture
We use **devenv** for local CLI developer tooling (`devenv.yaml` + `devenv.nix`) and **Nix** (`flake.nix` + `pkgs.dockerTools`) to build reproducible, layered, distroless OCI container images.

Do NOT use standard Dockerfiles or base OS distros (Debian, Ubuntu, Alpine). Build closures directly from Nix store paths to ensure zero CVE noise and minimal attack surfaces.

---

## Deliverables

### 1. Update devenv Configuration (`devenv.nix`)
Ensure the development environment has container inspection and publishing tooling available:
- Add `pkgs.skopeo` (for registry inspection/pushing)
- Add `pkgs.dive` (for inspecting generated image layers)
- Use the host Nix installation with flakes support

### 2. Implement Nix Container Images (`flake.nix`)
Define image packages under `packages.<system>` using `pkgs.dockerTools.buildLayeredImage` (or `streamLayeredImage`):

#### A. `warren` (Pure Distroless Service)
- **Closure**: `warren` app binary + `pkgs.cacert` + `pkgs.tzdata`
- **Shell**: None (pure distroless)
- **User**: Non-root (UID 1000:1000)
- **Config**:
  - `Entrypoint = [ "${warren}/bin/warren" ]`
  - `Env = [ "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt" ]`

#### B. `warren-agents` (Tailored Minimal Agent Runtime)
- **Closure**: Agent runtime + *only* explicitly required agent tools (e.g. `pkgs.bashInteractive`, `pkgs.coreutils`, `pkgs.git`, `pkgs.ripgrep`, runtime engine).
- **Security**: No package manager (`apt`/`apk`), minimal attack surface, strict tool pinning via Nix closure.
- **Config**: Set working directory, home directory, and PATH to include packaged tools.

#### C. `ci-runner` (Hermetic CI Execution Image)
- **Closure**: Pinned runner daemon + required build/test toolchain dependencies.
- **Environment**: Hermetic store paths, `/tmp` mount configured.

*(Note: Cloudflare Workers run inside V8 isolates (`workerd`) and do not use OCI images. Only package an image for CF worker deployment tooling / `wrangler` if required).*

---

## Verification Steps
1. Run `nix build .#docker-warren` (or corresponding package name).
2. Load and inspect image:
   ```sh
   docker load < result
   # or inspect structure without docker daemon:
   dive ./result
   ```
3. Verify `warren` has no `/bin/sh` and boots app directly.
4. Verify `warren-agents` contains only declared tool closures on PATH.
5. Verify layer breakdown: shared store paths placed in base layers, app code in top layer.
