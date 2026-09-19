import { BannerPlacement, Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { optimizeAndUploadPublicImage, getMediaUrl, deletePublicMediaVariants } from "../../shared/media";


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

export async function uploadBannerImage(buffer: Buffer, bannerId?: string) {
  const uploadResult = await optimizeAndUploadPublicImage({
    buffer,
    folder: "banners",
    presetName: "banner",
    entityId: bannerId,
  });

  const desktopKey = uploadResult.variants.desktop || uploadResult.primaryKey;
  const mobileKey = uploadResult.variants.mobile || desktopKey;

  return {
    uploadId: uploadResult.uploadId,
    desktopKey,
    desktopUrl: getMediaUrl(desktopKey) || "",
    mobileKey,
    mobileUrl: getMediaUrl(mobileKey) || "",
    variants: uploadResult.variants,
  };
}

function optionalDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError("Invalid date value.", 400);
  return date;
}

function normalize(input: BannerInput, current?: BannerInput) {
  const merged = { ...(current ?? {}), ...input };
  const title = merged.title !== undefined ? (merged.title?.trim() ?? "") : (current?.title ?? "");
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
    image: getMediaUrl(banner.image) || banner.image,
    mobileImage: getMediaUrl(banner.mobileImage) || banner.mobileImage,
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

const SINGLE_SLOT_PLACEMENTS: BannerPlacement[] = ["HOMEPAGE_PROMO", "ABOUT_HERO"];

function getPlacementDisplayName(placement: BannerPlacement): string {
  switch (placement) {
    case "HOMEPAGE_HERO":
      return "Homepage Hero";
    case "HOMEPAGE_PROMO":
      return "Homepage Mid-Page Promo";
    case "ABOUT_HERO":
      return "About Us Hero";
    default:
      return String(placement).replace(/_/g, " ");
  }
}

export async function getBanner(id: string) {
  const banner = await prisma.banner.findUnique({ where: { id }, include: bannerInclude });
  if (!banner) throw new AppError("Banner not found.", 404);
  return formatBannerResponse(banner);
}

export async function createBanner(input: BannerInput) {
  const data = normalize(input);

  if (SINGLE_SLOT_PLACEMENTS.includes(data.placement)) {
    const existingCount = await prisma.banner.count({
      where: { placement: data.placement },
    });
    if (existingCount > 0) {
      const name = getPlacementDisplayName(data.placement);
      throw new AppError(
        `${name} supports only a single banner. Please edit the existing banner instead of creating a duplicate.`,
        400
      );
    }
  }

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

async function ensureAtLeastOneActiveBanner(placement: BannerPlacement, deactivatingIds: string[]) {
  const remainingActiveCount = await prisma.banner.count({
    where: {
      placement,
      status: true,
      id: { notIn: deactivatingIds },
    },
  });

  if (remainingActiveCount === 0) {
    const displayName = getPlacementDisplayName(placement);
    throw new AppError(
      `At least one ${displayName} slide must remain active. Please activate another slide before deactivating or deleting this one.`,
      400
    );
  }
}

export async function updateBanner(id: string, input: BannerInput) {
  const current = await getBanner(id);
  const data = normalize(input, current as any);

  if (
    data.placement !== current.placement &&
    SINGLE_SLOT_PLACEMENTS.includes(data.placement)
  ) {
    const existingCount = await prisma.banner.count({
      where: { placement: data.placement, id: { not: id } },
    });
    if (existingCount > 0) {
      const name = getPlacementDisplayName(data.placement);
      throw new AppError(
        `${name} supports only a single banner. Another banner already exists for this placement.`,
        400
      );
    }
  }

  const { countryIds, ...bannerData } = data;

  if (
    current.placement === "HOMEPAGE_HERO" &&
    current.status &&
    (!data.status || data.placement !== current.placement)
  ) {
    await ensureAtLeastOneActiveBanner(current.placement, [id]);
  }

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
  const current = await prisma.banner.findUnique({ where: { id } });
  if (!current) throw new AppError("Banner not found.", 404);

  if (current.placement === "HOMEPAGE_HERO" && current.status) {
    await ensureAtLeastOneActiveBanner(current.placement, [id]);
  }

  await prisma.banner.delete({ where: { id } });

  // Clean up owned S3 public media objects (ignoring legacy external URLs)
  const keysToDelete = [current.image, current.mobileImage].filter(
    (k): k is string =>
      typeof k === "string" &&
      !k.startsWith("http://") &&
      !k.startsWith("https://") &&
      !k.startsWith("data:") &&
      k.startsWith("banners/")
  );

  if (keysToDelete.length > 0) {
    await deletePublicMediaVariants(keysToDelete);
  }
}

export async function reorderBanners(ids: string[]) {
  if (!Array.isArray(ids)) throw new AppError("Reorder payload must include ids.", 400);
  await prisma.$transaction(ids.map((id, sortOrder) => prisma.banner.update({ where: { id }, data: { sortOrder } })));
  return listBanners({});
}

export async function bulkUpdateBanners(input: { ids?: string[]; action?: "enable" | "disable" | "delete" }) {
  const ids = Array.from(new Set(input.ids ?? []));
  if (!ids.length) throw new AppError("Select at least one banner.", 400);

  if (input.action === "disable" || input.action === "delete") {
    const activeHeroBanners = await prisma.banner.findMany({
      where: { id: { in: ids }, placement: "HOMEPAGE_HERO", status: true },
    });
    if (activeHeroBanners.length > 0) {
      await ensureAtLeastOneActiveBanner("HOMEPAGE_HERO", ids);
    }

    const activePromoBanners = await prisma.banner.findMany({
      where: { id: { in: ids }, placement: "HOMEPAGE_PROMO", status: true },
    });
    if (activePromoBanners.length > 0) {
      await ensureAtLeastOneActiveBanner("HOMEPAGE_PROMO", ids);
    }
  }

  if (input.action === "delete") {
    const bannersToDelete = await prisma.banner.findMany({
      where: { id: { in: ids } },
      select: { image: true, mobileImage: true },
    });

    await prisma.banner.deleteMany({ where: { id: { in: ids } } });

    const keysToDelete: string[] = [];
    for (const b of bannersToDelete) {
      if (
        b.image &&
        !b.image.startsWith("http://") &&
        !b.image.startsWith("https://") &&
        !b.image.startsWith("data:") &&
        b.image.startsWith("banners/")
      ) {
        keysToDelete.push(b.image);
      }
      if (
        b.mobileImage &&
        !b.mobileImage.startsWith("http://") &&
        !b.mobileImage.startsWith("https://") &&
        !b.mobileImage.startsWith("data:") &&
        b.mobileImage.startsWith("banners/")
      ) {
        keysToDelete.push(b.mobileImage);
      }
    }

    if (keysToDelete.length > 0) {
      await deletePublicMediaVariants(keysToDelete);
    }

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

  const countryCondition: Prisma.BannerWhereInput = country
    ? {
        OR: [
          { countryId: null, countries: { none: {} } },
          { countryId: country.id },
          { countries: { some: { countryId: country.id } } },
        ],
      }
    : {
        OR: [
          { countryId: null },
          { countries: { none: {} } },
        ],
      };

  const banners = await prisma.banner.findMany({
    where: {
      placement: query.placement,
      status: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        countryCondition,
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: bannerInclude,
  });

  return banners.map(formatBannerResponse);
}


