# BRIDGESTONE TECHNOLOGY - ENTERPRISE ECOMMERCE PLATFORM
## Technical Requirements Document (TRD) – Phase 1

**Version:** 1.0  
**Prepared By:** Bridgestone Technology  
**Project Type:** Enterprise B2B + B2C Ecommerce Platform  
**Delivery Model:** Milestone-Based Development  
**Target Completion Date:** 15 July 2026  

---

### 1. PROJECT OVERVIEW
The objective of this project is to build a scalable enterprise ecommerce platform capable of supporting both B2B and B2C business operations through a centralized API-first architecture.
The platform shall provide:
- Modern customer-facing ecommerce storefront
- Enterprise administration panel
- Advanced B2B commerce workflows
- Inventory management
- Content management system (CMS)
- Multi-language architecture
- Multi-currency support
- Order management system
- Notification infrastructure
- Third-party integrations
- Future mobile application readiness

---

### 2. TECHNOLOGY STACK
#### Frontend
- **Customer Platform:** Next.js, TypeScript, React Query, Formik, Yup, Tailwind CSS
- **Admin Platform:** Next.js, TypeScript, Role Based Access Control

#### Backend
- Node.js, Express, REST APIs, JWT Authentication, API First Architecture, Modular Service Architecture

#### Database
- **Primary Database:** PostgreSQL (Prisma ORM)
- **Secondary Database (Need Basis):** MongoDB

#### Infrastructure
- Linux Server, Nginx, PM2, SSL, CDN Ready Architecture, Object Storage Ready, CI/CD Ready Infrastructure

---

### 3. HIGH LEVEL MODULES
- **Customer Ecommerce Platform:** Homepage, Product Catalog, Search & Filters, Cart, Checkout, Customer Accounts
- **B2B Commerce Platform:** Wholesale Customers, MOQ Rules, Tier Pricing, Bulk Ordering, Custom Pricing
- **Administration Platform:** Products, Categories, Orders, Customers, Inventory, CMS, Localization
- **CMS Platform:** Landing Pages, Blogs, Banners, Static Pages, Promotional Content
- **Inventory System:** Stock Management, Inventory Alerts, Inventory Tracking
- **Notification System:** Email, SMS, Authentication Notifications
- **Localization Platform:** Multi-language, Multi-currency, Translation Management

---

### 4. USER ROLES
- **Guest User:** Browse Products, Search Products, View Categories, Register Account
- **Customer:** Login, Manage Profile, Manage Addresses, Place Orders, Track Orders, Wishlist, View Order History
- **Dealer:** Place Orders, Bulk Ordering, Request Quotations, Access Dealer Pricing, Country-Specific Pricing, MOQ Pricing, Tier Pricing, Order History, Saved Draft Orders
- **Doctor / Retailer:** Place Orders, Access Retailer Pricing, Access Country Pricing, Access Tier Pricing, Request Quotations, Order History
- **Admin:** Product Management, Category Management, Customer Management, Inventory Management, CMS Management, Localization Management, Order Management
- **Super Admin:** Full Platform Access, Role Management, User Management, System Configuration, Integration Controls

---

### 5. CRITICAL BUSINESS RULES & FUNCTIONAL CLARIFICATIONS

#### 1. Authentication Screens Required
Customer side: Login, Registration, Forgot Password, Reset Password, Email Verification (Optional), OTP Verification (If Enabled).

#### 2. Admin UX Standards
Implemented consistently across ALL admin modules:
- **Drag & Drop Sorting:** Categories, Products, Product Variants, Banners, CMS Sections, Blog Categories, Promotional Collections, Navigation Menus.
- **Bulk Actions:** Bulk Delete, Bulk Edit, Bulk Enable, Bulk Disable, Bulk Assign Categories, Bulk Assign Countries, Bulk Update Pricing, Bulk Update Inventory across Products, Categories, Customers, Orders, Blogs, Banners, Collections.

#### 3. Product Attribute System
Supports dynamic attribute creation:
- Attributes created globally by admin.
- **Types:** Dropdown (Size, Strength, Pack Type), X-Grid (Rows: 10/20/50 Tablets; Columns: India, USA, UAE), Y-Grid (Rows: Country; Columns: MOQ, Tier Price, Dealer Price).
- Attributes mapped to: Products, Categories, Variants, Countries.

#### 4. Product Country Management
Product, Variant, and Category level country availability:
- Enable / Disable Product for specific countries (e.g. Product A: India ✔, UAE ✔, USA ✖).
- Enable / Disable Variant for specific countries.
- Enable / Disable Category for specific countries.

#### 5. Pricing Architecture & Priority
Final Pricing Calculation Priority:
1. Variant Price
2. Country Price
3. Tier Price
4. MOQ Price
5. Promotional Discount
6. Final Checkout Price

#### 6. Tier Management
Customer classification system (Silver, Gold, Platinum, future tiers).
- Admin manually assigns tiers to customers.
- Tier mapped to Customers, Countries, Products, Categories.
- Tier discounts: Percentage (Silver 5%, Gold 10%, Platinum 15%) or Fixed Pricing per tier.

#### 7. MOQ (Minimum Order Quantity) Rules
- Product Level MOQ (e.g. Product A min order 10 units)
- Variant Level MOQ (e.g. Variant A min order 20 units)
- Global MOQ Rules (e.g. 40 units -> 10% off, 100 units -> 15% off, 500 units -> 20% off)

#### 8. Discount Management
Types supported: Tier-based, MOQ-based, Open/Promotional, Collection-based, Country-specific.

#### 9. Request For Quote (RFQ) System & Draft Orders
- **RFQ Flow:** Product -> Cart -> Request Quote -> Creates Draft Order (Status: Pending Review).
- **Admin Actions:** Edit Product Quantity, Edit Pricing, Apply Discounts, Add Notes, Modify Shipping Charges, Approve Order.
- **Quote Approval:** Draft Order -> Confirmed Order -> Customer receives notification and proceeds to payment.
- **Admin Manual Order Creation:** Support offline, WhatsApp, phone, dealer orders manually.

#### 10. Country-Based Business Rules
Products, Categories, Pricing, MOQ Rules, Tier Pricing, Discounts, Collections support country mapping.

#### 11. Core Database Schema Foundation
Tables: `users`, `roles`, `countries`, `tiers`, `products`, `product_variants`, `categories`, `product_attributes`, `attribute_options`, `pricing_rules`, `moq_rules`, `tier_pricing`, `country_pricing`, `discounts`, `collections`, `rfq_requests`, `draft_orders`, `orders`, `order_items`, `inventory`, `notifications`.
