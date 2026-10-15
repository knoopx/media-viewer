/**
 * Image scanner and dimension probe for the gpuix image viewer.
 *
 * The JPEG probe is EXIF-aware: it reports orientation-adjusted DISPLAY
 * dimensions, matching what the GPUI native <img> decoder produces (the
 * Rust `exif` crate applies EXIF Orientation). For EXIF orientations
 * 5-8 (transpose, rotate90, transverse, rotate270) the SOF width and
 * height are swapped; orientations 1-4 keep the stored dimensions. If
 * the EXIF Orientation tag is absent or unparseable, the probe falls
 * back to the stored SOF dimensions. The probe is header-only: it reads
 * only the file head (the EXIF APP1 segment sits right after the SOI).
 * The other format probes have no EXIF and report stored dimensions.
 */
import { closeSync, openSync, readSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { compare as natord } from "./natord";
import type { MediaFile } from "./types";

export const SUPPORTED_IMAGE_EXTENSIONS: readonly string[] = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "tiff",
  "tif",
  "ico",
];

const IMAGE_EXTS = new Set(SUPPORTED_IMAGE_EXTENSIONS);

export async function scan(
  dir: string,
  recursive: boolean,
): Promise<MediaFile[]> {
  const files: MediaFile[] = [];
  const pattern = recursive ? "**" : "*";
  const glob = new Bun.Glob(pattern);
  for await (const rel of glob.scan({
    cwd: dir,
    onlyFiles: true,
    dot: false,
  })) {
    const full = join(dir, rel);

    const ext = extname(rel).toLowerCase().replace(/^\./, "");
    if (IMAGE_EXTS.has(ext)) {
      const mtime = mtimeOf(full);
      const [width, height] = probeDimensions(full) ?? [0, 0];
      files.push({ path: full, mtime, width, height });
    }
  }

  files.sort((a, b) => {
    if (a.mtime !== b.mtime) return b.mtime - a.mtime;
    return natord(a.path, b.path);
  });

  return files;
}

function mtimeOf(path: string): number {
  try {
    return Math.max(Math.floor(statSync(path).mtimeMs / 1000), 0);
  } catch {
    return 0;
  }
}

function readAt(path: string, off: number, n: number): Buffer | null {
  try {
    const fd = openSync(path, "r");
    try {
      const buf = Buffer.alloc(n);
      const bytes = readSync(fd, buf, 0, n, off);
      return buf.subarray(0, bytes);
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
}

function readHead(path: string, n: number): Buffer | null {
  return readAt(path, 0, n);
}

function probePNG(buf: Buffer): [number, number] | null {
  if (buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return w > 0 && h > 0 ? [w, h] : null;
}

const SOF_MARKERS = new Set<number>([
  0xc0,
  0xc1,
  0xc2,
  0xc3,
  0xc5,
  0xc6,
  0xc7,
  0xc9,
  0xca,
  0xcb,
  0xcd,
  0xce,
  0xcf,
]);

function stepMarker(buf: Buffer, i: number): number {
  const marker = buf[i + 1];
  if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7))
    return i + 2;
  return i + 2 + buf.readUInt16BE(i + 2);
}

/**
 * Read the EXIF Orientation tag (0x0112, IFD0) from a JPEG buffer.
 * Returns the orientation value (1-8) or null if the EXIF APP1 segment
 * is absent or unparseable. Header-only: inspects APP1 segments only.
 */
function exifOrientation(buf: Buffer): number | null {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xe1) {
      const payload = i + 4;
      if (
        payload + 6 <= buf.length &&
        buf.toString("ascii", payload, payload + 6) === "Exif\0\0"
      ) {
        return tiffOrientation(buf, payload + 6);
      }
    }
    i = stepMarker(buf, i);
  }
  return null;
}

/**
 * Parse the TIFF structure at tiffStart (both II little-endian and MM
 * big-endian) and return the IFD0 Orientation value (tag 0x0112,
 * type SHORT), or null if unparseable.
 */
function tiffOrientation(buf: Buffer, tiffStart: number): number | null {
  if (tiffStart + 8 > buf.length) return null;
  let le: boolean;
  if (buf[tiffStart] === 0x49 && buf[tiffStart + 1] === 0x49) le = true;
  else if (buf[tiffStart] === 0x4d && buf[tiffStart + 1] === 0x4d)
    le = false;
  else return null;
  const rd16 = (o: number) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const rd32 = (o: number) =>
    le ? buf.readUInt32LE(o) : buf.readUInt32BE(o);
  if (rd16(tiffStart + 2) !== 42) return null;
  const ifd = tiffStart + rd32(tiffStart + 4);
  if (ifd + 2 > buf.length) return null;
  const count = rd16(ifd);
  for (let k = 0; k < count; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > buf.length) return null;
    if (rd16(e) === 0x0112 && rd16(e + 2) === 3) return rd16(e + 8);
  }
  return null;
}

function probeJPEG(buf: Buffer): [number, number] | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const orientation = exifOrientation(buf);
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];

    if (SOF_MARKERS.has(marker)) {
      const h = buf.readUInt16BE(i + 5);
      const w = buf.readUInt16BE(i + 7);
      if (w <= 0 || h <= 0) return null;
      // EXIF orientations 5-8 swap the display axes: the native decoder
      // renders them swapped, so report display dimensions.
      return orientation !== null && orientation >= 5 && orientation <= 8
        ? [h, w]
        : [w, h];
    }

    i = stepMarker(buf, i);
  }
  return null;
}

function probeWebP(buf: Buffer): [number, number] | null {
  if (buf.length < 30) return null;
  if (
    buf.toString("ascii", 0, 4) !== "RIFF" ||
    buf.toString("ascii", 8, 12) !== "WEBP"
  )
    return null;
  const fourcc = buf.toString("ascii", 12, 16);
  if (fourcc === "VP8 ") {
    const w = buf.readUInt16LE(26) & 0x3fff;
    const h = buf.readUInt16LE(28) & 0x3fff;
    return w > 0 && h > 0 ? [w, h] : null;
  }
  if (fourcc === "VP8L") {
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  if (fourcc === "VP8X") {
    return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  }
  return null;
}

function probeGIF(buf: Buffer): [number, number] | null {
  if (buf.length < 10 || buf.toString("ascii", 0, 4) !== "GIF8") return null;
  const w = buf.readUInt16LE(6);
  const h = buf.readUInt16LE(8);
  return w > 0 && h > 0 ? [w, h] : null;
}

function probeBMP(buf: Buffer): [number, number] | null {
  if (buf.length < 26 || buf[0] !== 0x42 || buf[1] !== 0x4d) return null;
  const w = buf.readUInt32LE(18);
  const h = Math.abs(buf.readInt32LE(22));
  return w > 0 && h > 0 ? [w, h] : null;
}

function ifdValue(
  rd16: (o: number) => number,
  rd32: (o: number) => number,
  e: number,
): number | null {
  const type = rd16(e + 2);
  const cnt = rd32(e + 4);
  if (type === 3 && cnt === 1) return rd16(e + 8);
  if (type === 4 && cnt === 1) return rd32(e + 8);
  return null;
}

function probeTIFF(buf: Buffer, path: string): [number, number] | null {
  if (buf.length < 8) return null;
  let le: boolean;
  if (buf[0] === 0x49 && buf[1] === 0x49) le = true;
  else if (buf[0] === 0x4d && buf[1] === 0x4d) le = false;
  else return null;
  const r16 = (b: Buffer, o: number) =>
    le ? b.readUInt16LE(o) : b.readUInt16BE(o);
  const r32 = (b: Buffer, o: number) =>
    le ? b.readUInt32LE(o) : b.readUInt32BE(o);
  if (r16(buf, 2) !== 42) return null;
  const ifdOff = r32(buf, 4);
  // The IFD may sit beyond the head buffer (e.g. written after the
  // strip data); seek to it when needed.
  const ifd =
    ifdOff + 2 <= buf.length
      ? buf.subarray(ifdOff)
      : (readAt(path, ifdOff, 65536) ?? null);
  if (!ifd) return null;
  const rd16 = (o: number) => r16(ifd, o);
  const rd32 = (o: number) => r32(ifd, o);
  const count = rd16(0);
  let width = 0;
  let height = 0;
  for (let i = 0; i < count; i++) {
    const e = 2 + i * 12;
    if (e + 12 > ifd.length) break;
    const tag = rd16(e);
    const val = ifdValue(rd16, rd32, e);
    if (val === null) continue;
    if (tag === 256) width = val;
    else if (tag === 257) height = val;
  }
  return width > 0 && height > 0 ? [width, height] : null;
}

export function probeDimensions(path: string): [number, number] | null {
  const buf = readHead(path, 65536);
  if (!buf || buf.length < 8) return null;
  switch (extname(path).toLowerCase()) {
    case ".png":
      return probePNG(buf);
    case ".jpg":
    case ".jpeg":
      return probeJPEG(buf);
    case ".webp":
      return probeWebP(buf);
    case ".gif":
      return probeGIF(buf);
    case ".bmp":
      return probeBMP(buf);
    case ".tiff":
    case ".tif":
      return probeTIFF(buf, path);
    default:
      return null;
  }
}
