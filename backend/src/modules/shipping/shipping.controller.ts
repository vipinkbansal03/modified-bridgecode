import { Request, Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./shipping.service";
import { calculateShipment } from "./shippingCalculator.service";

// ─── Providers ──────────────────────────────────────────

export const listProviders = asyncHandler(async (_r: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Providers.", await S.listProviders())
);

export const getProvider = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Provider.", await S.getProvider(String(req.params.id)))
);

export const upsertProvider = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await S.upsertProvider(req.body);
  return ApiResponse.success(res, "Provider saved.", result);
});

export const toggleProvider = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Provider toggled.", await S.toggleProvider(String(req.params.id)))
);

export const testConnection = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Connection test completed.", await S.testConnection(String(req.params.id), req.body))
);

export const getDefaultRate = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Default rate.", await S.getDefaultRate(String(req.params.id), String(req.body?.countryCode ?? "")))
);

// ─── Zones ──────────────────────────────────────────────

export const listZones = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { providerId, countryId, status } = req.query as { providerId?: string; countryId?: string; status?: string };
  return ApiResponse.success(res, "Zones.", await S.listZones({ providerId, countryId, status }));
});

export const createZone = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Zone created.", await S.createZone(req.body))
);

export const updateZone = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Zone updated.", await S.updateZone(String(req.params.id), req.body))
);

export const deleteZone = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Zone deleted.", await S.deleteZone(String(req.params.id)))
);

export const bulkUpdateZones = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await S.bulkUpdateZones(req.body);
  return ApiResponse.success(res, "Bulk shipping zone action completed.", result);
});

// ─── Calculation ────────────────────────────────────────

export const calculate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { countryCode, orderTotal } = req.body as { countryCode: string; orderTotal: number };
  return ApiResponse.success(res, "Shipping calculated.", await S.calculateShipping(countryCode, orderTotal));
});

export const calculatePackages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { items, countryCode, orderTotal } = req.body as {
    items: { productId: string; quantity: number }[];
    countryCode?: string;
    orderTotal?: number;
  };
  const packages = await calculateShipment(items, { countryCode: countryCode ? String(countryCode).toUpperCase() : undefined });
  if (countryCode) {
    packages.pricing = await S.calculateShipping(String(countryCode).toUpperCase(), Number(orderTotal ?? 0));
  }
  return ApiResponse.success(res, "Package calculation completed.", packages);
});

export const calculatePublic = asyncHandler(async (req: Request, res: Response) => {
  const { countryCode, orderValue, orderTotal } = req.body as { countryCode?: string; orderValue?: number; orderTotal?: number };
  return ApiResponse.success(res, "Shipping calculated.", await S.calculateShipping(String(countryCode ?? "").toUpperCase(), Number(orderValue ?? orderTotal ?? 0)));
});

export const availableProviders = asyncHandler(async (req: Request, res: Response) => {
  const { countryCode, orderValue, orderTotal } = req.body as { countryCode?: string; orderValue?: number; orderTotal?: number };
  const result = await S.getAvailableProviders(String(countryCode ?? "").toUpperCase(), Number(orderValue ?? orderTotal ?? 0));
  return ApiResponse.success(res, "Available providers.", result);
});

// ─── Shipments ──────────────────────────────────────────

export const listShipments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { orderId, status, providerId, page, limit } = req.query as { orderId?: string; status?: string; providerId?: string; page?: string; limit?: string };
  const r = await S.listShipments({ orderId, status, providerId, page, limit });
  return ApiResponse.paginated(res, "Shipments.", r.data, { page: r.page, limit: r.limit, total: r.total });
});

export const getShipment = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Shipment.", await S.getShipment(String(req.params.id)))
);

export const getShipmentsForOrder = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Shipments.", await S.getShipmentsForOrder(String(req.params.orderId)))
);

export const createShipment = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Shipment created.", await S.createShipment(req.body))
);

export const updateShipment = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Shipment updated.", await S.updateShipment(String(req.params.id), req.body))
);

export const updateShipmentStatus = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Shipment status updated.", await S.updateShipmentStatus(String(req.params.id), req.body))
);

export const addShipmentEvent = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Event added.", await S.addShipmentEvent(String(req.params.id), req.body))
);

export const trackShipment = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Tracking info.", await S.trackShipmentFromProvider(String(req.params.id)))
);

export const cancelShipment = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Cancel result.", await S.cancelShipmentFromProvider(String(req.params.id)))
);

export const deleteShipment = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteShipment(String(req.params.id));
  return ApiResponse.success(res, "Shipment deleted.");
});
