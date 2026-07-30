import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

export type CalculatorItem = {
  productId: string;
  variantId?: string | null;
  quantity: number;
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
  items: {
    productId: string;
    title: string;
    quantity: number;
    weight: number;
    length: number;
    width: number;
    height: number;
  }[];
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

export async function calculateShipment(items: CalculatorItem[]): Promise<CalculatorResult> {
  if (!items.length) throw new AppError("No items to ship.", 400);

  let totalWeight = 0;
  let totalVolume = 0;
  const itemDetails: CalculatorResult["items"] = [];

  for (const item of items) {
    const product = await getProductShippingInfo(item.productId);
    const qty = Math.max(1, item.quantity);

    const weight = toNumber(product.packageWeight);
    const length = toNumber(product.packageLength);
    const width = toNumber(product.packageWidth);
    const height = toNumber(product.packageHeight);

    totalWeight += weight * qty;
    totalVolume += length * width * height * qty;

    itemDetails.push({
      productId: product.id,
      title: product.title,
      quantity: qty,
      weight,
      length,
      width,
      height,
    });
  }

  const activeBoxes = await prisma.shippingBox.findMany({
    where: { isActive: true },
    orderBy: [{ maxWeight: "asc" }, { length: "asc" }, { width: "asc" }, { height: "asc" }],
  });

  let selectedBox: CalculatorResult["box"] = null;

  for (const box of activeBoxes) {
    const boxWeight = toNumber(box.maxWeight);
    if (totalWeight > 0 && boxWeight >= totalWeight) {
      selectedBox = {
        id: box.id,
        name: box.name,
        length: toNumber(box.length),
        width: toNumber(box.width),
        height: toNumber(box.height),
        maxWeight: boxWeight,
      };
      break;
    }
  }

  return {
    totalWeight,
    totalVolume,
    box: selectedBox,
    items: itemDetails,
  };
}
