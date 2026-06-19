export const SITE_NAME = "Modern Orthodontics";
export const SITE_URL = "https://www.modortho.com";
export const ORDERS_EMAIL = "orders@modortho.com";
export const INFO_EMAIL = "info@modortho.com";
export const INDIA_PHONE = "1800 890 8022";
export const COMPANY_ADDRESS = "2024, Gobind Nagar, Circuit House Road, Ludhiana 141001, India";
export const USA_PHONE = "+1 470-866-2724";
export const USA_EMAIL = "sanjaygoyalmo@gmail.com";
export const USA_ADDRESS = "1303 Colony Dr, Marietta, GA 30068, USA";

export const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/orthodonticsmodern",
  twitter: "https://twitter.com/ModOrtho",
  instagram: "https://www.instagram.com/modern_ortho/",
  linkedin: "https://in.linkedin.com/company/modern-orthodontics",
};

/** Mirrors GST format used for Indian dealer registrations: 2 digits, 5 letters, 4 digits, 1 letter, 1 alphanumeric, Z, 1 alphanumeric */
export const GST_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;
export const PHONE_REGEX = /^[+]?[\d\s-]{7,15}$/;
