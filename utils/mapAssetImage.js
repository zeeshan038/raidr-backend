import sharp from "sharp";

const pixelLightness = (r, g, b) => (r + g + b) / 3;

const pixelSaturation = (r, g, b) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
};

const colorDistance = (r, g, b, r2, g2, b2) => Math.hypot(r - r2, g - g2, b - b2);

const channelSpread = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);

/**
 * Studio / export backdrop: white, gray, checkerboard, or dark navy plates from Gemini.
 * Uses low channel spread (near-neutral) so dark blue-gray (#121826-style) is removed too.
 */
const isStudioBackdropPixel = (r, g, b) => {
  const spread = channelSpread(r, g, b);
  const sat = pixelSaturation(r, g, b);
  const l = pixelLightness(r, g, b);

  if (spread <= 28) {
    return true;
  }
  if (sat <= 0.12 && (l >= 120 || l <= 72)) {
    return true;
  }
  if (l >= 248 && spread <= 22) {
    return true;
  }
  return false;
};

/** Collect dominant neutral grays along the image border (checkerboard pair or flat gray). */
function learnBorderBackdropColors(data, w, h) {
  const buckets = [];
  const push = (x, y) => {
    const i = (y * w + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (!isStudioBackdropPixel(r, g, b)) {
      return;
    }
    buckets.push([r, g, b]);
  };

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    push(0, y);
    push(w - 1, y);
  }

  if (buckets.length === 0) {
    return [
      [18, 24, 38],
      [232, 232, 232],
      [245, 245, 245],
    ];
  }

  buckets.sort((a, b) => pixelLightness(a[0], a[1], a[2]) - pixelLightness(b[0], b[1], b[2]));
  const dark = buckets[Math.floor(buckets.length * 0.2)] ?? buckets[0];
  const light = buckets[Math.floor(buckets.length * 0.8)] ?? buckets[buckets.length - 1];
  return [dark, light];
}

const matchesLearnedBackdrop = (r, g, b, colors, tolerance = 48) => {
  if (!isStudioBackdropPixel(r, g, b)) {
    return false;
  }
  return colors.some(([cr, cg, cb]) => colorDistance(r, g, b, cr, cg, cb) <= tolerance);
};

/**
 * Flood from edges through neutral backdrop (white, gray, baked checkerboard cells).
 */
async function floodTransparentBackdrop(inputBuffer, options = {}) {
  const colorTolerance = options.colorTolerance ?? 40;

  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const visited = new Uint8Array(w * h);
  const queue = [];

  const pixelIndex = (x, y) => (y * w + x) * 4;
  const cell = (x, y) => y * w + x;

  const lightness = (i) => (data[i] + data[i + 1] + data[i + 2]) / 3;

  const colorDistanceAt = (i, r, g, b) => {
    const dr = data[i] - r;
    const dg = data[i + 1] - g;
    const db = data[i + 2] - b;
    return Math.hypot(dr, dg, db);
  };

  let sr = 0;
  let sg = 0;
  let sb = 0;
  const cornerCoords = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  for (const [cx, cy] of cornerCoords) {
    const i = pixelIndex(cx, cy);
    sr += data[i];
    sg += data[i + 1];
    sb += data[i + 2];
  }
  sr = Math.round(sr / 4);
  sg = Math.round(sg / 4);
  sb = Math.round(sb / 4);

  const learned = learnBorderBackdropColors(data, w, h);

  const isBackdropPixel = (i) => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isStudioBackdropPixel(r, g, b)) {
      return true;
    }
    if (matchesLearnedBackdrop(r, g, b, learned, 50)) {
      return true;
    }
    if (colorDistanceAt(i, sr, sg, sb) <= colorTolerance && isStudioBackdropPixel(r, g, b)) {
      return true;
    }
    return false;
  };

  const trySeed = (x, y) => {
    const p = cell(x, y);
    if (visited[p]) {
      return;
    }
    const i = pixelIndex(x, y);
    if (!isBackdropPixel(i)) {
      return;
    }
    visited[p] = 1;
    queue.push([x, y]);
  };

  for (let x = 0; x < w; x++) {
    trySeed(x, 0);
    trySeed(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    trySeed(0, y);
    trySeed(w - 1, y);
  }

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const i = pixelIndex(x, y);
    data[i + 3] = 0;

    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
        continue;
      }
      const p = cell(nx, ny);
      if (visited[p]) {
        continue;
      }
      const ni = pixelIndex(nx, ny);
      if (!isBackdropPixel(ni)) {
        continue;
      }
      visited[p] = 1;
      queue.push([nx, ny]);
    }
  }

  return { data, w, h };
}

/**
 * Remove baked checkerboard / gray plate pixels even when they sit behind the subject
 * (low-saturation neutrals matching the learned checker pair).
 */
function stripInteriorBakedGrid(data, w, h) {
  const learned = learnBorderBackdropColors(data, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (data[i + 3] === 0) {
        continue;
      }
      if (isStudioBackdropPixel(r, g, b) || matchesLearnedBackdrop(r, g, b, learned, 46)) {
        data[i + 3] = 0;
      }
    }
  }
}

/**
 * Remove baked studio backdrops (light, dark, checkerboard) from AI PNGs.
 */
export async function stripOpaqueBackdrop(inputBuffer, options = {}) {
  let data;
  let w;
  let h;
  try {
    const flooded = await floodTransparentBackdrop(inputBuffer, options);
    data = flooded.data;
    w = flooded.w;
    h = flooded.h;
    stripInteriorBakedGrid(data, w, h);
  } catch (err) {
    const { data: rawData, info } = await sharp(inputBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = rawData;
    w = info.width;
    h = info.height;
    stripInteriorBakedGrid(data, w, h);
    console.warn("[mapAssetImage] flood backdrop fallback:", err?.message);
  }

  return sharp(data, {
    raw: { width: w, height: h, channels: 4 },
  })
    .png()
    .toBuffer();
}

/** 512×512 PNG, transparent letterbox, with AI backdrop + checkerboard stripped. */
export async function normalizeMapAssetPngBuffer(inputBuffer) {
  let buf = inputBuffer;
  try {
    buf = await stripOpaqueBackdrop(buf, { colorTolerance: 44 });
  } catch (err) {
    console.warn("[mapAssetImage] stripOpaqueBackdrop skipped:", err?.message);
  }

  return sharp(buf)
    .trim({ threshold: 1 })
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

export async function normalizeMapAssetPngBase64(base64) {
  if (!base64) {
    return null;
  }
  const buf = Buffer.from(base64, "base64");
  const normalized = await normalizeMapAssetPngBuffer(buf);
  return normalized.toString("base64");
}
