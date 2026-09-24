import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as CustomersService from "./customers.service";
import { prisma } from "../../config/database";

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await CustomersService.createCustomer(req.body);
  await prisma.activityLog
    .create({
      data: {
        userId: req.user?.id,
        action: "CUSTOMER_CREATED",
        entityType: "User",
        entityId: customer?.id,
        ipAddress: req.ip,
        metadata: { email: customer?.email, firstName: customer?.firstName, lastName: customer?.lastName },
      },
    })
    .catch(() => {});
  return ApiResponse.created(res, "Customer created successfully.", customer);
});

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await CustomersService.listCustomers(req.query as never);
  return ApiResponse.paginated(res, "Customers fetched.", result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const getCounts = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const counts = await CustomersService.getCustomerCounts();
  return ApiResponse.success(res, "Customer counts fetched.", counts);
});

export const getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await CustomersService.getCustomer(req.params.id);
  return ApiResponse.success(res, "Customer fetched.", customer);
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await CustomersService.updateCustomerProfile(req.params.id, req.body);
  await prisma.activityLog
    .create({
      data: {
        userId: req.user?.id,
        action: "CUSTOMER_UPDATED",
        entityType: "User",
        entityId: String(req.params.id),
        ipAddress: req.ip,
        metadata: { email: customer?.email },
      },
    })
    .catch(() => {});
  return ApiResponse.success(res, "Customer updated.", customer);
});

export const approve = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await CustomersService.approveCustomer(req.params.id);
  await prisma.activityLog
    .create({
      data: {
        userId: req.user?.id,
        action: "CUSTOMER_APPROVED",
        entityType: "User",
        entityId: String(req.params.id),
        ipAddress: req.ip,
        metadata: { email: customer?.email },
      },
    })
    .catch(() => {});
  return ApiResponse.success(res, "Customer approved.", customer);
});

export const reject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await CustomersService.rejectCustomer(req.params.id);
  await prisma.activityLog
    .create({
      data: {
        userId: req.user?.id,
        action: "CUSTOMER_REJECTED",
        entityType: "User",
        entityId: String(req.params.id),
        ipAddress: req.ip,
        metadata: { email: customer?.email },
      },
    })
    .catch(() => {});
  return ApiResponse.success(res, "Customer rejected.", customer);
});

export const updateTier = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tierId = req.body?.tierId === "" ? null : req.body?.tierId ?? null;
  const customer = await CustomersService.updateCustomerTier(req.params.id, tierId);
  return ApiResponse.success(res, "Customer tier updated.", customer);
});

export const updateRole = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customerRoleId = String(req.body?.customerRoleId ?? "").trim();
  if (!customerRoleId) throw new AppError("Customer role is required.", 400);
  const customer = await CustomersService.updateCustomerRole(req.params.id, customerRoleId);
  return ApiResponse.success(res, "Customer role updated.", customer);
});

export const listOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const orders = await CustomersService.listCustomerOrders(req.params.id);
  return ApiResponse.success(res, "Customer orders fetched.", orders);
});

export const listAddresses = asyncHandler(async (req: AuthRequest, res: Response) => {
  const addresses = await CustomersService.listCustomerAddresses(req.params.id);
  return ApiResponse.success(res, "Customer addresses fetched.", addresses);
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await CustomersService.deleteCustomer(String(req.params.id));
  await prisma.activityLog
    .create({
      data: {
        userId: req.user?.id,
        action: "CUSTOMER_DELETED",
        entityType: "User",
        entityId: String(req.params.id),
        ipAddress: req.ip,
      },
    })
    .catch(() => {});
  return ApiResponse.success(res, "Customer deleted.");
});

export const restore = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await CustomersService.restoreCustomer(String(req.params.id));
  await prisma.activityLog
    .create({
      data: {
        userId: req.user?.id,
        action: "CUSTOMER_RESTORED",
        entityType: "User",
        entityId: String(req.params.id),
        ipAddress: req.ip,
      },
    })
    .catch(() => {});
  return ApiResponse.success(res, "Customer restored.", customer);
});

export const updateAddress = asyncHandler(async (req: AuthRequest, res: Response) => {
  const updated = await CustomersService.updateCustomerAddress(
    String(req.params.id),
    String(req.params.addressId),
    req.body,
  );
  return ApiResponse.success(res, "Customer address updated.", updated);
});
