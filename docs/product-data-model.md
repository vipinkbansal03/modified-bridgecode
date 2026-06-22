# Product Data Model

Final product architecture for Modern Orthodontics:

`Product -> ProductPackage -> Assigned Attributes -> Allowed Values -> ProductVariant`

## Product

The master catalog entity.

- Owns category, descriptive content, SEO, and top-level status.
- Represents the family, not the sellable SKU.

Examples:

- `Elfin Bondable Molar Tube`
- `NiTi Wire Product`

## ProductPackage

Commercial/package-level variants that change how the product is sold.

- Separate from attribute values.
- Used when pricing, MOQ, inventory profile, or SKU structure changes commercially.
- Examples: `5 Patient Set`, `Loose Molar Tubes`

## Assigned Attributes

Attributes are global dimensions such as:

- `Prescription`
- `Slot`
- `Hook`
- `Wire Size`
- `Size`
- `Arch`
- `Pack Size`

Products explicitly opt into the attributes they support through `ProductAttribute`.

## Allowed Values

Each assigned attribute is narrowed to a product-specific allowed value set through `ProductAttributeValueSelection`.

This solves two problems:

- Products do not inherit every global value automatically.
- Variant generation uses only valid, approved combinations for that product.

Example:

- Product assigns `Hook`
- Global `Hook` values may include `Hook 3`, `Hook 4`, `Hook 5`
- Product may allow only `Hook 3` and `Hook 4`

## ProductVariant

The sellable SKU.

- May optionally belong to a `ProductPackage`
- Stores SKU, title, MOQ, status, dimensions, weight
- Connects to concrete attribute values through `ProductVariantAttributeValue`
- Owns inventory and country-wise pricing

Variant generation logic:

- Uses assigned attributes only
- Uses allowed values only
- Expands across active packages when packages exist

## Practical Examples

### Elfin Bondable Molar Tube

- Product: `Elfin Bondable Molar Tube`
- Packages:
  - `5 Patient Set`
  - `Loose Molar Tubes`
- Assigned attributes:
  - `Prescription`
  - `Slot`
  - `Hook`
  - `Wire Size`
- Allowed values:
  - `Prescription`: `MBT`, `Roth`
  - `Slot`: `.018`, `.022`
  - `Hook`: `Hook 3`, `Hook 4`
  - `Wire Size`: `.018 x .025`, `.019 x .025`
- Variants:
  - generated per package across the selected value combinations

### NiTi Wire Product

- Product: `NiTi Wire Product`
- Packages: none
- Assigned attributes:
  - `Size`
  - `Arch`
  - `Pack Size`
- Allowed values:
  - `Size`: `.012`, `.014`, `.016`
  - `Arch`: `Upper`, `Lower`
  - `Pack Size`: `Single`, `10 Pack`
- Variants:
  - generated directly from the selected value combinations

## Backend Expectations

- Public product API returns:
  - packages
  - assigned attributes
  - allowed values only
  - package-linked variants
- Admin product flow supports:
  - assign attributes
  - choose allowed values
  - generate variants
  - manually create variants
  - clone variants
  - soft delete variants
