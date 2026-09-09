import { prisma } from "../../config/database";
import { encrypt, decrypt } from "../../utils/encrypt";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SettingInput = {
  key: string;
  value: string;
  group?: string;
  label?: string;
  type?: string;
  isSecret?: boolean;
  isEnabled?: boolean;
};

type LoginSlideSetting = {
  image: string;
  heading: string;
  subHeading: string;
  isVisible: boolean;
};

const DEFAULT_LOGIN_SLIDES: LoginSlideSetting[] = [
  {
    image: "/auth/login1.jpg",
    heading: "Modern orthodontic care designed for confident smiles.",
    subHeading: "Premium products and account access for dental professionals.",
    isVisible: true,
  },
  {
    image: "/auth/login2.jpg",
    heading: "Track your treatment journey with ease and comfort.",
    subHeading: "Manage orders, quotes, and account details in one secure place.",
    isVisible: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mask(s: { value: string; isSecret: boolean }) {
  if (!s.isSecret || !s.value) return s.value;
  return "***";
}

function read(s: { value: string; isSecret: boolean }): string {
  if (s.isSecret && s.value && s.value !== "***") return decrypt(s.value);
  return s.value;
}

// ─── Admin reads ──────────────────────────────────────────────────────────────

export async function getSettings(group?: string) {
  const rows = await prisma.setting.findMany({
    where: group ? { group } : {},
    orderBy: [{ group: "asc" }, { key: "asc" }],
  });
  return rows.map((s) => ({ ...s, value: mask(s) }));
}

export async function getSettingValue(key: string): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { key } });
  if (!s) return "";
  return read(s);
}

// ─── Admin writes ─────────────────────────────────────────────────────────────

export async function upsertSetting(input: SettingInput) {
  const isSecret = input.isSecret ?? false;
  const raw = input.value ?? "";
  const value = isSecret && raw && raw !== "***" ? encrypt(raw) : raw;

  return prisma.setting.upsert({
    where: { key: input.key },
    create: {
      key: input.key,
      value,
      group: input.group ?? "general",
      label: input.label,
      type: input.type ?? "string",
      isSecret,
      isEnabled: input.isEnabled ?? true,
    },
    update: {
      ...(raw !== "***" && { value }),
      ...(input.group !== undefined && { group: input.group }),
      ...(input.label !== undefined && { label: input.label }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.isEnabled !== undefined && { isEnabled: input.isEnabled }),
    },
  });
}

async function syncShippingProvidersFromSettings() {
  try {
    const dhlEnabled = await getSettingValue("shipping.dhl_enabled");
    const dhlApiKey = await getSettingValue("shipping.dhl_api_key");
    const dhlApiSecret = await getSettingValue("shipping.dhl_api_secret");
    const dhlBaseUrl = await getSettingValue("shipping.dhl_base_url");

    if (dhlApiKey || dhlBaseUrl || dhlEnabled) {
      await prisma.shippingProvider.upsert({
        where: { name: "DHL" },
        update: {
          ...(dhlApiKey && { apiKey: dhlApiKey }),
          ...(dhlApiSecret && { apiSecret: dhlApiSecret }),
          ...(dhlBaseUrl && { baseUrl: dhlBaseUrl }),
          ...(dhlEnabled !== "" && { isEnabled: dhlEnabled === "true" }),
        },
        create: {
          name: "DHL",
          displayName: "DHL Express",
          apiKey: dhlApiKey || null,
          apiSecret: dhlApiSecret || null,
          baseUrl: dhlBaseUrl || "https://api.dhl.com/mydhlapi",
          trackingUrl: "https://track.dhl.com/{tracking}",
          isEnabled: dhlEnabled === "true",
          config: {},
        },
      });
    }

    const dtdcEnabled = await getSettingValue("shipping.dtdc_enabled");
    const dtdcApiKey = await getSettingValue("shipping.dtdc_api_key");
    const dtdcBaseUrl = await getSettingValue("shipping.dtdc_base_url");
    const dtdcCustomerCode = await getSettingValue("shipping.dtdc_customer_code");

    if (dtdcApiKey || dtdcBaseUrl || dtdcEnabled || dtdcCustomerCode) {
      await prisma.shippingProvider.upsert({
        where: { name: "DTDC" },
        update: {
          ...(dtdcApiKey && { apiKey: dtdcApiKey }),
          ...(dtdcBaseUrl && { baseUrl: dtdcBaseUrl }),
          ...(dtdcEnabled !== "" && { isEnabled: dtdcEnabled === "true" }),
          ...(dtdcCustomerCode && { config: { customerCode: dtdcCustomerCode } }),
        },
        create: {
          name: "DTDC",
          displayName: "DTDC Courier",
          apiKey: dtdcApiKey || null,
          baseUrl: dtdcBaseUrl || "https://api.dtdc.in",
          trackingUrl: "https://www.dtdc.in/tracking/{tracking}",
          isEnabled: dtdcEnabled === "true",
          config: dtdcCustomerCode ? { customerCode: dtdcCustomerCode } : {},
        },
      });
    }
  } catch (err) {
    // Non-blocking sync error
  }
}

async function syncPaymentMethodsFromSettings() {
  try {
    const rzpEnabled = await getSettingValue("payment.razorpay_enabled");
    const rzpKeyId = await getSettingValue("payment.razorpay_key_id");

    if (rzpEnabled !== "") {
      await prisma.paymentMethod.updateMany({
        where: { code: "RAZORPAY" },
        data: { isEnabled: rzpEnabled === "true" },
      });
    }

    if (rzpKeyId) {
      const pm = await prisma.paymentMethod.findUnique({ where: { code: "RAZORPAY" } });
      if (pm) {
        await prisma.paymentMethodConfig.upsert({
          where: {
            paymentMethodId_environment_configKey: {
              paymentMethodId: pm.id,
              environment: "PRODUCTION",
              configKey: "RAZORPAY_KEY_ID",
            },
          },
          update: { configValue: rzpKeyId },
          create: {
            paymentMethodId: pm.id,
            environment: "PRODUCTION",
            configKey: "RAZORPAY_KEY_ID",
            configValue: rzpKeyId,
            isPublic: true,
          },
        });
      }
    }

    const stripeEnabled = await getSettingValue("payment.stripe_enabled");
    const stripePublishableKey = await getSettingValue("payment.stripe_publishable_key");

    if (stripeEnabled !== "") {
      await prisma.paymentMethod.updateMany({
        where: { code: "STRIPE" },
        data: { isEnabled: stripeEnabled === "true" },
      });
    }

    if (stripePublishableKey) {
      const pm = await prisma.paymentMethod.findUnique({ where: { code: "STRIPE" } });
      if (pm) {
        await prisma.paymentMethodConfig.upsert({
          where: {
            paymentMethodId_environment_configKey: {
              paymentMethodId: pm.id,
              environment: "PRODUCTION",
              configKey: "STRIPE_PUBLISHABLE_KEY",
            },
          },
          update: { configValue: stripePublishableKey },
          create: {
            paymentMethodId: pm.id,
            environment: "PRODUCTION",
            configKey: "STRIPE_PUBLISHABLE_KEY",
            configValue: stripePublishableKey,
            isPublic: true,
          },
        });
      }
    }

    const cashfreeEnabled = await getSettingValue("payment.cashfree_enabled");

    if (cashfreeEnabled !== "") {
      await prisma.paymentMethod.updateMany({
        where: { code: "CASHFREE" },
        data: { isEnabled: cashfreeEnabled === "true" },
      });
    }
  } catch (err) {
    // Non-blocking sync error
  }
}

export async function upsertMany(inputs: SettingInput[]) {
  const results = await Promise.all(inputs.map(upsertSetting));
  await syncShippingProvidersFromSettings();
  await syncPaymentMethodsFromSettings();
  return results;
}

// ─── Public tracking endpoint ─────────────────────────────────────────────────

function val(map: Map<string, { value: string; isEnabled: boolean; isSecret: boolean }>, key: string): string {
  const s = map.get(key);
  if (!s) return "";
  if (s.isSecret) return decrypt(s.value);
  return s.value;
}

function enabled(map: Map<string, { value: string; isEnabled: boolean; isSecret: boolean }>, key: string): boolean {
  const s = map.get(key);
  if (!s) return false;
  if (s.value === "true") return true;
  if (s.value === "false") return false;
  return Boolean(s.isEnabled);
}

function str(map: Map<string, { value: string; isEnabled: boolean; isSecret: boolean }>, key: string): string | null {
  const v = val(map, key);
  return v || null;
}

function parseLoginSlides(value?: string): LoginSlideSetting[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((slide) => ({
        image: typeof slide?.image === "string" ? slide.image.trim() : "",
        heading: typeof slide?.heading === "string" ? slide.heading.trim() : "",
        subHeading: typeof slide?.subHeading === "string" ? slide.subHeading.trim() : "",
        isVisible: slide?.isVisible !== false,
      }))
      .filter((slide) => slide.image || slide.heading || slide.subHeading);
  } catch {
    return [];
  }
}

export async function getPublicTrackingSettings(countryCode?: string) {
  let currentRows = await prisma.setting.findMany({
    where: {
      group: {
        in: ["analytics", "pixels", "marketing", "social", "verification", "scripts", "cookies", "whatsapp", "seo", "general"],
      },
    },
  });

  const defaultCountry = await prisma.country.findFirst({ where: { isDefault: true } });
  const defaultCode = defaultCountry?.code?.toUpperCase() || "IN";

  // Check if default country has facebook_url set, if not run safe lazy migration
  const defaultFbKey = `social.${defaultCode}.facebook_url`;
  const defaultFbSetting = currentRows.find((r) => r.key === defaultFbKey);
  if (!defaultFbSetting) {
    const legacyKeys = [
      "social.facebook_url",
      "social.instagram_url",
      "social.linkedin_url",
      "social.youtube_url",
      "social.twitter_url",
      "social.pinterest_url",
    ];
    const legacyRows = currentRows.filter((r) => legacyKeys.includes(r.key) && r.value.trim().length > 0);
    if (legacyRows.length > 0) {
      const migratePromises = legacyRows.map(async (row) => {
        const platform = row.key.replace("social.", "").replace("_url", "");
        const newKey = `social.${defaultCode}.${platform}_url`;
        const exists = await prisma.setting.findUnique({ where: { key: newKey } });
        if (!exists) {
          return prisma.setting.create({
            data: {
              key: newKey,
              value: row.value,
              group: "social",
              label: `${row.label} (${defaultCode})`,
              type: "string",
            },
          });
        }
      });
      await Promise.all(migratePromises);

      // Refetch rows to include newly created settings
      currentRows = await prisma.setting.findMany({
        where: {
          group: {
            in: ["analytics", "pixels", "marketing", "social", "verification", "scripts", "cookies", "whatsapp", "seo", "general"],
          },
        },
      });
    }
  }

  const m = new Map(currentRows.map((r) => [r.key, { value: r.value, isEnabled: r.isEnabled, isSecret: r.isSecret }]));

  const activeCode = countryCode?.trim().toUpperCase();

  const getSocialUrl = (platform: string) => {
    if (activeCode) {
      const specificVal = str(m, `social.${activeCode}.${platform}_url`);
      if (specificVal) return specificVal;
    }
    const defaultVal = str(m, `social.${defaultCode}.${platform}_url`);
    if (defaultVal) return defaultVal;

    // For backwards compatibility, check the legacy non-country key
    return str(m, `social.${platform}_url`);
  };

  return {
    ga4: {
      enabled: enabled(m, "analytics.ga4_enabled"),
      measurementId: str(m, "analytics.ga4_measurement_id"),
    },
    gtm: {
      enabled: enabled(m, "analytics.gtm_enabled"),
      containerId: str(m, "analytics.gtm_container_id"),
    },
    clarity: {
      enabled: enabled(m, "analytics.clarity_enabled"),
      projectId: str(m, "analytics.clarity_project_id"),
    },
    hotjar: {
      enabled: enabled(m, "analytics.hotjar_enabled"),
      siteId: str(m, "analytics.hotjar_site_id"),
    },
    hubspot: {
      enabled: enabled(m, "analytics.hubspot_enabled"),
      trackingCode: str(m, "analytics.hubspot_tracking_code"),
    },
    metaPixel: {
      enabled: enabled(m, "pixels.meta_pixel_enabled"),
      pixelId: str(m, "pixels.meta_pixel_id"),
    },
    linkedin: {
      enabled: enabled(m, "pixels.linkedin_enabled"),
      partnerId: str(m, "pixels.linkedin_partner_id"),
    },
    twitter: {
      enabled: enabled(m, "pixels.twitter_enabled"),
      pixelId: str(m, "pixels.twitter_pixel_id"),
    },
    pinterest: {
      enabled: enabled(m, "pixels.pinterest_enabled"),
      tagId: str(m, "pixels.pinterest_tag_id"),
    },
    tiktok: {
      enabled: enabled(m, "pixels.tiktok_enabled"),
      pixelId: str(m, "pixels.tiktok_pixel_id"),
    },
    verification: {
      google: str(m, "verification.google"),
      bing: str(m, "verification.bing"),
      pinterest: str(m, "verification.pinterest"),
      facebookDomain: str(m, "verification.facebook_domain"),
      custom: str(m, "verification.custom"),
    },
    scripts: {
      header: str(m, "scripts.header"),
      footer: str(m, "scripts.footer"),
    },
    cookies: {
      enabled: enabled(m, "cookies.enabled"),
      bannerTitle: val(m, "cookies.banner_title") || "We use cookies",
      bannerDescription: val(m, "cookies.banner_description") || "We use cookies to improve your experience on our site.",
      privacyPolicyUrl: val(m, "cookies.privacy_policy_url") || "/privacy-policy",
    },
    whatsapp: {
      number: str(m, "whatsapp.number"),
      defaultMessage: str(m, "whatsapp.default_message"),
      floatingButtonEnabled: enabled(m, "whatsapp.floating_button_enabled"),
    },
    social: {
      facebook: getSocialUrl("facebook"),
      instagram: getSocialUrl("instagram"),
      linkedin: getSocialUrl("linkedin"),
      youtube: getSocialUrl("youtube"),
      twitter: getSocialUrl("twitter"),
      pinterest: getSocialUrl("pinterest"),
    },
    seo: {
      defaultTitle: val(m, "seo.default_title") || "Modern Orthodontics",
      defaultDescription: val(m, "seo.default_description") || "",
      defaultKeywords: str(m, "seo.default_keywords"),
      ogTitle: str(m, "seo.og_title"),
      ogDescription: str(m, "seo.og_description"),
      ogImage: str(m, "seo.og_image"),
      twitterImage: str(m, "seo.twitter_image"),
      canonicalDomain: str(m, "seo.canonical_domain"),
    },
    general: {
      siteName: val(m, "general.site_name") || "Modern Orthodontics",
      siteUrl: str(m, "general.site_url"),
      companyName: val(m, "general.company_name") || "Modern Orthodontics Pvt Ltd",
      email: str(m, "general.email") || "orders@modortho.com",
      phone: str(m, "general.phone") || "+91 161 2432024",
      address: str(m, "general.address") || "2024, Gobind Nagar, Circuit House Road, Ludhiana 141001, India",
      logoUrl: str(m, "general.logo"),
      logoAlt: str(m, "general.logo_alt"),
      mobileLogoUrl: str(m, "general.mobile_logo"),
      faviconUrl: str(m, "general.favicon"),
      defaultCurrency: str(m, "general.default_currency") || "INR",
      timezone: str(m, "general.timezone") || "Asia/Kolkata",
    },
  };
}

export async function getPublicAuthSettings() {
  const rows = await prisma.setting.findMany({ where: { group: "auth" } });
  const m = new Map(rows.map((r) => [r.key, r.value]));

  const dynamicSlides = parseLoginSlides(m.get("auth.login_slides"));
  const legacySlides = [1, 2]
    .map((slideNumber) => ({
      image:
        m.get(`auth.login_slide_${slideNumber}_image`) ||
        DEFAULT_LOGIN_SLIDES[slideNumber - 1]?.image ||
        "",
      heading:
        m.get(`auth.login_slide_${slideNumber}_heading`) ||
        DEFAULT_LOGIN_SLIDES[slideNumber - 1]?.heading ||
        "",
      subHeading:
        m.get(`auth.login_slide_${slideNumber}_sub_heading`) ||
        DEFAULT_LOGIN_SLIDES[slideNumber - 1]?.subHeading ||
        "",
      isVisible: true,
    }))
    .filter((slide) => slide.image || slide.heading || slide.subHeading);

  return {
    login: {
      heading: m.get("auth.login_heading") || "Customer Login",
      subHeading: m.get("auth.login_sub_heading") || "Login to access your account",
      sliderEnabled: m.get("auth.login_slider_enabled") !== "false",
      slides: (dynamicSlides.length ? dynamicSlides : legacySlides).filter((slide) => slide.isVisible),
    },
  };
}

export async function getSitemapSettings() {
  const rows = await prisma.setting.findMany({ where: { group: "seo" } });
  const m = new Map(rows.map((r) => [r.key, r.value]));
  return {
    includeProducts: m.get("seo.sitemap_include_products") !== "false",
    includeCategories: m.get("seo.sitemap_include_categories") !== "false",
    includeBlogs: m.get("seo.sitemap_include_blogs") === "true",
    includeCmsPages: m.get("seo.sitemap_include_cms_pages") !== "false",
    robotsTxt: m.get("seo.robots_txt") ?? null,
  };
}
