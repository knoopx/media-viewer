# media-viewer

A native desktop image viewer built on [Zed GPUI](https://zed.dev) (via
`@gpuix/react`): a justified-rows thumbnail grid and a fullscreen detail view,
GPU-rendered and keyboard-driven.

![media-viewer — justified-rows thumbnail grid](docs/screenshot.png)

## Supported formats

| Formats                                                  |
| -------------------------------------------------------- |
| `png` `jpg` `jpeg` `webp` `gif` `bmp` `tiff` `tif` `ico` |

## Usage

Run directly with Bun:

```sh
bun main.tsx /path/to/photos
```

A directory opens the thumbnail grid; a single image file opens
directly in fullscreen, with the grid built from its parent directory
(`escape` returns to the grid, `left`/`right` move through it):

```sh
bun main.tsx /path/to/photo.png
```

Development mode (hot reload):

```sh
bun --hot /path/to/photos
```

Or via the flake:

```sh
nix run . -- /path/to/photos
```

`dev` / `start` scripts in `package.json` wrap the same entry point;
`bun x tsc --noEmit` typechecks.

On exit (`q`), the paths of all checked files (toggled with `space`) are
written to stdout, one per line — an empty list writes nothing:

### CLI flags

Flags override `config.json` values; omitted flags fall back to the
config file, then built-in defaults.

| Flag               | Config key      | Description               |
| ------------------ | --------------- | ------------------------- |
| `--theme <t>`      | `theme`         | `dark` or `light`         |
| `--thumbnail-size` | `thumbnailSize` | Target tile height in px  |
| `--gap`            | `gap`           | Reserved spacing in px    |
| `--window-width`   | `windowWidth`   | Window width in px        |
| `--window-height`  | `windowHeight`  | Window height in px       |
| `--no-recursive`   | `recursive`     | Disable subdirectory scan |
| `-h`, `--help`     | —               | Print usage and exit      |

## Configuration

A `config.json` is read from the current directory, then from
`~/.config/media-viewer/config.json`; missing keys fall back to defaults.

| Key             | Default | Description                            |
| --------------- | ------- | -------------------------------------- |
| `theme`         | `dark`  | `dark` or `light`                      |
| `thumbnailSize` | `240`   | Target tile height in px               |
| `gap`           | `8`     | Reserved spacing                       |
| `windowWidth`   | `1440`  | Window width in px                     |
| `windowHeight`  | `900`   | Window height in px                    |
| `recursive`     | `true`  | Scan subdirectories                    |
| `commands`      | `[]`    | User-defined file commands (below)     |
| `shortcuts`     | `[]`    | Rebinds for built-in shortcuts (below) |

### File commands

`commands` is a list of user-defined commands run on the selected file.
There are no built-in file commands: a command that is not configured is
unavailable. Each entry:

| Field  | Description                                                         |
| ------ | ------------------------------------------------------------------- |
| `id`   | Command id; matched against keypresses and the shortcut set         |
| `keys` | Key bindings (single key, or a chord like `["ctrl", "shift", "x"]`) |
| `cmd`  | Executable to run                                                   |
| `args` | Arguments; `{path}` is substituted with the selected file path      |

On success the file is re-probed for dimensions; if the file no longer
exists (e.g. a `trash` delete) it is dropped from the grid. See
[`examples/config.json`](examples/config.json):

```json
"commands": [
  { "id": "rotate", "keys": ["r"], "cmd": "mogrify", "args": ["-rotate", "90", "{path}"] },
  { "id": "delete", "keys": ["delete", "backspace"], "cmd": "trash", "args": ["{path}"] }
]
```

### Shortcut rebinds

`shortcuts` rebinds the built-in view shortcuts. Each entry names a
shortcut `id` and replaces its default `keys` (multiple bindings are
allowed, same format as `commands`). `view` is optional: omitted, the
rebind applies to whichever view contains the id (e.g. `exit` in both);
set it to `"grid"` or `"fullscreen"` to scope it to one view. An empty
`keys` list disables the shortcut (in the scoped views); unknown ids are
ignored.

Built-in ids and defaults:

| View       | id          | Default keys      |
| ---------- | ----------- | ----------------- |
| grid       | `exit`      | `q`, `escape`     |
| grid       | `open`      | `enter`           |
| grid       | `check`     | `space`           |
| grid       | `left`      | `left`            |
| grid       | `right`     | `right`           |
| grid       | `up`        | `up`              |
| grid       | `down`      | `down`            |
| grid       | `page-up`   | `pageup`          |
| grid       | `page-down` | `pagedown`        |
| grid       | `home`      | `home`            |
| grid       | `end`       | `end`             |
| fullscreen | `exit`      | `q`               |
| fullscreen | `back`      | `escape`, `enter` |
| fullscreen | `prev`      | `left`            |
| fullscreen | `next`      | `right`           |

Example — add `ctrl+q` as an extra quit binding in both views, bind
`backspace` to back only in fullscreen, and disable `check` in the grid:

```json
"shortcuts": [
  { "id": "exit", "keys": ["q", ["ctrl", "q"]] },
  { "id": "back", "view": "fullscreen", "keys": ["backspace"] },
  { "id": "check", "view": "grid", "keys": [] }
]
```

## Nix

The flake builds a standalone binary (`bun build --compile`) with the native
GPUI module bundled and a wrapper that sets `LD_LIBRARY_PATH` and
`NAPI_RS_NATIVE_LIBRARY_PATH`:

```sh
nix build .              # builds the package
nix run . -- <dir>       # run the app
nix develop              # dev shell (Bun + GPU dependencies)
```
