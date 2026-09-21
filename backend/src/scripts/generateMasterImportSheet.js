const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const wb = XLSX.utils.book_new();

// ==========================================
// SHEET 1: README & INSTRUCTIONS
// ==========================================
const readmeData = [
  ["MODERN ORTHODONTICS - MASTER DATA IMPORT GUIDE & SPREADSHEET"],
  ["Version: 1.0 | Platform: Modern Orthodontics B2B eCommerce"],
  [],
  ["1. IMPORT SEQUENCE (STRICT ORDER OF DEPENDENCY)"],
  ["Data must be imported in this exact order because child records require their parent masters to exist first:"],
  ["Step 1", "Sheet: 1_Categories", "Creates the product category hierarchy (e.g., Brackets > Metal Brackets)."],
  ["Step 2", "Sheet: 2_Attributes_and_Values", "Creates global attributes (Slot, Hook, Prescription, Wire Size) and allowable values."],
  ["Step 3", "Sheet: 3_Base_Products", "Creates master base products (without variants yet) and links them to categories."],
  ["Step 4", "Sheet: 4_Product_Attribute_Mapping", "Assigns which attributes & allowable values belong to each base product."],
  ["Step 5", "Sheet: 5_Product_Variants_Matrix", "Creates sellable SKUs with pricing, stock levels, and specific attribute combinations."],
  ["Step 6", "Sheet: 6_Country_Pricing", "Sets multi-country currencies (USD, EUR, GBP, INR), MSRP, and wholesale volume tiers."],
  [],
  ["2. CRUCIAL RULES & VALIDATION STANDARDS"],
  ["Rule 1: SKUs must be unique", "Every product SKU and variant SKU must be globally unique across the catalog."],
  ["Rule 2: Category Names", "In Base Products, write the exact 'Category Name' (e.g. 'Metal Brackets'), not the slug."],
  ["Rule 3: Display Types", "Supported display types are: 'DROPDOWN' (standard select), 'X_GRID' (matrix columns), 'Y_GRID' (matrix rows)."],
  ["Rule 4: Allowed Values in Mapping", "Use comma-separated values (e.g. '.018, .022') or write 'ALL' to include all active values."],
  ["Rule 5: High Volume Batching", "For catalogs exceeding 5,000 rows, split into 1,000-2,000 row files to ensure zero timeout."],
  [],
  ["3. HOW TO USE EACH SHEET IN THIS WORKBOOK"],
  ["Tab 1_Categories", "Copy rows into your Categories import or upload this sheet directly in Admin > Categories > Import."],
  ["Tab 2_Attributes_and_Values", "Upload into Admin > Attributes > Import Excel."],
  ["Tab 3_Base_Products", "Upload into Admin > Products > Import Excel."],
  ["Tab 4_Product_Attribute_Mapping", "Upload into Admin > Products > Import Attribute Mappings."],
  ["Tab 5_Product_Variants_Matrix", "Upload into Admin > Products > [Product] > Variants > Import Excel."],
  ["Tab 6_Country_Pricing", "Upload into Admin > Products > [Product] > Variants > Import Country Prices."],
];

const wsReadme = XLSX.utils.aoa_to_sheet(readmeData);
wsReadme["!cols"] = [{ wch: 32 }, { wch: 38 }, { wch: 80 }];
XLSX.utils.book_append_sheet(wb, wsReadme, "0_README_Instructions");

// ==========================================
// SHEET 2: CATEGORIES
// ==========================================
const categoriesData = [
  {
    name: "Brackets",
    parentCategory: "",
    status: "ACTIVE",
    sortOrder: 1,
    countryCodes: "ALL",
    description: "All orthodontic bracket systems including metal, ceramic, and self-ligating.",
    seoTitle: "Orthodontic Brackets | Modern Orthodontics",
    seoDescription: "Explore precision engineered orthodontic brackets.",
  },
  {
    name: "Metal Brackets",
    parentCategory: "Brackets",
    status: "ACTIVE",
    sortOrder: 1,
    countryCodes: "ALL",
    description: "High-grade 17-4 stainless steel metal brackets.",
    seoTitle: "Metal Brackets | Modern Orthodontics",
    seoDescription: "Low profile stainless steel metal brackets with superior torque control.",
  },
  {
    name: "Ceramic Brackets",
    parentCategory: "Brackets",
    status: "ACTIVE",
    sortOrder: 2,
    countryCodes: "ALL",
    description: "Translucent polycrystalline aesthetic ceramic brackets.",
    seoTitle: "Ceramic Brackets | Modern Orthodontics",
    seoDescription: "Stain resistant aesthetic ceramic brackets.",
  },
  {
    name: "Self-Ligating Brackets",
    parentCategory: "Brackets",
    status: "ACTIVE",
    sortOrder: 3,
    countryCodes: "ALL",
    description: "Passive and active self-ligating bracket systems.",
    seoTitle: "Self-Ligating Brackets | Modern Orthodontics",
    seoDescription: "Friction-reducing self-ligating brackets for faster treatment times.",
  },
  {
    name: "Archwires",
    parentCategory: "",
    status: "ACTIVE",
    sortOrder: 2,
    countryCodes: "ALL",
    description: "Comprehensive archwire catalog including NiTi, Beta Ti, and Stainless Steel.",
    seoTitle: "Orthodontic Archwires | Modern Orthodontics",
    seoDescription: "High recovery superelastic and thermal active orthodontic archwires.",
  },
  {
    name: "NiTi Archwires",
    parentCategory: "Archwires",
    status: "ACTIVE",
    sortOrder: 1,
    countryCodes: "ALL",
    description: "Superelastic and thermal activated Nickel Titanium wires.",
    seoTitle: "NiTi Archwires | Modern Orthodontics",
    seoDescription: "Gentle continuous force NiTi archwires in natural, proform, and euro shapes.",
  },
  {
    name: "Stainless Steel Archwires",
    parentCategory: "Archwires",
    status: "ACTIVE",
    sortOrder: 2,
    countryCodes: "ALL",
    description: "Medical grade 304V tensile stainless steel archwires.",
    seoTitle: "Stainless Steel Archwires | Modern Orthodontics",
    seoDescription: "Precision drawn stainless steel wires for finishing and space closure.",
  },
  {
    name: "Buccal Tubes",
    parentCategory: "",
    status: "ACTIVE",
    sortOrder: 3,
    countryCodes: "ALL",
    description: "Weldable and bondable molar buccal tubes for 1st and 2nd molars.",
    seoTitle: "Molar Buccal Tubes | Modern Orthodontics",
    seoDescription: "Low profile buccal tubes with indented bonding pads.",
  },
  {
    name: "Elastomerics & Ligatures",
    parentCategory: "",
    status: "ACTIVE",
    sortOrder: 4,
    countryCodes: "ALL",
    description: "Latex-free power chains, ligature ties, and intraoral elastics.",
    seoTitle: "Elastomerics & Ligatures | Modern Orthodontics",
    seoDescription: "Color-stable memory elastomeric ligatures and power chains.",
  },
  {
    name: "Instruments & Pliers",
    parentCategory: "",
    status: "ACTIVE",
    sortOrder: 5,
    countryCodes: "ALL",
    description: "German tungsten carbide insert orthodontic pliers and hand instruments.",
    seoTitle: "Orthodontic Instruments & Pliers | Modern Orthodontics",
    seoDescription: "Surgical grade orthodontic pliers with lifetime durability.",
  },
];

const wsCategories = XLSX.utils.json_to_sheet(categoriesData);
wsCategories["!cols"] = [
  { wch: 24 }, // name
  { wch: 20 }, // parentCategory
  { wch: 12 }, // status
  { wch: 10 }, // sortOrder
  { wch: 14 }, // countryCodes
  { wch: 50 }, // description
  { wch: 40 }, // seoTitle
  { wch: 50 }, // seoDescription
];
XLSX.utils.book_append_sheet(wb, wsCategories, "1_Categories");

// ==========================================
// SHEET 3: ATTRIBUTES & VALUES
// ==========================================
const attributesData = [
  {
    attributeName: "Slot",
    slug: "slot",
    displayType: "X_GRID",
    status: "ACTIVE",
    sortOrder: 1,
    values: ".018, .022",
  },
  {
    attributeName: "Hook",
    slug: "hook",
    displayType: "Y_GRID",
    status: "ACTIVE",
    sortOrder: 2,
    values: "None, Hook 3, Hook 4, Hook 5, Hook 3-4-5",
  },
  {
    attributeName: "Prescription",
    slug: "prescription",
    displayType: "DROPDOWN",
    status: "ACTIVE",
    sortOrder: 3,
    values: "MBT, Roth, Alexander, Standard Edgewise, High Torque, Low Torque",
  },
  {
    attributeName: "Wire Size",
    slug: "wire-size",
    displayType: "X_GRID",
    status: "ACTIVE",
    sortOrder: 4,
    values: ".012, .014, .016, .018, .020, .016 x .016, .016 x .022, .017 x .025, .018 x .025, .019 x .025, .021 x .025",
  },
  {
    attributeName: "Arch",
    slug: "arch",
    displayType: "Y_GRID",
    status: "ACTIVE",
    sortOrder: 5,
    values: "Upper, Lower",
  },
  {
    attributeName: "Arch Form",
    slug: "arch-form",
    displayType: "DROPDOWN",
    status: "ACTIVE",
    sortOrder: 6,
    values: "Natural Form, Proform Oval, Euro Standard",
  },
  {
    attributeName: "Material",
    slug: "material",
    displayType: "DROPDOWN",
    status: "ACTIVE",
    sortOrder: 7,
    values: "Stainless Steel, Nickel Titanium, Polycrystalline Ceramic, Cobalt Chromium",
  },
  {
    attributeName: "Tube Type",
    slug: "tube-type",
    displayType: "DROPDOWN",
    status: "ACTIVE",
    sortOrder: 8,
    values: "Bondable Single, Weldable Single, Bondable Convertible, Weldable Convertible",
  },
  {
    attributeName: "Color",
    slug: "color",
    displayType: "DROPDOWN",
    status: "ACTIVE",
    sortOrder: 9,
    values: "Clear, Silver, Blue, Red, Green, Yellow, Pink, Purple, Black",
  },
];

const wsAttributes = XLSX.utils.json_to_sheet(attributesData);
wsAttributes["!cols"] = [
  { wch: 22 }, // attributeName
  { wch: 18 }, // slug
  { wch: 16 }, // displayType
  { wch: 12 }, // status
  { wch: 10 }, // sortOrder
  { wch: 85 }, // values
];
XLSX.utils.book_append_sheet(wb, wsAttributes, "2_Attributes_and_Values");

// ==========================================
// SHEET 4: BASE PRODUCTS
// ==========================================
const baseProductsData = [
  {
    title: "Metal Bracket MBT .022",
    sku: "PRD-MB-001",
    productCode: "BRK-MBT-22",
    categoryName: "Metal Brackets",
    brand: "Modern Orthodontics",
    status: "ACTIVE",
    sortOrder: 1,
    hasVariants: "TRUE",
    isFeatured: "TRUE",
    shortDescription: "Precision CNC milled stainless steel bracket with MBT prescription.",
    description: "Manufactured from medical grade 17-4 stainless steel with 80-gauge mesh bonding pad.",
    countryCodes: "ALL",
  },
  {
    title: "Metal Bracket Roth .018",
    sku: "PRD-MB-002",
    productCode: "BRK-ROTH-18",
    categoryName: "Metal Brackets",
    brand: "Modern Orthodontics",
    status: "ACTIVE",
    sortOrder: 2,
    hasVariants: "TRUE",
    isFeatured: "FALSE",
    shortDescription: "Classic Roth prescription bracket in .018 slot size.",
    description: "Engineered with anatomical contoured base for precise placement and bond strength.",
    countryCodes: "ALL",
  },
  {
    title: "Ceramic Aesthetic Bracket MBT",
    sku: "PRD-CB-001",
    productCode: "BRK-CER-MBT",
    categoryName: "Ceramic Brackets",
    brand: "Modern Orthodontics",
    status: "ACTIVE",
    sortOrder: 3,
    hasVariants: "TRUE",
    isFeatured: "TRUE",
    shortDescription: "Ultra-translucent aesthetic polycrystalline bracket.",
    description: "Combines supreme aesthetics with mechanical strength and smooth rounded tie wings.",
    countryCodes: "ALL",
  },
  {
    title: "Thermal Active NiTi Archwire",
    sku: "PRD-NW-001",
    productCode: "WIR-NT-THM",
    categoryName: "NiTi Archwires",
    brand: "Modern Orthodontics",
    status: "ACTIVE",
    sortOrder: 4,
    hasVariants: "TRUE",
    isFeatured: "TRUE",
    shortDescription: "Body heat activated thermal NiTi wire providing gentle leveling force.",
    description: "Pliable at room temperature for easy bracket engagement, activates at 35 degrees C.",
    countryCodes: "ALL",
  },
  {
    title: "Stainless Steel Finishing Archwire",
    sku: "PRD-SW-001",
    productCode: "WIR-SS-FIN",
    categoryName: "Stainless Steel Archwires",
    brand: "Modern Orthodontics",
    status: "ACTIVE",
    sortOrder: 5,
    hasVariants: "TRUE",
    isFeatured: "FALSE",
    shortDescription: "High tensile stainless steel archwire for space closure and torque expression.",
    description: "Smooth diamond drawn surface minimizing friction during sliding mechanics.",
    countryCodes: "ALL",
  },
  {
    title: "First Molar Buccal Tube Bondable",
    sku: "PRD-BT-001",
    productCode: "TUB-M1-BND",
    categoryName: "Buccal Tubes",
    brand: "Modern Orthodontics",
    status: "ACTIVE",
    sortOrder: 6,
    hasVariants: "TRUE",
    isFeatured: "FALSE",
    shortDescription: "Direct bond buccal tube with funnel entrance and color marking.",
    description: "Compound contoured base matching buccal molar anatomy with laser etched retention pads.",
    countryCodes: "ALL",
  },
  {
    title: "Distal End Cutter Safety Hold",
    sku: "PRD-PL-001",
    productCode: "INS-DIST-01",
    categoryName: "Instruments & Pliers",
    brand: "Modern Orthodontics",
    status: "ACTIVE",
    sortOrder: 7,
    hasVariants: "FALSE",
    isFeatured: "TRUE",
    shortDescription: "Tungsten carbide safety hold distal cutter flush cuts and holds wire end.",
    description: "Cuts round and rectangular wires up to .021 x .025. Handcrafted surgical stainless steel.",
    countryCodes: "ALL",
  },
];

const wsBaseProducts = XLSX.utils.json_to_sheet(baseProductsData);
wsBaseProducts["!cols"] = [
  { wch: 35 }, // title
  { wch: 16 }, // sku
  { wch: 16 }, // productCode
  { wch: 24 }, // categoryName
  { wch: 22 }, // brand
  { wch: 12 }, // status
  { wch: 10 }, // sortOrder
  { wch: 14 }, // hasVariants
  { wch: 12 }, // isFeatured
  { wch: 50 }, // shortDescription
  { wch: 60 }, // description
  { wch: 14 }, // countryCodes
];
XLSX.utils.book_append_sheet(wb, wsBaseProducts, "3_Base_Products");

// ==========================================
// SHEET 5: PRODUCT ATTRIBUTE MAPPING
// ==========================================
const attributeMappingData = [
  {
    productSku: "PRD-MB-001",
    productTitle: "Metal Bracket MBT .022",
    attributeName: "Slot",
    displayType: "X_GRID",
    required: "TRUE",
    allowedValues: ".022",
  },
  {
    productSku: "PRD-MB-001",
    productTitle: "Metal Bracket MBT .022",
    attributeName: "Hook",
    displayType: "Y_GRID",
    required: "TRUE",
    allowedValues: "None, Hook 3, Hook 4, Hook 5",
  },
  {
    productSku: "PRD-MB-001",
    productTitle: "Metal Bracket MBT .022",
    attributeName: "Prescription",
    displayType: "DROPDOWN",
    required: "TRUE",
    allowedValues: "MBT",
  },
  {
    productSku: "PRD-MB-002",
    productTitle: "Metal Bracket Roth .018",
    attributeName: "Slot",
    displayType: "X_GRID",
    required: "TRUE",
    allowedValues: ".018",
  },
  {
    productSku: "PRD-MB-002",
    productTitle: "Metal Bracket Roth .018",
    attributeName: "Hook",
    displayType: "Y_GRID",
    required: "TRUE",
    allowedValues: "None, Hook 3, Hook 4, Hook 5",
  },
  {
    productSku: "PRD-MB-002",
    productTitle: "Metal Bracket Roth .018",
    attributeName: "Prescription",
    displayType: "DROPDOWN",
    required: "TRUE",
    allowedValues: "Roth",
  },
  {
    productSku: "PRD-NW-001",
    productTitle: "Thermal Active NiTi Archwire",
    attributeName: "Wire Size",
    displayType: "X_GRID",
    required: "TRUE",
    allowedValues: ".012, .014, .016, .018, .016 x .022, .017 x .025, .019 x .025",
  },
  {
    productSku: "PRD-NW-001",
    productTitle: "Thermal Active NiTi Archwire",
    attributeName: "Arch",
    displayType: "Y_GRID",
    required: "TRUE",
    allowedValues: "Upper, Lower",
  },
  {
    productSku: "PRD-NW-001",
    productTitle: "Thermal Active NiTi Archwire",
    attributeName: "Arch Form",
    displayType: "DROPDOWN",
    required: "TRUE",
    allowedValues: "Natural Form, Proform Oval",
  },
  {
    productSku: "PRD-CB-001",
    productTitle: "Ceramic Aesthetic Bracket MBT",
    attributeName: "Slot",
    displayType: "X_GRID",
    required: "TRUE",
    allowedValues: ".018, .022",
  },
  {
    productSku: "PRD-CB-001",
    productTitle: "Ceramic Aesthetic Bracket MBT",
    attributeName: "Hook",
    displayType: "Y_GRID",
    required: "TRUE",
    allowedValues: "None, Hook 3, Hook 4, Hook 5",
  },
  {
    productSku: "PRD-CB-001",
    productTitle: "Ceramic Aesthetic Bracket MBT",
    attributeName: "Prescription",
    displayType: "DROPDOWN",
    required: "TRUE",
    allowedValues: "MBT",
  },
  {
    productSku: "PRD-BT-001",
    productTitle: "First Molar Buccal Tube Bondable",
    attributeName: "Slot",
    displayType: "X_GRID",
    required: "TRUE",
    allowedValues: ".018, .022",
  },
  {
    productSku: "PRD-BT-001",
    productTitle: "First Molar Buccal Tube Bondable",
    attributeName: "Prescription",
    displayType: "DROPDOWN",
    required: "TRUE",
    allowedValues: "MBT, Roth",
  },
  {
    productSku: "PRD-BT-001",
    productTitle: "First Molar Buccal Tube Bondable",
    attributeName: "Tube Type",
    displayType: "DROPDOWN",
    required: "TRUE",
    allowedValues: "Bondable Single, Bondable Convertible",
  },
];

const wsAttrMapping = XLSX.utils.json_to_sheet(attributeMappingData);
wsAttrMapping["!cols"] = [
  { wch: 18 }, // productSku
  { wch: 35 }, // productTitle
  { wch: 22 }, // attributeName
  { wch: 16 }, // displayType
  { wch: 12 }, // required
  { wch: 55 }, // allowedValues
];
XLSX.utils.book_append_sheet(wb, wsAttrMapping, "4_Product_Attribute_Mapping");

// ==========================================
// SHEET 6: PRODUCT VARIANTS MATRIX
// ==========================================
const variantsData = [
  {
    Product: "Metal Bracket MBT .022",
    SKU: "MB-22-N-MBT",
    Stock: 1200,
    "Low Stock": 100,
    Price: 24.50,
    MRP: 32.00,
    Status: "ACTIVE",
    Slot: ".022",
    Hook: "None",
    Prescription: "MBT",
    "Wire Size": "",
    Arch: "",
  },
  {
    Product: "Metal Bracket MBT .022",
    SKU: "MB-22-H3-MBT",
    Stock: 1000,
    "Low Stock": 100,
    Price: 26.00,
    MRP: 34.00,
    Status: "ACTIVE",
    Slot: ".022",
    Hook: "Hook 3",
    Prescription: "MBT",
    "Wire Size": "",
    Arch: "",
  },
  {
    Product: "Metal Bracket MBT .022",
    SKU: "MB-22-H4-MBT",
    Stock: 950,
    "Low Stock": 100,
    Price: 26.00,
    MRP: 34.00,
    Status: "ACTIVE",
    Slot: ".022",
    Hook: "Hook 4",
    Prescription: "MBT",
    "Wire Size": "",
    Arch: "",
  },
  {
    Product: "Metal Bracket MBT .022",
    SKU: "MB-22-H5-MBT",
    Stock: 800,
    "Low Stock": 100,
    Price: 27.50,
    MRP: 36.00,
    Status: "ACTIVE",
    Slot: ".022",
    Hook: "Hook 5",
    Prescription: "MBT",
    "Wire Size": "",
    Arch: "",
  },
  {
    Product: "Thermal Active NiTi Archwire",
    SKU: "NW-THM-12U",
    Stock: 2500,
    "Low Stock": 200,
    Price: 4.20,
    MRP: 6.00,
    Status: "ACTIVE",
    Slot: "",
    Hook: "",
    Prescription: "",
    "Wire Size": ".012",
    Arch: "Upper",
  },
  {
    Product: "Thermal Active NiTi Archwire",
    SKU: "NW-THM-12L",
    Stock: 2400,
    "Low Stock": 200,
    Price: 4.20,
    MRP: 6.00,
    Status: "ACTIVE",
    Slot: "",
    Hook: "",
    Prescription: "",
    "Wire Size": ".012",
    Arch: "Lower",
  },
  {
    Product: "Thermal Active NiTi Archwire",
    SKU: "NW-THM-16U",
    Stock: 3000,
    "Low Stock": 250,
    Price: 4.50,
    MRP: 6.50,
    Status: "ACTIVE",
    Slot: "",
    Hook: "",
    Prescription: "",
    "Wire Size": ".016",
    Arch: "Upper",
  },
  {
    Product: "Thermal Active NiTi Archwire",
    SKU: "NW-THM-16L",
    Stock: 2900,
    "Low Stock": 250,
    Price: 4.50,
    MRP: 6.50,
    Status: "ACTIVE",
    Slot: "",
    Hook: "",
    Prescription: "",
    "Wire Size": ".016",
    Arch: "Lower",
  },
  {
    Product: "Thermal Active NiTi Archwire",
    SKU: "NW-THM-1925U",
    Stock: 1800,
    "Low Stock": 150,
    Price: 5.50,
    MRP: 7.50,
    Status: "ACTIVE",
    Slot: "",
    Hook: "",
    Prescription: "",
    "Wire Size": ".019 x .025",
    Arch: "Upper",
  },
  {
    Product: "Thermal Active NiTi Archwire",
    SKU: "NW-THM-1925L",
    Stock: 1750,
    "Low Stock": 150,
    Price: 5.50,
    MRP: 7.50,
    Status: "ACTIVE",
    Slot: "",
    Hook: "",
    Prescription: "",
    "Wire Size": ".019 x .025",
    Arch: "Lower",
  },
];

const wsVariants = XLSX.utils.json_to_sheet(variantsData);
wsVariants["!cols"] = [
  { wch: 32 }, // Product
  { wch: 18 }, // SKU
  { wch: 10 }, // Stock
  { wch: 12 }, // Low Stock
  { wch: 12 }, // Price
  { wch: 12 }, // MRP
  { wch: 12 }, // Status
  { wch: 12 }, // Slot
  { wch: 14 }, // Hook
  { wch: 16 }, // Prescription
  { wch: 16 }, // Wire Size
  { wch: 12 }, // Arch
];
XLSX.utils.book_append_sheet(wb, wsVariants, "5_Product_Variants_Matrix");

// ==========================================
// SHEET 7: MULTI-COUNTRY PRICING & VOLUME TIERS
// ==========================================
const countryPricingData = [
  {
    productSku: "PRD-MB-001",
    variantSku: "MB-22-N-MBT",
    countryCode: "US",
    countryName: "United States",
    currency: "USD",
    basePrice: 24.50,
    mrp: 32.00,
    tier1Qty: "1 - 10 sets",
    tier1Price: 24.50,
    tier2Qty: "11 - 50 sets",
    tier2Price: 21.50,
    tier3Qty: "51+ sets",
    tier3Price: 18.00,
  },
  {
    productSku: "PRD-MB-001",
    variantSku: "MB-22-N-MBT",
    countryCode: "IN",
    countryName: "India",
    currency: "INR",
    basePrice: 1850.00,
    mrp: 2400.00,
    tier1Qty: "1 - 10 sets",
    tier1Price: 1850.00,
    tier2Qty: "11 - 50 sets",
    tier2Price: 1650.00,
    tier3Qty: "51+ sets",
    tier3Price: 1400.00,
  },
  {
    productSku: "PRD-MB-001",
    variantSku: "MB-22-N-MBT",
    countryCode: "EU",
    countryName: "European Union",
    currency: "EUR",
    basePrice: 22.50,
    mrp: 29.00,
    tier1Qty: "1 - 10 sets",
    tier1Price: 22.50,
    tier2Qty: "11 - 50 sets",
    tier2Price: 19.80,
    tier3Qty: "51+ sets",
    tier3Price: 16.50,
  },
  {
    productSku: "PRD-MB-001",
    variantSku: "MB-22-N-MBT",
    countryCode: "GB",
    countryName: "United Kingdom",
    currency: "GBP",
    basePrice: 19.50,
    mrp: 26.00,
    tier1Qty: "1 - 10 sets",
    tier1Price: 19.50,
    tier2Qty: "11 - 50 sets",
    tier2Price: 17.20,
    tier3Qty: "51+ sets",
    tier3Price: 14.50,
  },
  {
    productSku: "PRD-NW-001",
    variantSku: "NW-THM-16U",
    countryCode: "US",
    countryName: "United States",
    currency: "USD",
    basePrice: 4.50,
    mrp: 6.50,
    tier1Qty: "1 - 50 packs",
    tier1Price: 4.50,
    tier2Qty: "51 - 200 packs",
    tier2Price: 3.80,
    tier3Qty: "201+ packs",
    tier3Price: 3.20,
  },
  {
    productSku: "PRD-NW-001",
    variantSku: "NW-THM-16U",
    countryCode: "IN",
    countryName: "India",
    currency: "INR",
    basePrice: 350.00,
    mrp: 500.00,
    tier1Qty: "1 - 50 packs",
    tier1Price: 350.00,
    tier2Qty: "51 - 200 packs",
    tier2Price: 295.00,
    tier3Qty: "201+ packs",
    tier3Price: 250.00,
  },
];

const wsCountryPricing = XLSX.utils.json_to_sheet(countryPricingData);
wsCountryPricing["!cols"] = [
  { wch: 18 }, // productSku
  { wch: 18 }, // variantSku
  { wch: 14 }, // countryCode
  { wch: 18 }, // countryName
  { wch: 12 }, // currency
  { wch: 12 }, // basePrice
  { wch: 12 }, // mrp
  { wch: 16 }, // tier1Qty
  { wch: 12 }, // tier1Price
  { wch: 16 }, // tier2Qty
  { wch: 12 }, // tier2Price
  { wch: 16 }, // tier3Qty
  { wch: 12 }, // tier3Price
];
XLSX.utils.book_append_sheet(wb, wsCountryPricing, "6_Country_Pricing");

// ==========================================
// WRITE FILE TO DISK
// ==========================================
const rootDir = path.resolve(__dirname, "../../..");
const publicDir = path.join(rootDir, "frontend/public");
const brainDir = "C:\\Users\\navee\\.gemini\\antigravity\\brain\\21ef41b7-351e-40ce-8570-bc07d036c3f9";

const filename = "Modern_Orthodontics_Bulk_Import_Master_Guide.xlsx";

const pathsToSave = [
  path.join(rootDir, filename),
  path.join(publicDir, filename),
  path.join(brainDir, filename),
];

for (const targetPath of pathsToSave) {
  try {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    XLSX.writeFile(wb, targetPath);
    console.log("Successfully saved:", targetPath);
  } catch (err) {
    console.warn("Could not save to:", targetPath, err.message);
  }
}
console.log("Master Import Guide Excel generation completed!");
