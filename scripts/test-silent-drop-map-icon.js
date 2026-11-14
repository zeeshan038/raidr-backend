#!/usr/bin/env node
/**
 * Asserts mapIconUrl never uses product (-icon) assets on dashboard pins.
 * Run: node scripts/test-silent-drop-map-icon.js
 */
import {
  resolveSilentDropMapIconUrl,
  resolveSilentDropProductImageUrl,
  formatSilentDropMapPin,
} from "../utils/liveEventClaim.js";

const ICON = "https://hel1.your-objectstorage.com/raidr-assets/single-player-b2b/1794592170872_KFC-icon.png";
const PIN = "https://hel1.your-objectstorage.com/raidr-assets/single-player-b2b/1794592170872_KFC-pin.png";

const cases = [
  {
    name: "KFC prod bug: only icon in DB",
    event: { imageUrl: "", commanderAvatar: ICON },
    expectMap: null,
    expectProduct: ICON,
  },
  {
    name: "Happy path: pin + icon",
    event: { imageUrl: PIN, commanderAvatar: ICON },
    expectMap: PIN,
    expectProduct: ICON,
  },
  {
    name: "Only pin",
    event: { imageUrl: PIN, commanderAvatar: "" },
    expectMap: PIN,
    expectProduct: PIN,
  },
  {
    name: "Pin swapped into commanderAvatar",
    event: { imageUrl: "", commanderAvatar: PIN },
    expectMap: PIN,
    expectProduct: PIN,
  },
  {
    name: "Product wrongly in imageUrl",
    event: { imageUrl: ICON, commanderAvatar: PIN },
    expectMap: PIN,
    expectProduct: ICON,
  },
  {
    name: "Geo Drop icon only (user log)",
    event: {
      imageUrl: "",
      commanderAvatar:
        "https://hel1.your-objectstorage.com/raidr-assets/single-player-b2b/1794602350094_Geo-Drop-1-icon.png",
    },
    expectMap: null,
    expectProduct:
      "https://hel1.your-objectstorage.com/raidr-assets/single-player-b2b/1794602350094_Geo-Drop-1-icon.png",
  },
];

let failed = 0;
for (const c of cases) {
  const map = resolveSilentDropMapIconUrl(c.event);
  const product = resolveSilentDropProductImageUrl(c.event);
  const mapOk = map === c.expectMap;
  const productOk = product === c.expectProduct;
  const mapBad = map && /-icon\./i.test(map);
  if (!mapOk || !productOk || mapBad) {
    failed += 1;
    console.error("FAIL:", c.name);
    console.error("  mapIconUrl:", map, "expected:", c.expectMap);
    console.error("  product:   ", product, "expected:", c.expectProduct);
    if (mapBad) console.error("  ERROR: map still uses -icon URL");
  } else {
    console.log("OK:", c.name);
  }
}

const pin = formatSilentDropMapPin(
  {
    id: "f40e5b1a-8c65-46de-8124-76af773ae70f",
    title: "KFC",
    latitude: 33.565,
    longitude: 73.152,
    collectionMethod: "BUSINESS_QR",
    imageUrl: "",
    commanderAvatar: ICON,
  },
  33.565,
  73.15,
  null
);

if (pin.mapIconUrl !== null) {
  failed += 1;
  console.error("FAIL: formatSilentDropMapPin KFC should mapIconUrl=null got", pin.mapIconUrl);
} else {
  console.log("OK: formatSilentDropMapPin KFC (no burger on map)");
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll silent drop map icon tests passed.");