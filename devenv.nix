{ pkgs, inputs, ... }:

let
  system = pkgs.stdenv.hostPlatform.system;
in
{
  packages = with pkgs; [
    bun
    bubblewrap
    direnv
    nushell
    ddgr
    curl
    aria2
    yt-dlp
    inputs.flyscrape.packages.${system}.default
    inputs.linehash.packages.${system}.default
    inputs.burrow.packages.${system}.default
    inputs.burrow.packages.${system}.default.bw
    inputs.canopy.packages.${system}.default
    inputs.canopy.packages.${system}.default.cn
    inputs.mulch.packages.${system}.default
    inputs.mulch.packages.${system}.default.ml
    inputs.plot.packages.${system}.default
    inputs.plot.packages.${system}.default.pt
    inputs.seeds.packages.${system}.default
    inputs.seeds.packages.${system}.default.sd
    inputs.trellis.packages.${system}.default
    inputs.trellis.packages.${system}.default.tl
  ];


  env.NODE_ENV = "development";

  scripts.little-coder.exec = ''
    exec bun "$DEVENV_ROOT/bin/little-coder.ts" "$@"
  '';

  enterShell = ''
    export PATH="/home/rona/Repositories/scripts:$PATH"
  '';
}
