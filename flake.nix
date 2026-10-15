{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      system = "x86_64-linux";
      lib = nixpkgs.lib;
      pkgs = nixpkgs.legacyPackages.${system};

      src = lib.cleanSource ./.;

      npmDeps = {
        react = pkgs.fetchurl {
          url = "https://registry.npmjs.org/react/-/react-19.3.1.tgz";
          hash = "sha256-VpNpE5GNzx96b+WHhOed9UsYIAqIZVzoCc9enE74cao=";
        };
        gpuixNative = pkgs.fetchurl {
          url = "https://registry.npmjs.org/@gpuix/native/-/native-0.10.0.tgz";
          hash = "sha256-BPnE4AHcOKJYhqIdcp7q+KSAJ2BNz3LOFFEixkZxRqc=";
        };
        gpuixReact = pkgs.fetchurl {
          url = "https://registry.npmjs.org/@gpuix/react/-/react-0.10.0.tgz";
          hash = "sha256-qbcLb4DriWlWVHez7uT5whJdJCdDl+3nWdqiVMVVC8I=";
        };
        gpuixNativeLinux = pkgs.fetchurl {
          url = "https://registry.npmjs.org/@gpuix/native-linux-x64-gnu/-/native-linux-x64-gnu-0.10.0.tgz";
          hash = "sha256-ilVYHnqCHyeqcvLJITIQIP1KjF4OFvqtZ7jBZdbj74k=";
        };
        lucideStatic = pkgs.fetchurl {
          url = "https://registry.npmjs.org/lucide-static/-/lucide-static-1.57.0.tgz";
          hash = "sha256-r8hgLFIxzmTuInKG+Tdy0EOO3dO5R7ZFvBS/0eSdpRg=";
        };
        reactReconciler = pkgs.fetchurl {
          url = "https://registry.npmjs.org/react-reconciler/-/react-reconciler-0.31.0.tgz";
          hash = "sha256-n0GsUyE/9s+ri+YM6iUTVyiToVsOl2xj9CVxqXtJQyM=";
        };
        scheduler = pkgs.fetchurl {
          url = "https://registry.npmjs.org/scheduler/-/scheduler-0.25.0.tgz";
          hash = "sha256-iqwtpt7LCcHaz4wQb2LS+0RU+7H98vb+bU7xpXt8aRQ=";
        };
        zod = pkgs.fetchurl {
          url = "https://registry.npmjs.org/zod/-/zod-4.6.7.tgz";
          hash = "sha256-hO/RVb7ZMnAobnk/yVG+JwtTbL1bDusRHw+jlnIB1pg=";
        };
        eventsourceParser = pkgs.fetchurl {
          url = "https://registry.npmjs.org/eventsource-parser/-/eventsource-parser-4.1.2.tgz";
          hash = "sha256-2ILcUCLgrDmEpvt0fZiTpzFnWgp9neAd424KrQJgyGw=";
        };
      };
    in
    {
      packages.${system}.default =
        pkgs.stdenvNoCC.mkDerivation {
          pname = "media-viewer";
          version = "0.1.0";

          inherit src;

          nativeBuildInputs = [ pkgs.bun pkgs.makeBinaryWrapper ];

          propagatedBuildInputs = [
            pkgs.libxkbcommon
            pkgs.wayland
            pkgs.mesa
            pkgs.vulkan-loader
          ];

          dontBuild = true;

          installPhase = ''
            mkdir -p $out/bin $out/lib

            rm -rf node_modules
            mkdir -p node_modules

            mkdir -p node_modules/react && tar xzf ${npmDeps.react} -C node_modules/react --strip-components=1
            mkdir -p node_modules/@gpuix/native && tar xzf ${npmDeps.gpuixNative} -C node_modules/@gpuix/native --strip-components=1
            mkdir -p node_modules/@gpuix/react && tar xzf ${npmDeps.gpuixReact} -C node_modules/@gpuix/react --strip-components=1
            mkdir -p node_modules/@gpuix/native-linux-x64-gnu && tar xzf ${npmDeps.gpuixNativeLinux} -C node_modules/@gpuix/native-linux-x64-gnu --strip-components=1
            mkdir -p node_modules/lucide-static && tar xzf ${npmDeps.lucideStatic} -C node_modules/lucide-static --strip-components=1
            mkdir -p node_modules/react-reconciler && tar xzf ${npmDeps.reactReconciler} -C node_modules/react-reconciler --strip-components=1
            mkdir -p node_modules/scheduler && tar xzf ${npmDeps.scheduler} -C node_modules/scheduler --strip-components=1
            mkdir -p node_modules/zod && tar xzf ${npmDeps.zod} -C node_modules/zod --strip-components=1
            mkdir -p node_modules/eventsource-parser && tar xzf ${npmDeps.eventsourceParser} -C node_modules/eventsource-parser --strip-components=1

            bun build --compile main.tsx --outfile $out/lib/media-viewer

            mkdir -p $out/lib/media-viewer-native/

            cp node_modules/@gpuix/native-linux-x64-gnu/gpuix-native.linux-x64-gnu.node \
              $out/lib/media-viewer-native/

            makeWrapper $out/lib/media-viewer $out/bin/media-viewer \
              --set LD_LIBRARY_PATH "${pkgs.lib.makeLibraryPath [ pkgs.libxkbcommon pkgs.wayland pkgs.mesa pkgs.vulkan-loader ]}" \
              --set NAPI_RS_NATIVE_LIBRARY_PATH "$out/lib/media-viewer-native/gpuix-native.linux-x64-gnu.node"
          '';
        };

      apps.${system}.default = {
        type = "app";
        program = "${self.packages.${system}.default}/bin/media-viewer";
      };

      devShells.${system}.default = pkgs.mkShell {
        packages = [ pkgs.bun ];
      };
    };
}
