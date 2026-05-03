{
  description = "Development environment for Inkline";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      buildFHS = pkgs.buildFHSEnv or pkgs.buildFHSUserEnv;
      electronDevEnv = buildFHS {
        name = "electron-dev-env";

        targetPkgs = pkgs: with pkgs; [
          nodejs_24
          pnpm
          corepack
          python3
          pkg-config
          gcc
          gnumake

          alsa-lib
          at-spi2-atk
          at-spi2-core
          atk
          cairo
          cups
          dbus
          expat
          fontconfig
          freetype
          gdk-pixbuf
          glib
          gtk3
          libdrm
          libgbm
          libglvnd
          libnotify
          libsecret
          libuuid
          libxcb
          libxkbcommon
          mesa
          nspr
          nss
          pango
          systemd

          libx11
          libxscrnsaver
          libxcomposite
          libxcursor
          libxdamage
          libxext
          libxfixes
          libxi
          libxrandr
          libxrender
          libxtst
          libxcb
          libxshmfence
        ];

        runScript = "bash";
      };
    in
    {
      devShells.${system}.default = electronDevEnv.env;
    };
}
