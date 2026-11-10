import sharp from "sharp";

/**
 * Remove solid light backdrops typical of AI image output (white/gray) by
 * flood-filling from the image border through similarly colored pixels.
 * Does not global-key all near-white pixels (preserves highlights on the subject).
 */
export async function stripOpaqueBackdrop(inputBuffer, options = {}) {
  const colorTolerance = options.colorTolerance ?? 32;
  const lightnessMin = options.lightnessMin ?? 195;

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

  const colorDistance = (i, r, g, b) => {
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

  const isBackdropPixel = (i) => {
    if (lightness(i) < lightnessMin) {
      return false;
    }
    if (colorDistance(i, sr, sg, sb) <= colorTolerance) {
      return true;
    }
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    return r >= 238 && g >= 238 && b >= 238;
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

  return sharp(data, {
    raw: { width: w, height: h, channels: 4 },
  })
    .png()
    .toBuffer();
}

/** 512×512 PNG, transparent letterbox, with AI backdrop stripped when present. */
export async function normalizeMapAssetPngBuffer(inputBuffer) {
  let buf = inputBuffer;
  try {
    buf = await stripOpaqueBackdrop(buf);
  } catch (err) {
    console.warn("[mapAssetImage] stripOpaqueBackdrop skipped:", err?.message);
  }

  return sharp(buf)
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
