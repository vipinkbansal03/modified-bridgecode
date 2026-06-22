# Modern Orthodontics - Final Variant Definition & SKU Generation Architecture

## Purpose

This document defines the final rules for:

- Variant definition
- Variant generation
- Manual variant creation
- Package usage
- Attribute usage
- SKU identity

This document is the source of truth for admin product management, PDP configurator, quick order, inventory, pricing, quotes, and future ERP integrations.

---

## Core Rule

A variant is a single exact sellable SKU.

A stored variant must never represent:

- all values of an attribute
- multiple values of the same attribute
- a partially defined attribute group

A stored variant must always represent:

- one product
- zero or one package
- zero or more attributes used by that variant
- exactly one selected value for each used attribute

---

## Final Variant Shape

Each variant is defined by:

```txt
Variant
=
Package
+ 
Selected Attribute Value Links
```

Example:

```txt
Product: Elfin Bondable Molar Tube
Package: 5 Patient Set
Slot: .022
Prescription: MBT
Hook: With Hook
Wire Size: .017 x .025
```

This is one SKU.

---

## Product Structure

```txt
Product
│
├── Packages
│
├── Variants
│    ├── Package
│    ├── Selected Attribute Values
│    ├── SKU
│    ├── Price
│    ├── Inventory
│    ├── MOQ
│    └── Status
│
└── Resources
```

Important:

- Packages belong to products
- Attributes are global and reusable
- Attribute values are global and reusable
- Variants store selected attribute value links
- Attributes are not stored on the product as a required assignment layer

---

## Packages

Packages are separate commercial offerings.

Packages are not attribute values.

Each package should support:

```txt
Title
Slug
Image
Description
Sort Order
Status
```

Examples:

```txt
5 Patient Set
Loose Molar Tubes
```

Packages affect:

- SKU identity
- inventory
- pricing
- MOQ

---

## Global Attributes

Attributes are reusable catalog dimensions.

Examples:

```txt
Prescription
Slot
Hook
Wire Size
Color
Pack Size
Arch
```

Attribute fields:

```txt
Title
Slug
Sort Order
Status
```

---

## Global Attribute Values

Each attribute contains reusable values.

Attribute value fields:

```txt
Title
Slug
Image
Note
Price Adjustment
Sort Order
Status
```

Examples:

```txt
Prescription
- MBT
- Roth

Slot
- .018
- .022

Hook
- With Hook
- Without Hook

Wire Size
- .016 x .022
- .017 x .025
```

---

## Stored Variant Rules

When a variant is saved:

1. It may use only one package.
2. It may use any number of attributes relevant to that SKU.
3. It must store exactly one value per used attribute.
4. It must not store more than one value for the same attribute.
5. It must not store an "all values" rule.
6. It must not store a "specific subset" rule.

Those "all/specific/skip" choices belong only to generation-time behavior.

---

## Generation Rules

Variant generation is not the same as stored variant data.

Generation UI may allow per attribute:

1. Use All Values
2. Select Specific Values
3. Skip Attribute

Meaning:

### Use All Values

Use every active value under that attribute when generating combinations.

### Select Specific Values

Use only the selected active values under that attribute when generating combinations.

### Skip Attribute

Do not include that attribute in the generated combinations.

Important:

These are generator instructions only.

After generation, each created variant must still store one exact value per used attribute.

---

## Manual Variant Creation Rules

Manual variant creation creates one exact SKU.

Admin flow:

1. Select package if applicable
2. Select one value per used attribute
3. Enter SKU
4. Enter MOQ
5. Enter price and inventory where applicable
6. Save

Manual variant creation must not allow:

- selecting multiple values for one attribute in the same saved variant
- saving "all values" for an attribute
- saving an unresolved attribute rule

---

## Variant Key

Each variant must have a unique identity key.

Recommended logic:

```txt
variantKey
=
packageId + sorted(attributeValueIds)
```

This key is used to prevent duplicates.

Two variants are duplicates if they have:

- the same product
- the same package
- the same selected attribute values

---

## SKU Generation

SKU may be:

- manually entered by admin
- system-generated fallback

SKU should be based on:

```txt
Product Code or Product SKU
+ Package
+ Attribute Values
```

Example:

```txt
ELFIN-5PS-MBT-022-HOOK-01725
```

If admin provides a custom SKU, that custom SKU takes priority.

---

## Variant Fields

Each variant must support:

```txt
SKU
Title
Package
MOQ
Price
Inventory
Weight
Length
Width
Height
Status
```

Allowed status examples:

```txt
Active
Inactive
Out Of Stock
Discontinued
```

Implementation may map these to existing internal enums if needed, but UI meaning must remain clear.

---

## Admin Workflow

### Step 1

Create product

### Step 2

Add packages

### Step 3

Manage global attributes

### Step 4

Manage global attribute values

### Step 5

Create variants

Two methods:

#### Generate Variants

For each attribute:

- Use All Values
- Select Specific Values
- Skip Attribute

Then choose package scope and generate combinations.

#### Manual Variant

Choose:

- package
- one exact value per used attribute
- SKU
- MOQ
- status

Then save one exact variant.

### Step 6

Manage inventory and pricing at variant level.

---

## Edit Variant Rules

Admin must be able to edit:

- package
- selected attribute values
- SKU
- title
- MOQ
- status
- dimensions

When selected attribute values or package change:

- recompute variant key
- block duplicates
- keep the variant as one exact SKU

---

## Clone Variant Rules

Clone should copy:

- package
- selected attribute values
- MOQ
- dimensions
- status

Clone must produce:

- a new variant record
- a new SKU
- the same exact selected attribute values unless admin edits them after cloning

---

## Delete / Disable Rules

Variants should support:

- soft delete
- disable / inactive state

Deleted or inactive variants should not appear as active ordering options.

---

## PDP Rule

PDP must use configurator flow.

PDP must not use spreadsheet-style ordering.

Configurator behavior:

1. choose package
2. choose attribute values
3. choose quantity
4. add configuration
5. add to quote

The PDP must resolve to exact variants or exact variant-like configurations based on package plus selected values.

---

## Quick Order Rule

Spreadsheet or matrix ordering belongs only in:

```txt
/quick-order
```

Not on PDP.

---

## Non-Negotiable Rules

1. A stored variant is always one exact SKU.
2. "Use All Values" is a generation-time rule, not a stored variant state.
3. "Select Specific Values" is a generation-time rule, not a stored variant state.
4. "Skip Attribute" is a generation-time rule, not a stored variant state.
5. Stored variants keep only exact selected attribute value links.
6. Packages are separate product entities, not attribute values.
7. Pricing and inventory are variant-level, not product-level.

---

## Example Summary

Correct:

```txt
Variant A
Package: 5 Patient Set
Slot: .022
Prescription: MBT
Hook: With Hook
Wire Size: .017 x .025
```

Incorrect:

```txt
Variant A
Slot: all values
Prescription: MBT + Roth
Hook: some values
```

The incorrect example is not a real variant.
It is only a generation instruction set.
