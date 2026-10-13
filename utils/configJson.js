/** Parse Prisma Json config field to number array. */
export const parseJsonIntArray = (value, fallback = []) => {
  if (Array.isArray(value)) {
    return value.map((v) => parseInt(v, 10)).filter((n) => !Number.isNaN(n));
  }
  if (typeof value === "string") {
    try {
      return parseJsonIntArray(JSON.parse(value), fallback);
    } catch {
      return fallback;
    }
  }
  return fallback;
};
