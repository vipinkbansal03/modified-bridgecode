import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

export type CalculatorItem = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export type CalculatorBoxPack = {
  boxId: string;
  name: string;
  length: number;
  width: number;
  height: number;
  maxWeight: number;
  weight: number;
  volume: number;
  units: {
    productId: string;
    title: string;
    quantity: number;
    weight: number;
    length: number;
    width: number;
    height: number;
  }[];
};

export type CalculatorResult = {
  totalWeight: number;
  totalVolume: number;
  box: {
    id: string;
    name: string;
    length: number;
    width: number;
    height: number;
    maxWeight: number;
  } | null;
  boxes: CalculatorBoxPack[];
  items: {
    productId: string;
    title: string;
    quantity: number;
    weight: number;
    length: number;
    width: number;
    height: number;
  }[];
  pricing?: {
    available: boolean;
    charge: number;
    isFree: boolean;
    provider: string | null;
    providerId: string | null;
    zoneId: string | null;
    estimatedDays: string | null;
    message?: string;
  };
};

async function getProductShippingInfo(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      packageWeight: true,
      packageLength: true,
      packageWidth: true,
      packageHeight: true,
      fragile: true,
      hazardous: true,
      variants: {
        where: { status: "ACTIVE" },
        select: { id: true, weight: true, length: true, width: true, height: true },
      },
    },
  });
  if (!product) throw new AppError(`Product ${productId} not found.`, 404);
  return product;
}

function toNumber(val: any): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

/** True when the unit fits inside the box in at least one orientation. */
function fitsInBox(box: { length: number; width: number; height: number; maxWeight: number }, unit: { length: number; width: number; height: number; weight: number }): boolean {
  if (unit.weight > box.maxWeight) return false;
  if (unit.length <= 0 || unit.width <= 0 || unit.height <= 0) return true;
  const u = [unit.length, unit.width, unit.height];
  const orientations = [
    [u[0], u[1], u[2]],
    [u[0], u[2], u[1]],
    [u[1], u[0], u[2]],
    [u[1], u[2], u[0]],
    [u[2], u[0], u[1]],
    [u[2], u[1], u[0]],
  ];
  return orientations.some(([l, w, h]) => l <= box.length && w <= box.width && h <= box.height);
}

/**
 * Resolve the item's shipping dimensions. Prefers the product's package fields
 * and falls back to the variant's own dimensions when the package fields are
 * missing.
 */
function resolveUnitDims(product: {
  packageWeight: unknown;
  packageLength: unknown;
  packageWidth: unknown;
  packageHeight: unknown;
  variants: { id: string; weight: unknown; length: unknown; width: unknown; height: unknown }[];
}, variantId?: string | null) {
  let weight = toNumber(product.packageWeight);
  let length = toNumber(product.packageLength);
  let width = toNumber(product.packageWidth);
  let height = toNumber(product.packageHeight);

  if (!weight || !length || !width || !height) {
    const fallback =
      product.variants.find((v) => v.id === variantId) ?? product.variants[0] ?? null;
    weight = weight || toNumber(fallback?.weight);
    length = length || toNumber(fallback?.length);
    width = width || toNumber(fallback?.width);
    height = height || toNumber(fallback?.height);
  }

  return { weight, length, width, height };
}

export async function calculateShipment(
  items: CalculatorItem[],
  options?: { countryId?: string; countryCode?: string },
): Promise<CalculatorResult> {
  if (!items.length) throw new AppError("No items to ship.", 400);

  const country = options?.countryId
    ? { id: options.countryId }
    : options?.countryCode
    ? await prisma.country.findUnique({ where: { code: options.countryCode.toUpperCase() }, select: { id: true } })
    : null;
  // Boxes scoped to the country apply; legacy boxes with no country assignment
  // remain available globally to preserve existing checkout behaviour.
  const activeBoxes = country
    ? await prisma.shippingBox.findMany({
        where: {
          isActive: true,
          OR: [{ countries: { some: { countryId: country.id } } }, { countries: { none: {} } }],
        },
      })
    : await prisma.shippingBox.findMany({ where: { isActive: true } });

  const boxes = activeBoxes
    .map((box) => ({
      id: box.id,
      name: box.name,
      length: toNumber(box.length),
      width: toNumber(box.width),
      height: toNumber(box.height),
      maxWeight: toNumber(box.maxWeight),
    }))
    .sort(
      (a, b) =>
        a.length * a.width * a.height - b.length * b.width * b.height ||
        a.maxWeight - b.maxWeight,
    );

  let totalWeight = 0;
  let totalVolume = 0;
  const itemDetails: CalculatorResult["items"] = [];
  const packs: CalculatorBoxPack[] = [];

  for (const item of items) {
    const product = await getProductShippingInfo(item.productId);
    const qty = Math.max(1, item.quantity);
    const dims = resolveUnitDims(product, item.variantId);

    totalWeight += dims.weight * qty;
    totalVolume += dims.length * dims.width * dims.height * qty;

    itemDetails.push({
      productId: product.id,
      title: product.title,
      quantity: qty,
      weight: dims.weight,
      length: dims.length,
      width: dims.width,
      height: dims.height,
    });

    const candidates = boxes.filter((box) => fitsInBox(box, dims));
    if (!candidates.length) {
      throw new AppError(
        `No shipping box is large enough to fit ${product.title}. Contact admin to add a suitable box for this country.`,
        400,
      );
    }

    for (let i = 0; i < qty; i++) {
      const usable = packs.filter(
        (pack) =>
          pack.weight + dims.weight <= pack.maxWeight &&
          pack.volume + dims.length * dims.width * dims.height <= pack.length * pack.width * pack.height &&
          fitsInBox(pack, dims),
      );
      const existing = usable.sort((a, b) => a.length * a.width * a.height - b.length * b.width * b.height)[0];

      const pack = existing ?? (() => {
        const box = candidates[0];
        const created: CalculatorBoxPack = {
          boxId: box.id,
          name: box.name,
          length: box.length,
          width: box.width,
          height: box.height,
          maxWeight: box.maxWeight,
          weight: 0,
          volume: 0,
          units: [],
        };
        packs.push(created);
        return created;
      })();

      pack.weight += dims.weight;
      pack.volume += dims.length * dims.width * dims.height;

      const existingUnit = pack.units.find((u) => u.productId === product.id);
      if (existingUnit) {
        existingUnit.quantity += 1;
      } else {
        pack.units.push({
          productId: product.id,
          title: product.title,
          quantity: 1,
          weight: dims.weight,
          length: dims.length,
          width: dims.width,
          height: dims.height,
        });
      }
    }
  }

  const primary = packs.reduce<CalculatorBoxPack | null>(
    (max, pack) => (max === null || pack.weight > max.weight ? pack : max),
    null,
  );

  return {
    totalWeight,
    totalVolume,
    box: primary
      ? {
          id: primary.boxId,
          name: primary.name,
          length: primary.length,
          width: primary.width,
          height: primary.height,
          maxWeight: primary.maxWeight,
        }
      : null,
    boxes: packs,
    items: itemDetails,
  };
}
