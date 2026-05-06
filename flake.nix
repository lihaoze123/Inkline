{
  description = "Inkline desktop app";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs, ... }:
    let
      lib = nixpkgs.lib;
      packageJson = builtins.fromJSON (builtins.readFile ./package.json);
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = lib.genAttrs systems;
      pkgsFor = system: import nixpkgs { inherit system; };
      nodeArchFor = system:
        {
          x86_64-linux = "x64";
          aarch64-linux = "arm64";
        }
        .${system};
      mkElectronDevEnv =
        system:
        let
          pkgs = pkgsFor system;
          buildFHS = pkgs.buildFHSEnv or pkgs.buildFHSUserEnv;
        in
        buildFHS {
          name = "electron-dev-env";

          targetPkgs =
            pkgs:
            with pkgs;
            [
              nodejs_24
              pnpm
              corepack
              xvfb-run
              python3
              pkg-config
              gcc
              gnumake
              fakeroot
              dpkg
              squashfsTools

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
              glib.dev
              gtk3
              libdrm
              libgbm
              libglvnd
              libnotify
              libsecret
              libsecret.dev
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
      mkInkline =
        system:
        let
          pkgs = pkgsFor system;
          electron = pkgs.electron_39;
          nodejs = pkgs.nodejs_24;
          pnpm = pkgs.pnpm_10;
          nodeArch = nodeArchFor system;
          nodePlatform = "linux";
          electronDistZip = pkgs.runCommand "electron-v${electron.version}-${nodePlatform}-${nodeArch}.zip" { nativeBuildInputs = [ pkgs.zip ]; } ''
            workdir="$PWD/electron-v${electron.version}-${nodePlatform}-${nodeArch}"
            mkdir -p "$workdir"
            cp -R "${electron.dist}/." "$workdir/"
            chmod -R u+w "$workdir"
            (cd "$workdir" && zip -0 -r "$out" .)
          '';
        in
        pkgs.stdenv.mkDerivation (finalAttrs: {
          pname = packageJson.name;
          version = packageJson.version;
          src = lib.cleanSource ./.;

          pnpmDeps = pkgs.fetchPnpmDeps {
            inherit (finalAttrs) pname version src prePnpmInstall;
            inherit pnpm;
            fetcherVersion = 3;
            hash = "sha256-p0d0hpgsSVHUmdo+nnktMtu8ltOZkbwuvg2lUpGrUB8=";
          };

          nativeBuildInputs = [
            nodejs
            pnpm
            pkgs.pnpmConfigHook
            pkgs.python3
            pkgs.pkg-config
            pkgs.gcc
            pkgs.gnumake
            pkgs.makeWrapper
            pkgs.copyDesktopItems
            pkgs.writableTmpDirAsHomeHook
            pkgs.autoPatchelfHook
          ];

          buildInputs = [
            pkgs.stdenv.cc.cc.lib
            pkgs.glib
            pkgs.libsecret
          ];

          strictDeps = true;

          prePnpmInstall = ''
            pnpm config set node-linker hoisted
            pnpm config set shamefully-hoist true
            pnpm config set strict-peer-dependencies false
          '';

          pnpmInstallFlags = [ "--shamefully-hoist" ];

          env = {
            ELECTRON_OVERRIDE_DIST_PATH = "${electron.dist}";
            ELECTRON_SKIP_BINARY_DOWNLOAD = "1";
            npm_config_build_from_source = "true";
            npm_config_nodedir = "${electron.headers}";
          };

          buildPhase = ''
            runHook preBuild

            export INKLINE_ELECTRON_ZIP_DIR="$PWD/.electron_zip_dir"
            mkdir -p "$INKLINE_ELECTRON_ZIP_DIR"
            cp "${electronDistZip}" "$INKLINE_ELECTRON_ZIP_DIR/electron-v${electron.version}-${nodePlatform}-${nodeArch}.zip"

            pnpm exec electron-rebuild \
              --force \
              --only better-sqlite3,keytar \
              --version ${electron.version} \
              --arch ${nodeArch}

            pnpm exec electron-forge package --platform linux --arch ${nodeArch}

            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall

            packageDir="out/Inkline-linux-${nodeArch}"
            if [ ! -d "$packageDir/resources" ]; then
              echo "Expected Electron Forge package resources at $packageDir/resources" >&2
              exit 1
            fi

            mkdir -p "$out/lib/inkline"
            cp -R "$packageDir/resources" "$out/lib/inkline/"
            install -Dm644 LICENSE "$out/share/licenses/inkline/LICENSE"
            install -Dm644 resources/icon.png "$out/share/pixmaps/inkline.png"

            makeWrapper "${lib.getExe electron}" "$out/bin/inkline" \
              --inherit-argv0 \
              --add-flags "$out/lib/inkline/resources/app.asar" \
              --add-flags "\''${NIXOS_OZONE_WL:+\''${WAYLAND_DISPLAY:+--ozone-platform-hint=auto --enable-features=WaylandWindowDecorations --enable-wayland-ime=true}}"

            runHook postInstall
          '';

          desktopItems = [
            (pkgs.makeDesktopItem {
              name = "inkline";
              desktopName = packageJson.productName;
              comment = packageJson.description;
              exec = "inkline %U";
              terminal = false;
              icon = "inkline";
              categories = [ "Education" ];
            })
          ];

          meta = {
            description = packageJson.description;
            homepage = "https://github.com/lihaoze123/Inkline";
            license = lib.licenses.gpl3Plus;
            mainProgram = "inkline";
            platforms = systems;
          };
        });
    in
    {
      packages = forAllSystems (system: {
        default = mkInkline system;
        inkline = mkInkline system;
      });

      apps = forAllSystems (system: {
        default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/inkline";
          meta.description = packageJson.description;
        };
        inkline = {
          type = "app";
          program = "${self.packages.${system}.inkline}/bin/inkline";
          meta.description = packageJson.description;
        };
      });

      devShells = forAllSystems (system: {
        default = (mkElectronDevEnv system).env;
      });
    };
}
