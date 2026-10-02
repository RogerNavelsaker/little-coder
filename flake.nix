{
  description = "little-coder — bun-built Pi distribution";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    flyscrape = {
      url = "github:RogerNavelsaker/nixpkg-flyscrape";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    linehash = {
      url = "github:RogerNavelsaker/nixpkg-linehash/2175affcf7a576fe25b6f8f2d8e87f04fe2db359";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, flyscrape, linehash }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ]
      (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          flyscrapePkg = flyscrape.packages.${system}.default;
          linehashPkg = linehash.packages.${system}.default;

          # Pre-built release binaries (update sha256 per release).
          # Set to null to force build-from-source for a platform.
          releaseBinaries = {
            x86_64-linux   = null;  # sha256 = "sha256-...";
            aarch64-linux  = null;
            x86_64-darwin  = null;
            aarch64-darwin = null;
          };

          platformName = {
            x86_64-linux   = "linux-x64";
            aarch64-linux  = "linux-arm64";
            x86_64-darwin  = "darwin-x64";
            aarch64-darwin = "darwin-arm64";
          }.${system};

          version = (builtins.fromJSON (builtins.readFile ./package.json)).version;

          # Build from source using bun
          buildFromSource = pkgs.stdenvNoCC.mkDerivation {
            pname = "little-coder";
            inherit version;
            src = ./.;

            nativeBuildInputs = [ pkgs.bun pkgs.makeBinaryWrapper ];

            buildPhase = ''
              export HOME=$TMPDIR
              bun build --compile --bytecode --minify --format=esm bin/little-coder.ts --outfile little-coder
            '';

            installPhase = ''
              mkdir -p $out/bin $out/share/little-coder/extensions

              cp little-coder $out/bin/little-coder
              chmod +x $out/bin/little-coder

              # Bundle pre-compiled extensions
              for d in .pi/extensions/*; do
                if [ -d "$d" ]; then
                  name=$(basename "$d")
                  if [[ "$name" != _* ]]; then
                    mkdir -p "$out/share/little-coder/extensions/$name"
                    if [ -f "$d/index.js" ]; then
                      cp "$d/index.js" "$out/share/little-coder/extensions/$name/index.js"
                    elif [ -f "$d/index.ts" ]; then
                      bun build "$d/index.ts" --outfile "$out/share/little-coder/extensions/$name/index.js" --format=esm --target=bun --minify || true
                    fi
                  fi
                fi
              done

              # Bundle assets and config
              if [ -f AGENTS.md ]; then
                cp AGENTS.md $out/share/little-coder/AGENTS.md
              fi
              if [ -d skills ]; then
                cp -r skills $out/share/little-coder/skills
              fi
              if [ -f .pi/settings.json ]; then
                mkdir -p $out/share/little-coder/.pi
                cp .pi/settings.json $out/share/little-coder/.pi/settings.json
              fi
              if [ -d .pi/nushell ]; then
                mkdir -p $out/share/little-coder/.pi/nushell
                cp -r .pi/nushell/* $out/share/little-coder/.pi/nushell/
              fi
              if [ -d nu ]; then
                mkdir -p $out/share/little-coder/nu
                cp -r nu/* $out/share/little-coder/nu/
              fi
              if [ -f package.json ]; then
                cp package.json $out/share/little-coder/package.json
              fi

              # Wrap launcher with nixpkgs dependencies (pi, ripgrep, git, nushell, linehash, fd, eza, bat, delta, ast-grep)
              wrapProgram $out/bin/little-coder \
                --prefix PATH : ${pkgs.lib.makeBinPath [
                  pkgs.pi-coding-agent
                  pkgs.ripgrep
                  pkgs.git
                  pkgs.nushell
                  pkgs.fd
                  pkgs.eza
                  pkgs.bat
                  pkgs.delta
                  pkgs.ast-grep
                  linehashPkg
                ]} \
                --set-default LITTLE_CODER_SHARE "$out/share/little-coder" \
                --set-default LINEHASH_BIN "${linehashPkg}/bin/linehash"
            '';

            meta = {
              description = "little-coder — bun-built Pi distribution";
              homepage = "https://github.com/RogerNavelsaker/little-coder";
              license = pkgs.lib.licenses.mit;
              mainProgram = "little-coder";
            };
          };

          # Use pre-built binary when sha256 is available
          binaryInfo = releaseBinaries.${system} or null;
          default =
            if binaryInfo != null then
              pkgs.stdenvNoCC.mkDerivation {
                pname = "little-coder";
                inherit version;
                src = pkgs.fetchurl {
                  url = "https://github.com/RogerNavelsaker/little-coder/releases/download/v${version}/little-coder-${platformName}";
                  sha256 = binaryInfo;
                  executable = true;
                };
                dontUnpack = true;
                installPhase = ''
                  mkdir -p $out/bin
                  cp $src $out/bin/little-coder
                  chmod +x $out/bin/little-coder
                '';
                meta = buildFromSource.meta;
              }
            else
              buildFromSource;

          # Container image for Warren autonomous agent RPC sandboxes
          warren-agent = pkgs.dockerTools.buildLayeredImage {
            name = "warren-agent";
            tag = "latest";
            contents = [
              default
              pkgs.pi-coding-agent
              pkgs.nushell
              pkgs.ripgrep
              pkgs.git
              pkgs.fd
              pkgs.eza
              pkgs.bat
              pkgs.delta
              pkgs.ast-grep
              pkgs.ddgr
              flyscrapePkg
              linehashPkg
              pkgs.curl
              pkgs.aria2
              pkgs.yt-dlp
              pkgs.coreutils
              pkgs.dockerTools.binSh
              pkgs.dockerTools.caCertificates
            ];
            extraCommands = ''
              mkdir -m 1777 tmp
            '';
            config = {
              Cmd = [ "${default}/bin/little-coder" "--mode" "rpc" ];
              Env = [
                "PATH=${pkgs.lib.makeBinPath [
                  default
                  pkgs.pi-coding-agent
                  pkgs.nushell
                  pkgs.ripgrep
                  pkgs.git
                  pkgs.fd
                  pkgs.eza
                  pkgs.bat
                  pkgs.delta
                  pkgs.ast-grep
                  pkgs.ddgr
                  flyscrapePkg
                  linehashPkg
                  pkgs.curl
                  pkgs.aria2
                  pkgs.yt-dlp
                  pkgs.coreutils
                ]}:/bin"
                "SSL_CERT_FILE=/etc/ssl/certs/ca-bundle.crt"
                "WARREN_RUNTIME=docker"
                "LITTLE_CODER_MODE=rpc"
                "LINEHASH_BIN=${linehashPkg}/bin/linehash"
              ];
              WorkingDir = "/workspace";
            };
          };

        in {
          packages = {
            inherit default;
            inherit warren-agent;
          };

          apps.default = flake-utils.lib.mkApp { drv = default; };

          devShells.default = pkgs.mkShell {
            buildInputs = [ pkgs.bun pkgs.nodejs pkgs.git ];
            shellHook = ''
              echo "little-coder dev shell"
              echo "  bun install     — install deps"
              echo "  bun run dev     — run launcher from source"
              echo "  bun run build   — compile binary to dist/"
            '';
          };
        });
}
