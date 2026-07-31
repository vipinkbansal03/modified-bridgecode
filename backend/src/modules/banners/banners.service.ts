import { BannerPlacement, Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

type BannerInput = {
  title?: string;
  image?: string;
  mobileImage?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
  placement?: BannerPlacement;
  countryId?: string | null;
  countryIds?: string[] | null;
  sortOrder?: number | string | null;
  status?: boolean;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
};

function optionalDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError("Invalid date value.", 400);
  return date;
}

function normalize(input: BannerInput, current?: BannerInput) {
  const merged = { ...(current ?? {}), ...input };
  const title = merged.title?.trim();
  if (!title) throw new AppError("Banner title is required.", 400);
  const image = merged.image?.trim();
  if (!image) throw new AppError("Banner image is required.", 400);
  const placement = merged.placement;
  if (!placement) throw new AppError("Banner placement is required.", 400);
  const startDate = optionalDate(merged.startDate);
  const endDate = optionalDate(merged.endDate);
  if (startDate && endDate && endDate < startDate) throw new AppError("End date must be after start date.", 400);

  const rawCountryIds = Array.isArray(merged.countryIds)
    ? merged.countryIds.filter(Boolean)
    : merged.countryId
    ? [merged.countryId]
    : [];
  const countryIds = [...new Set(rawCountryIds)];
  const countryId = countryIds[0] ?? (merged.countryId || null);

  return {
    title,
    image,
    mobileImage: merged.mobileImage?.trim() || null,
    linkUrl: merged.linkUrl?.trim() || null,
    linkText: merged.linkText?.trim() || null,
    placement,
    countryId,
    countryIds,
    sortOrder: Number(merged.sortOrder ?? 0) || 0,
    status: merged.status ?? true,
    startDate,
    endDate,
  };
}

const bannerInclude = {
  country: true,
  countries: {
    include: { country: true },
  },
};

function formatBannerResponse(banner: any) {
  const countryIds = banner.countries?.length > 0
    ? banner.countries.map((c: any) => c.countryId)
    : (banner.countryId ? [banner.countryId] : []);
  return {
    ...banner,
    countryIds,
  };
}

export async function listBanners(query: { placement?: BannerPlacement; countryId?: string; status?: string }) {
  const where: Prisma.BannerWhereInput = {
    ...(query.placement ? { placement: query.placement } : {}),
    ...(query.countryId
      ? {
          OR: [
            { countryId: query.countryId },
            { countries: { some: { countryId: query.countryId } } },
          ],
        }
      : {}),
    ...(query.status !== undefined && query.status !== "" ? { status: query.status === "true" || query.status === "ACTIVE" } : {}),
  };
  const banners = await prisma.banner.findMany({
    where,
    orderBy: [{ placement: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    include: bannerInclude,
  });
  return banners.map(formatBannerResponse);
}

export async function getBanner(id: string) {
  const banner = await prisma.banner.findUnique({ where: { id }, include: bannerInclude });
  if (!banner) throw new AppError("Banner not found.", 404);
  return formatBannerResponse(banner);
}

export async function createBanner(input: BannerInput) {
  const data = normalize(input);
  const { countryIds, ...bannerData } = data;
  const banner = await prisma.banner.create({
    data: {
      ...bannerData,
      countries: countryIds.length > 0
        ? { create: countryIds.map((cId) => ({ countryId: cId })) }
        : undefined,
    } as Prisma.BannerUncheckedCreateInput,
    include: bannerInclude,
  });
  return formatBannerResponse(banner);
}

export async function updateBanner(id: string, input: BannerInput) {
  const current = await getBanner(id);
  const data = normalize(input, current as any);
  const { countryIds, ...bannerData } = data;

  await prisma.bannerCountry.deleteMany({ where: { bannerId: id } });

  const banner = await prisma.banner.update({
    where: { id },
    data: {
      ...bannerData,
      countries: countryIds.length > 0
        ? { create: countryIds.map((cId) => ({ countryId: cId })) }
        : undefined,
    } as Prisma.BannerUncheckedUpdateInput,
    include: bannerInclude,
  });
  return formatBannerResponse(banner);
}

export async function deleteBanner(id: string) {
  await getBanner(id);
  await prisma.banner.delete({ where: { id } });
}

export async function reorderBanners(ids: string[]) {
  if (!Array.isArray(ids)) throw new AppError("Reorder payload must include ids.", 400);
  await prisma.$transaction(ids.map((id, sortOrder) => prisma.banner.update({ where: { id }, data: { sortOrder } })));
  return listBanners({});
}

export async function bulkUpdateBanners(input: { ids?: string[]; action?: "enable" | "disable" | "delete" }) {
  const ids = Array.from(new Set(input.ids ?? []));
  if (!ids.length) throw new AppError("Select at least one banner.", 400);
  if (input.action === "delete") {
    await prisma.banner.deleteMany({ where: { id: { in: ids } } });
    return { updated: ids.length };
  }
  if (input.action === "enable" || input.action === "disable") {
    await prisma.banner.updateMany({ where: { id: { in: ids } }, data: { status: input.action === "enable" } });
    return { updated: ids.length };
  }
  throw new AppError("Unsupported bulk action.", 400);
}

export async function listPublicBanners(query: { placement?: BannerPlacement; countryCode?: string }) {
  if (!query.placement) throw new AppError("placement is required.", 400);
  const country = query.countryCode
    ? await prisma.country.findUnique({ where: { code: query.countryCode.toUpperCase() } })
    : null;
  const now = new Date();
  return prisma.banner.findMany({
    where: {
      placement: query.placement,
      status: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        { OR: [{ countryId: null }, ...(country ? [{ countryId: country.id }] : [])] },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { country: true },
  });
}
