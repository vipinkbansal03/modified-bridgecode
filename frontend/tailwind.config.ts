import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1A1A1A",
        steel: "#6B6B6B",
        "steel-2": "#9A9A9A",
        brand: {
          DEFAULT: "#E31E24",
          deep: "#B5151B",
        },
        line: "#E6E6E6",
        offwhite: "#FAFAFA",
        grey: {
          DEFAULT: "#F2F2F2",
          2: "#E2E2E2",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "'Poppins'", "-apple-system", "sans-serif"],
        heading: ["var(--font-heading)", "'Poppins'", "-apple-system", "sans-serif"],
        poppins: ["var(--font-poppins)", "'Poppins'", "sans-serif"],
      },
      maxWidth: {
        wrap: "1480px",
      },
      borderRadius: {
        pill: "999px",
      },
      spacing: {
        "4.5": "1.125rem",
        "5.5": "1.375rem",
        "6.5": "1.625rem",
        "7.5": "1.875rem",
        "8.5": "2.125rem",
        "9.5": "2.375rem",
        "10.5": "2.625rem",
        "12.5": "3.125rem",
        "13.5": "3.375rem",
        "17.5": "4.375rem",
        "13": "3.25rem",
        "15": "3.75rem",
        "17": "4.25rem",
        "18": "4.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
