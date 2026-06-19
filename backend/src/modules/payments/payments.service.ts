import { prisma } from "../../config/database";
// Gateway credentials should be encrypted at rest — this is a minimal scaffold.
export const listGateways = () => prisma.paymentGateway.findMany({ select: { id: true, provider: true, displayName: true, isEnabled: true, countries: true, updatedAt: true } });
export const upsertGateway = (data: object) => prisma.paymentGateway.upsert({
  where: { provider: (data as {provider: never}).provider },
  create: data as never,
  update: data as never,
  select: { id: true, provider: true, displayName: true, isEnabled: true, countries: true }
});
