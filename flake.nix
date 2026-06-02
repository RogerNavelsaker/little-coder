{
  description = "little-coder — bun-built Pi distribution";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachSystem [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ]
      (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};

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

            nativeBuildInputs = [ pkgs.bun pkgs.nodejs ];

            buildPhase = ''
              export HOME=$TMPDIR
              bun install --frozen-lockfile
              bun build --compile bin/little-coder.ts --outfile little-coder
            '';

            installPhase = ''
              mkdir -p $out/bin
              cp little-coder $out/bin/little-coder
              chmod +x $out/bin/little-coder
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

        in {
          packages = { inherit default; };

          # Run `little-coder install` after `nix profile install`:
          #   little-coder install
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
