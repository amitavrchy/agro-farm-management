# Agro / Farm Management Platform — Project Spec

> Stack: **Next.js (App Router, PWA / offline field app) + NestJS + Prisma + PostgreSQL/PostGIS + Redis/BullMQ + Socket.IO**  
> Bangladesh-focused farm operating system for **all farm types and production systems**, plus a **vendor marketplace** (vets, input suppliers, equipment rental, labor contractors, buyers/aggregators, transport). Bilingual **Bangla / English**. Payments: **bKash, Nagad, SSLCommerz, COD**.

This document is the source of truth for AI coding agents. Implement domain rules here before inventing new ones. Money is integer **paisa (BDT)**. Quantities use Prisma `Decimal`. Timestamps are UTC; display and agronomic "local dates" use `Asia/Dhaka` or the farm's `timezone`.

---

## 1. Overview & Goals

### Product
A multi-tenant platform where a farmer, family, commercial estate, or cooperative can:

- Register one or many farms (plots, ponds, sheds, barns) with GIS mapping.
- Plan and execute **crop, horticulture, livestock, poultry, dairy, and aquaculture** cycles.
- Track animals individually (tags), health, breeding, vaccination, and milk/egg/meat output.
- Formulate feed, manage inventory (seed, fertilizer, pesticide, feed, medicine, fuel).
- Ingest **IoT sensor** and **weather** data; forecast yield; run **cost accounting / P&L** per crop, animal, batch, pond, or farm.
- Record labor, equipment, harvest, sales, loans/subsidies, and **traceability** (lot → plot/animal → buyer).
- For cooperatives: member shares, input pooling, and profit distribution.
- Discover and transact with verified **vendors** (book a vet or teleconsult, order feed/seed, rent a tractor, hire a labor contractor, sell to an aggregator, book transport).

### Farm typologies (all first-class)
| Type | Notes |
|------|--------|
| `INDIVIDUAL_SMALL` | Family/homestead; simplified UI, offline-first |
| `INDIVIDUAL_COMMERCIAL` | Large single-owner; multi-block, hired labor, equipment fleet |
| `GROUP_COOPERATIVE` | Samity/co-op; members, shares, pooled sales, dividend |
| `CONTRACT_FARMING` | Buyer/processor contracts acreage or output; delivery schedules, quality specs |
| `MULTI_FARM_ORG` | Company or NGO operating many farms/sites with org-level RBAC and rollup P&L |

A single `Organization` may mix typologies (e.g. a co-op that also runs a commercial hatchery). Production systems on a farm are additive: the same farm may have paddy plots, a dairy shed, and ponds.

### Engineering goals
- **PostGIS** plot/pond/shed polygons; radius/bbox search for vendors and nearby weather cells.
- Strong **row-level tenancy** (`orgId` / `farmId`) in every query.
- **Offline field app** (PWA + IndexedDB) with idempotent sync (`clientEventId`).
- Marketplace **payment adapters** (bKash, Nagad, SSLCommerz, COD) + commission ledger.
- IoT ingest with device auth, downsampling, and alert rules.
- Yield models that degrade gracefully when sensors are missing (weather + historical + manual stand counts).
- Audit trail for inventory, treatments (pesticide / veterinary drugs), and financial postings.

### Non-goals (v1)
- Full livestock genomic evaluation software (store EBV/score stubs only).
- Drone photogrammetry processing pipeline (accept uploaded GeoTIFF/orthomosaic as a layer).
- Being a licensed MFI or bank; loans/subsidies are tracked, not originated as a lender of record.

---

## 2. User Roles & Permissions (RBAC)

### Organization / farm roles
| Role | Scope | Key permissions |
|------|-------|-----------------|
| `PLATFORM_ADMIN` | Platform | Orgs, vendor KYC, commissions, feature flags |
| `ORG_ADMIN` | Organization | Farms, typologies, members, billing, P&L rollup |
| `FARM_MANAGER` | Farm | Plots, cycles, inventory, labor, sales, equipment, IoT |
| `AGRONOMIST` / `LIVESTOCK_OFFICER` | Assigned farms | Crop plans, prescriptions, herd health protocols |
| `ACCOUNTANT` | Org/farm | Journals, invoices, loans, subsidies, payouts |
| `FIELD_WORKER` / `OPERATOR` | Assigned plots/sheds | Offline data entry (activity, attendance, harvest counts) |
| `COOP_MEMBER` | Own membership | Share ledger, deliveries, dividend statements |
| `CONTRACT_BUYER` | Linked contracts | View contracted lots, quality, delivery, invoices |
| `VENDOR_OWNER` | Vendor shop | Catalog, calendar, orders, payouts, staff |
| `VENDOR_STAFF` | Vendor | Fulfillment, booking calendar |
| `VET` | Vendor of type VET | Medical records they authored; teleconsult |
| `BUYER_AGGREGATOR` | Marketplace buyer | Post bids, purchase lots, logistics |
| `AUDITOR` | Org (read) | Immutable logs, traceability exports |

`UserOrgRole` and `UserFarmRole` allow different roles per farm. Field workers cannot see cost or sale prices unless flagged. Vendor users never see another vendor's orders.

### Permission model
- NestJS guards: `@Roles()`, `@OrgScope()`, `@FarmScope()`, `@VendorScope()`.
- Prisma middleware / extension injects `orgId` filters when role ≠ `PLATFORM_ADMIN`.
- Soft-delete users; never hard-delete production or financial records.

---

## 3. Feature Modules

1. **Identity & tenancy** — orgs, farms, typologies, invitations, locale (bn/en).
2. **GIS land unit registry** — plots, blocks, ponds, sheds, barns, greenhouses; GeoJSON polygons; soil type; irrigation source.
3. **Crop & horticulture cycles** — variety, sowing/transplant, stages, irrigation, fertilizer/pesticide applications (PHI/REI rules), scouting, harvest lots.
4. **Livestock / dairy / poultry** — individual tags, groups/flocks/herds, breeding, calving/kidding, milk/egg collection, mortality, movement.
5. **Health & vaccination** — protocols, scheduled doses, treatments, withdrawal periods, vet linkage.
6. **Fisheries / aquaculture** — ponds, stocking density, DO/pH logs, feeding, harvest, disease.
7. **Feed formulation & inventory** — recipes, least-cost stub, ingredient stock, batch mixing, FEFO for medicated feed and agrochemicals.
8. **IoT & weather** — device registry, timeseries, farm-level forecast (open weather adapter), thresholds, alerts.
9. **Yield forecasting** — model adapter + manual overrides; compare forecast vs actual.
10. **Labor & equipment** — attendance, piece-rate/daily wages, machinery logs, maintenance, rental usage vs own fleet.
11. **Cost accounting & P&L** — cost centers, activity-based allocation, per cycle/animal/batch/pond P&L, org rollup.
12. **Harvest, sales, traceability** — lots, QR/barcode, buyer invoices, recall by lot.
13. **Contract farming** — contracts, delivery schedules, quality specs, deductions, advances.
14. **Cooperative shares & distribution** — member capital, patronage, profit pool allocation rules.
15. **Loans & subsidies** — facilities, disbursements, repayments, subsidy claims.
16. **Offline field app** — sync protocol, photo capture, GPS stamp.
17. **Vendor marketplace** — onboarding/KYC, catalog, booking, orders, ratings, payments, commission, disputes.
18. **Notifications** — in-app, SMS, optional push; Bangla templates.
19. **Reports & exports** — season book, herd register, spray diary (compliance), fish farm log, P&L PDF.

---

## 4. Advanced Business Logic

### 4.1 Multi-farm tenancy and typology feature flags
```
effectiveModules(farm) =
  union(defaultModules(farm.typology), farm.enabledModules, org.enabledModules)
  minus farm.disabledModules
```
Small-farm UX hides cost-center coding and shows a "simple cashbook" that still posts the same ledger. Commercial/org views show cost codes and approval workflows. Contract farming requires at least one `OfftakeContract` before tagging a cycle as `CONTRACTED`.

### 4.2 GIS & land units
- Store `geography(Polygon,4326)` and computed `areaHectares` (do not trust client area blindly; recompute server-side).
- Overlap rule: two ACTIVE plots in the same farm must not overlap unless `allowOverlap` (e.g. intercrop rows documented as child units).
- Nearby vendor search: `ST_DWithin(vendor.location, farm.centroid, radius_m)`.

### 4.3 Crop cycle planning
```
Cycle plan: variety + season window + stage SOP (days after sowing)
Irrigation / fertigation events generated from SOP, shifted by weather (skip irrigate if rainfall_mm >= threshold)
Pesticide application blocked if:
  - product not approved for crop
  - stock insufficient (FEFO allocate)
  - pre-harvest interval would not elapse before plannedHarvestDate
  - applicator not certified when product.restricted=true
```
Intercrop / relay: child cycles reference `parentCycleId` and a land-unit fraction.

### 4.4 Livestock individual tracking
- Unique `visualTag` / `eid` per org; movements between farms create `AnimalMovement` and update location.
- Production events: milk kg, eggs, weight. Dairy: 2–3 sessions/day; reject duplicate `animalId+session+date` unless amendment.
- Breeding: heat → service/AI → pregnancy check → birth; auto-create calves with dam/sire links.
- Culling / death posts closing inventory and remaining book value to P&L.

### 4.5 Vaccination & withdrawal
```
On treatment or vaccination:
  compute withdrawalEndsAt = treatedAt + product.withdrawalHours
  block sale/slaughter/milk-for-sale of that animal/lot until now >= withdrawalEndsAt
  (override only ORG_ADMIN with reason — audited)
```
Schedules generated from protocols (species, age, days since last dose). Overdue job notifies manager + assigned vet if marketplace subscription exists.

### 4.6 Feed formulation
- Recipe: ingredients with % or kg/ton, target protein/energy (stored; optimizer may be a stub that validates sums = 100%).
- Mixing batch: reserve/consume inventory FEFO; cost = weighted ingredients; attach to herd/flock/pond feeding events.
- Medicated feed: inherit withdrawal rules.

### 4.7 Inventory (FEFO + locks)
Outbound inventory (seed, fertilizer, pesticide, feed, vet drugs, fuel) uses the same FEFO allocator as pharmacy/POS projects:

```
BEGIN;
  lock batches FOR UPDATE;
  sort by expiry ASC NULLS LAST, receivedAt ASC;
  allocate; reject expired agrochemicals/drugs;
COMMIT;
```

### 4.8 IoT ingest
- Devices have `deviceKey` hashed at rest; ingest endpoint rate-limited per device.
- Raw readings → Redis stream / table `SensorReading`; downsample job (1m → 15m → daily) for charts.
- Alert rule: `metric, op, threshold, forMinutes` → create `Alert`, SMS if severity HIGH (dedupe window).

### 4.9 Weather integration
`WeatherProvider` adapter (Open-Meteo / OpenWeather). Nightly pull forecast + observed for farm centroids. Crop irrigation advisor and disease risk indices (e.g. leaf wetness proxy) consume this data.

### 4.10 Yield forecasting
```
forecast = f(area, variety.potential, NDVI_or_manual_stand, weatherStress, inputCompliance, historicalFarmYield)
store ForecastRun with modelVersion and inputs JSON (reproducible)
error band optional; compare to HarvestLot actuals (MAPE report)
```
If satellite/NDVI absent, use manual scouting scores. Never block harvest if forecast missing.

### 4.11 Cost accounting & P&L
Every material issue, wage posting, equipment hour, vendor service, and shrinkage posts `CostLedgerEntry` with `costCenter` (`CYCLE`, `ANIMAL`, `BATCH`, `POND`, `FARM`, `ORG`).

```
grossMargin = sales - COGS(allocated)
net = grossMargin - allocated overhead (area- or days-weighted)
P&L(entity) = sum(ledger where entityId=...)
```
Do not recompute silently; derive reports from ledger + documented allocation jobs.

### 4.12 Cooperative profit distribution
```
distributable = approvedNetProfit - reserves
memberShare = distributable * (
  w1 * capitalSharePct +
  w2 * patronageVolumePct +
  w3 * equalMemberPct
)  // weights on CoopPolicy, sum=1
```
Post `DividendAccrual`; payout via cash/bKash/bank; idempotent `payoutId`.

### 4.13 Contract farming
- Contract: crop/species, volume or area, price formula (fixed, grade band, market-linked stub), quality params, advance.
- Deliveries allocate to remaining obligation; quality deductions reduce payable.
- Advance recovered FIFO from deliveries.

### 4.14 Vendor marketplace
Vendor types: `VET`, `FEED_SELLER`, `SEED_SUPPLIER`, `FERTILIZER_SUPPLIER`, `PESTICIDE_SUPPLIER`, `EQUIPMENT_RENTAL`, `LABOR_CONTRACTOR`, `BUYER_AGGREGATOR`, `TRANSPORT`, `OTHER`.

**Onboarding:** `APPLIED → KYC_PENDING → ACTIVE | REJECTED | SUSPENDED`. Restricted pesticides and vet drugs require extra license documents.

**Service booking (vet / teleconsult / equipment / labor):**
```
Hold slot (TTL) + advisory lock on (vendorServiceId, startAt)
Confirm after advance payment or org credit terms
Teleconsult: TeleSession adapter (LiveKit stub)
Equipment rental: prevent overlap with exclusion/lock; deposit hold/release
```

**Product orders:** cart → stock reservation at vendor → payment → fulfillment → delivery. Platform commission `bps` snapshot on the order.

**Payments:** `PaymentProvider` interface (`BKASH`, `NAGAD`, `SSLCOMMERZ`, `COD`). Webhook idempotency on `provider+eventId`. COD captured on delivery confirm.

**Ratings:** one review per completed booking/order; vendor reputation = Bayesian average (prior) to reduce early-score noise.

### 4.15 Offline sync
- Field events carry `clientEventId` (UUID) unique per device.
- Server upserts; photos queued separately.
- Conflicts: inventory insufficient at sync → `PENDING_REVIEW`, do not drop.
- Clock: server `receivedAt` authoritative; client timestamp stored for audit.
- Locale: forms support bn/en; stored enum values remain English codes.

### 4.16 Edge cases
- Plot split/merge mid-cycle: remaining area reallocates; historical lots keep original geometry snapshot.
- Animal tag reuse after death: only after `tagRetirementDays`.
- Group housing: treatments can apply to `AnimalGroup` and explode to members present that day.
- Pond partial harvest: remaining biomass estimate updated; reject if harvest > estimated stock without manager override.
- Multi-farm org user switching context must not leak the previous farm's data (integration test).
- Vendor cancelled after payment: refund policy + rebooking suggestions.
- Bangla SMS UCS-2 segment limits; template max length.
- Drought / flood disaster flag: optional insurance claim export (stub).

---

## 5. State Machines

**Organization / Farm:** `DRAFT → ACTIVE | SUSPENDED | CLOSED`  
**LandUnit:** `ACTIVE → FALLOW | RETIRED | MERGED`  
**CropCycle:** `PLANNED → SOWN → VEGETATIVE → REPRODUCTIVE → HARVESTING → CLOSED | ABANDONED`  
**Animal:** `ACTIVE → SOLD | DEAD | TRANSFERRED | CULLED`  
**HealthEvent / VaccinationDose:** `SCHEDULED → GIVEN | MISSED | CANCELLED`  
**WorkOrder (labor/equipment):** `DRAFT → SCHEDULED → IN_PROGRESS → DONE | CANCELLED`  
**InventoryBatch:** `ACTIVE → QUARANTINED → EXPIRED_WASTED | RECALLED`  
**HarvestLot:** `OPEN → GRADED → LISTED → SOLD | RECALLED | CLOSED`  
**OfftakeContract:** `DRAFT → ACTIVE → COMPLETED | DEFAULTED | CANCELLED`  
**LoanFacility:** `APPLIED → APPROVED → DISBURSED → REPAYING → CLOSED | WRITTEN_OFF`  
**SubsidyClaim:** `DRAFT → SUBMITTED → APPROVED | REJECTED → PAID`  
**Vendor:** `APPLIED → KYC_PENDING → ACTIVE | REJECTED | SUSPENDED`  
**Booking:** `HELD → AWAITING_PAYMENT → CONFIRMED → IN_PROGRESS → COMPLETED | CANCELLED | EXPIRED`  
**MarketplaceOrder:** `PENDING_PAYMENT → PAID → FULFILLING → SHIPPED → DELIVERED | CANCELLED | RETURNED`  
**Payment:** `CREATED → REQUIRES_ACTION → SUCCEEDED | FAILED | CANCELLED` → refunds  
**TeleconsultSession:** `SCHEDULED → WAITING → LIVE → ENDED | CANCELLED`  
**CoopDividendRun:** `DRAFT → APPROVED → PAYING → PAID`  
**SyncEvent:** `PENDING → APPLIED | PENDING_REVIEW | REJECTED`

Illegal transitions return `409` from a single `transition()` service per aggregate.

---

## 6. Prisma Schema Draft

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum FarmTypology {
  INDIVIDUAL_SMALL
  INDIVIDUAL_COMMERCIAL
  GROUP_COOPERATIVE
  CONTRACT_FARMING
  MULTI_FARM_ORG
}

enum ProductionSystem { CROP HORTICULTURE LIVESTOCK DAIRY POULTRY AQUACULTURE MIXED }
enum VendorType { VET FEED_SELLER SEED_SUPPLIER FERTILIZER_SUPPLIER PESTICIDE_SUPPLIER EQUIPMENT_RENTAL LABOR_CONTRACTOR BUYER_AGGREGATOR TRANSPORT OTHER }

model User {
  id           String   @id @default(cuid())
  email        String?  @unique
  phone        String?  @unique
  passwordHash String?
  fullName     String
  fullNameBn   String?
  locale       String   @default("bn")
  createdAt    DateTime @default(now())
}

model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  typology  FarmTypology @default(INDIVIDUAL_SMALL)
  status    String   @default("ACTIVE")
  timezone  String   @default("Asia/Dhaka")
  locale    String   @default("bn")
}

model UserOrgRole {
  id     String @id @default(cuid())
  userId String
  orgId  String
  role   String
  @@unique([userId, orgId, role])
}

model Farm {
  id          String   @id @default(cuid())
  orgId       String
  name        String
  code        String
  typology    FarmTypology
  systems     ProductionSystem[]
  lat         Float?
  lng         Float?
  // location geography(Point,4326) via raw SQL
  areaHectares Decimal? @db.Decimal(12, 4)
  timezone    String   @default("Asia/Dhaka")
  status      String   @default("ACTIVE")
  @@unique([orgId, code])
}

model UserFarmRole {
  id     String @id @default(cuid())
  userId String
  farmId String
  role   String
  @@unique([userId, farmId, role])
}

model LandUnit {
  id          String   @id @default(cuid())
  farmId      String
  parentId    String?
  kind        String   // PLOT BLOCK POND SHED BARN GREENHOUSE
  name        String
  // geom geography(Polygon,4326) via migration
  areaHectares Decimal  @db.Decimal(12, 4)
  soilType    String?
  irrigation  String?
  status      String   @default("ACTIVE")
  @@index([farmId, status])
}

model CropCycle {
  id           String   @id @default(cuid())
  farmId       String
  landUnitId   String
  parentCycleId String?
  cropName     String
  varietyId    String?
  season       String?
  status       String
  plantedOn    DateTime? @db.Date
  plannedHarvestOn DateTime? @db.Date
  contracted   Boolean  @default(false)
  contractId   String?
  @@index([farmId, status])
}

model CycleActivity {
  id         String   @id @default(cuid())
  cycleId    String
  type       String   // SOW IRRIGATE FERTILIZE SPRAY SCOUT HARVEST
  scheduledAt DateTime?
  doneAt     DateTime?
  qty        Decimal? @db.Decimal(14, 3)
  inventoryBatchId String?
  notes      String?
  clientEventId String? @unique
}

model Animal {
  id         String   @id @default(cuid())
  orgId      String
  farmId     String
  species    String   // CATTLE BUFFALO GOAT SHEEP CHICKEN DUCK etc.
  purpose    String?  // DAIRY MEAT DRAFT BREEDING
  visualTag  String
  eid        String?
  sex        String?
  dob        DateTime? @db.Date
  damId      String?
  sireId     String?
  status     String   @default("ACTIVE")
  groupId    String?
  @@unique([orgId, visualTag])
  @@index([farmId, species, status])
}

model AnimalGroup {
  id       String @id @default(cuid())
  farmId   String
  name     String
  kind     String // HERD FLOCK BATCH
}

model AnimalEvent {
  id        String   @id @default(cuid())
  animalId  String?
  groupId   String?
  type      String   // WEIGHT MILK EGGS MOVE BREED PREGNANCY BIRTH DEATH SALE
  at        DateTime
  qty       Decimal? @db.Decimal(14, 3)
  meta      Json?
  clientEventId String? @unique
}

model HealthProtocol {
  id       String @id @default(cuid())
  orgId    String
  species  String
  name     String
  schedule Json   // [{day, productId, dose}]
}

model HealthEvent {
  id            String   @id @default(cuid())
  animalId      String?
  groupId       String?
  productId     String?
  type          String   // VACCINE TREATMENT DEWORM
  status        String
  scheduledAt   DateTime?
  givenAt       DateTime?
  withdrawalEndsAt DateTime?
  vetVendorId   String?
  bookingId     String?
}

model PondStocking {
  id          String   @id @default(cuid())
  farmId      String
  landUnitId  String
  species     String
  stockedAt   DateTime @db.Date
  seedCount   Int
  status      String
}

model FeedRecipe {
  id     String @id @default(cuid())
  orgId  String
  name   String
  target Json?
  lines  Json   // [{itemId, pct}]
}

model FeedBatch {
  id        String @id @default(cuid())
  recipeId  String
  qtyKg     Decimal @db.Decimal(14, 3)
  costMinor Int
  mixedAt   DateTime @default(now())
}

model InventoryItem {
  id       String @id @default(cuid())
  orgId    String
  sku      String
  name     String
  kind     String // SEED FERTILIZER PESTICIDE FEED DRUG FUEL OTHER
  unit     String
  restricted Boolean @default(false)
  @@unique([orgId, sku])
}

model InventoryBatch {
  id         String   @id @default(cuid())
  itemId     String
  farmId     String?
  lotNumber  String?
  expiryDate DateTime? @db.Date
  qtyOnHand  Decimal  @db.Decimal(14, 3)
  costMinor  Int
  status     String   @default("ACTIVE")
  @@index([itemId, expiryDate])
}

model Device {
  id         String @id @default(cuid())
  farmId     String
  name       String
  kind       String // SOIL_MOISTURE WEATHER_STATION TANK_DO TEMP CAMERA
  keyHash    String
  landUnitId String?
  status     String @default("ACTIVE")
}

model SensorReading {
  id       String   @id @default(cuid())
  deviceId String
  metric   String
  value    Decimal  @db.Decimal(18, 6)
  at       DateTime
  @@index([deviceId, metric, at])
}

model WeatherSnapshot {
  id        String   @id @default(cuid())
  farmId    String
  at        DateTime
  source    String
  tempC     Decimal? @db.Decimal(6, 2)
  rainfallMm Decimal? @db.Decimal(8, 2)
  humidity  Decimal? @db.Decimal(5, 2)
  raw       Json?
  @@index([farmId, at])
}

model ForecastRun {
  id           String   @id @default(cuid())
  cycleId      String?
  pondId       String?
  modelVersion String
  forecastQty  Decimal  @db.Decimal(14, 3)
  unit         String
  inputs       Json
  createdAt    DateTime @default(now())
}

model CostLedgerEntry {
  id          String   @id @default(cuid())
  orgId       String
  farmId      String?
  costCenter  String
  entityType  String
  entityId    String
  sourceType  String
  sourceId    String
  amountMinor Int
  memo        String?
  at          DateTime @default(now())
  @@index([orgId, entityType, entityId])
}

model HarvestLot {
  id         String   @id @default(cuid())
  farmId     String
  cycleId    String?
  pondStockingId String?
  lotCode    String
  qty        Decimal  @db.Decimal(14, 3)
  unit       String
  grade      String?
  status     String
  traceQr    String   @unique
  @@unique([farmId, lotCode])
}

model Sale {
  id          String   @id @default(cuid())
  orgId       String
  farmId      String
  buyerName   String?
  marketplaceOrderId String?
  contractId  String?
  totalMinor  Int
  status      String
  soldAt      DateTime @default(now())
}

model OfftakeContract {
  id             String @id @default(cuid())
  orgId          String
  farmId         String?
  buyerName      String
  buyerVendorId  String?
  status         String
  product        String
  volumeQty      Decimal? @db.Decimal(14, 3)
  priceTerms     Json
  advanceMinor   Int @default(0)
}

model CoopMember {
  id             String @id @default(cuid())
  orgId          String
  userId         String?
  name           String
  shareUnits     Decimal @db.Decimal(14, 4)
  status         String
}

model CoopPolicy {
  orgId            String @id
  wCapitalBps      Int
  wPatronageBps    Int
  wEqualBps        Int
  reserveBps       Int @default(0)
}

model DividendRun {
  id     String @id @default(cuid())
  orgId  String
  period String
  status String
  distributableMinor Int
}

model LoanFacility {
  id             String @id @default(cuid())
  orgId          String
  lender         String
  principalMinor Int
  status         String
  terms          Json?
}

model SubsidyClaim {
  id          String @id @default(cuid())
  orgId       String
  programName String
  amountMinor Int
  status      String
}

model Vendor {
  id             String @id @default(cuid())
  ownerId        String
  slug           String @unique
  businessName   String
  type           VendorType
  status         String
  commissionBps  Int @default(1000)
  lat            Float?
  lng            Float?
  serviceRadiusKm Int?
}

model VendorKyc {
  vendorId  String @id
  documents Json
  licenses  Json?
  status    String
  reviewedAt DateTime?
}

model VendorService {
  id              String @id @default(cuid())
  vendorId        String
  title           String
  kind            String // VISIT TELECONSULT RENTAL LABOR TRANSPORT
  durationMinutes Int @default(60)
  priceMinor      Int
  bufferMinutes   Int @default(0)
}

model VendorProduct {
  id         String @id @default(cuid())
  vendorId   String
  name       String
  sku        String?
  priceMinor Int
  stockQty   Decimal? @db.Decimal(14, 3)
  restricted Boolean @default(false)
}

model Booking {
  id          String   @id @default(cuid())
  vendorId    String
  serviceId   String
  orgId       String
  farmId      String?
  status      String
  startAt     DateTime
  endAt       DateTime
  priceMinor  Int
  @@index([vendorId, startAt, endAt])
}

model MarketplaceOrder {
  id          String @id @default(cuid())
  vendorId    String
  orgId       String
  status      String
  goodsMinor  Int
  commissionMinor Int @default(0)
  clientOrderId String? @unique
}

model Review {
  id        String @id @default(cuid())
  vendorId  String
  userId    String
  bookingId String? @unique
  orderId   String? @unique
  rating    Int
  body      String?
}

model Payment {
  id             String @id @default(cuid())
  provider       String
  status         String
  amountMinor    Int
  currency       String @default("BDT")
  bookingId      String?
  orderId        String?
  saleId         String?
  idempotencyKey String @unique
  providerRef    String?
}

model TeleconsultSession {
  id        String @id @default(cuid())
  bookingId String @unique
  provider  String
  status    String
  roomName  String?
}

model VendorBalance {
  vendorId       String @id
  availableMinor Int @default(0)
  pendingMinor   Int @default(0)
}

model OutboxEvent {
  id          String    @id @default(cuid())
  type        String
  payload     Json
  createdAt   DateTime  @default(now())
  processedAt DateTime?
}

model SyncEvent {
  id             String    @id @default(cuid())
  farmId         String
  deviceId       String?
  clientEventId  String    @unique
  type           String
  payload        Json
  status         String
  receivedAt     DateTime  @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String?
  orgId     String?
  farmId    String?
  action    String
  entity    String
  entityId  String?
  meta      Json?
  createdAt DateTime @default(now())
  @@index([orgId, createdAt])
}

model WebhookEvent {
  id              String    @id @default(cuid())
  provider        String
  providerEventId String
  payload         Json
  processedAt     DateTime?
  @@unique([provider, providerEventId])
}
```

Add PostGIS columns and exclusion/unique constraints for booking overlap in raw SQL migrations. Partial unique index on active bookings: `(serviceId, tstzrange)` where status in (`HELD`,`CONFIRMED`,`IN_PROGRESS`).

---

## 7. REST API (NestJS modules)

Modules: `AuthModule`, `OrgsModule`, `FarmsModule`, `GisModule`, `CropsModule`, `LivestockModule`, `HealthModule`, `AquaModule`, `InventoryModule`, `FeedModule`, `IotModule`, `WeatherModule`, `ForecastModule`, `LaborModule`, `EquipmentModule`, `AccountingModule`, `HarvestModule`, `ContractsModule`, `CoopModule`, `FinanceModule` (loans/subsidies), `SyncModule`, `VendorsModule`, `BookingsModule`, `MarketplaceOrdersModule`, `PaymentsModule`, `TeleconsultModule`, `NotificationsModule`, `ReportsModule`, `AdminModule`.

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/register` `/auth/login` `/auth/refresh` `/auth/otp/request` | |
| CRUD | `/orgs` `/orgs/:id/members` `/farms` | typologies, systems |
| GET/POST | `/farms/:id/land-units` | GeoJSON body; server area |
| GET | `/farms/:id/map` | all units + latest sensors |
| CRUD | `/cycles` | crop plans |
| POST | `/cycles/:id/activities` | FEFO + PHI checks |
| CRUD | `/animals` `/animals/:id/events` | tag unique |
| POST | `/health/protocols/:id/generate` | schedule doses |
| POST | `/health/events/:id/give` | sets withdrawal |
| CRUD | `/ponds/:id/stockings` `/feed/recipes` `/feed/batches` | |
| POST | `/inventory/issue` | FEFO |
| POST | `/iot/devices/:id/readings` | device key |
| GET | `/weather/farms/:id` | cached forecast |
| POST | `/forecast/cycles/:id/run` | |
| POST | `/labor/attendance` `/equipment/logs` | |
| GET | `/accounting/pnl` | query entityType+id |
| POST | `/harvest-lots` `/sales` | withdrawal check |
| CRUD | `/contracts` `/contracts/:id/deliveries` | |
| POST | `/coop/dividend-runs` | |
| CRUD | `/loans` `/subsidies` | |
| POST | `/sync/push` GET `/sync/pull?since=` | offline |
| POST | `/vendors/apply` `/admin/vendors/:id/review` | KYC |
| GET | `/marketplace/search` | type, geo, date |
| POST | `/bookings/holds` `/bookings` | vet/rental |
| POST | `/marketplace/orders` | |
| POST | `/payments/intent` | |
| POST | `/payments/webhooks/:provider` | raw body |
| POST | `/teleconsult/:bookingId/token` | |
| POST | `/reviews` | after complete |
| GET | `/reports/season-book` `/reports/spray-diary` `/reports/trace/:lotCode` | |
| GET | `/public/trace/:qr` | limited public trace |

Idempotency-Key required on payments, bookings, inventory issue, and sync push.

---

## 8. Real-time (Socket.IO)

Namespace `/ws`, JWT handshake.

- Rooms: `org:{id}`, `farm:{id}`, `booking:{id}`, `vendor:{id}`, `user:{id}`
- Events: `alert.raised`, `sensor.threshold`, `booking.updated`, `order.status`, `tele.participant_joined`, `sync.pending_review`, `inventory.low`
- Authorize room joins; never broadcast raw animal owner PII to vendors except assigned booking context.
- IoT high-frequency readings are **not** streamed 1:1; emit aggregated/threshold events only (2–5s throttle).

---

## 9. Background Jobs (BullMQ)

| Queue | Job |
|-------|-----|
| `weather` | pull forecasts for active farms |
| `iot` | downsample readings; evaluate alert rules |
| `health` | emit overdue vaccination / withdrawal-ending reminders |
| `irrigation` | adjust SOP tasks from rainfall |
| `forecast` | scheduled yield refresh mid-season |
| `inventory` | expiry quarantine; low-stock SMS |
| `accounting` | period allocation / close hints |
| `coop` | dividend run calculate |
| `marketplace` | expire booking holds; reservation TTL; payout batch |
| `sync` | escalate PENDING_REVIEW |
| `notifications` | SMS/email fanout |
| `webhooks` | payment retry |

---

## 10. Security

- Argon2id passwords; refresh tokens stored hashed; OTP rate limits.
- Device ingest keys hashed; rotate on compromise.
- Restricted pesticide / vet drug purchases require vendor license + farm applicator flag.
- Treatment and withdrawal overrides audited.
- Vendor cannot read farm P&L or uninvolved animal records.
- Payment webhook signature verification per provider.
- Encrypted document uploads (KYC, prescriptions); signed URLs.
- CORS allowlist, Helmet, validation pipes (Zod).
- Locale-safe logging: no national IDs or full card numbers.

---

## 11. Caching

- Redis: weather by farm (TTL 1–3h), vendor search tiles (short TTL), session/refresh denylist, price/commission config.
- Plot GeoJSON cache invalidated on land-unit edit.
- P&L summaries cached per entity with version bump on ledger insert.

---

## 12. Testing Strategy

- Unit: FEFO, PHI/withdrawal blockers, coop distribution weights, yield function with fixture inputs, typology module flags.
- Integration (Testcontainers Postgres+PostGIS+Redis):
  - Concurrent vet booking holds → exactly one confirmation.
  - Inventory issue race does not go negative.
  - Multi-farm user cannot read farm B in farm A context.
  - Duplicate `clientEventId` does not double-post activities or stock.
  - Milk sale blocked during withdrawal; allowed after clock advance.
- E2E Playwright: login (bn locale), create plot (map stub), start crop cycle, offline activity sync, marketplace vet hold+pay stub.
- Contract tests for payment provider adapters.
- Property: journal / cost ledger sums match source documents.

---

## 13. Folder Structure

```
agro-farm-management/
  Project_spec.md
  README.md
  .gitignore
  .github/workflows/deploy.yml
  deploy/
    README.md
    .env.example
    docker-compose.prod.yml
  frontend/                 # Next.js App Router PWA
    package.json
    next.config.ts
    playwright.config.ts
    Dockerfile
    .env.example
    src/app/(public)/       # landing, trace
    src/app/(app)/          # farm console
    src/app/(marketplace)/  # vendor + booking
    src/app/(field)/        # offline field UI
    src/components/
    src/lib/api.ts
    src/lib/offline.ts
    src/lib/socket.ts
    e2e/
  backend/
    Project_spec.md         # pointer or copy of root spec
    package.json
    prisma/schema.prisma
    prisma/seed.ts
    Dockerfile
    docker-compose.yml
    .env.example
    src/main.ts
    src/app.module.ts
    src/modules/*           # one Nest module per domain above
    src/common/locks/
    src/common/payments/
    test/
```

No monorepo workspace root `package.json` (same convention as the reference projects). Backend `dev:all` may start both apps.

---

## 14. Environment Variables (names only)

`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `APP_URL`, `CORS_ORIGINS`, `PORT`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `SMTP_URL`, `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER_ID`, `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_IS_LIVE`, `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_BASE_URL`, `NAGAD_MERCHANT_ID`, `NAGAD_PRIVATE_KEY`, `NAGAD_BASE_URL`, `WEATHER_PROVIDER`, `WEATHER_API_KEY`, `IOT_INGEST_MAX_RPS`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`, `DEFAULT_COMMISSION_BPS`, `BOOKING_HOLD_MINUTES`, `OFFLINE_MAX_HOURS`, `SEED_PASSWORD`, `DEFAULT_LOCALE`

---

## 15. Milestones / Phased Build Plan

1. **M1** Auth, orgs, farms, typologies, RBAC guards, i18n shell (bn/en).
2. **M2** PostGIS land units + map UI; farm switcher.
3. **M3** Crop cycles, activities, FEFO inventory, spray PHI rules.
4. **M4** Livestock tags, events, health protocols, withdrawal enforcement.
5. **M5** Aquaculture stockings, feed recipes/batches.
6. **M6** IoT ingest, weather adapter, alerts, yield forecast stub.
7. **M7** Labor, equipment, cost ledger, P&L reports.
8. **M8** Harvest lots, sales, public trace QR, contract farming.
9. **M9** Cooperative shares + dividend engine; loans/subsidies register.
10. **M10** Offline sync PWA (field app).
11. **M11** Vendor KYC, catalog, geo search, bookings (vet/teleconsult/rental).
12. **M12** Marketplace orders, payments (COD + one BD gateway live, others stubbed), commission, ratings, payouts, harden + seed demos.

---

## 16. Acceptance Criteria

- [ ] All five typologies can be created; module visibility follows §4.1.
- [ ] Plot polygons persist in PostGIS; server-computed area used in reports.
- [ ] Two overlapping ACTIVE plots are rejected (unless allowOverlap).
- [ ] Restricted pesticide spray blocked when PHI would miss harvest date.
- [ ] FEFO issue never selects expired drug/chemical batches.
- [ ] Duplicate animal tags in one org rejected; movements update farm location.
- [ ] Milk/meat lot sale blocked during withdrawal; allowed after end.
- [ ] Vaccination generator creates future `SCHEDULED` doses from a protocol.
- [ ] Feed batch deducts ingredients and posts cost to the target group/pond.
- [ ] IoT reading with bad device key is rejected; threshold creates a deduped alert.
- [ ] Yield forecast runs without NDVI (manual inputs) and stores `modelVersion`.
- [ ] P&L for a crop cycle equals the sum of cost ledger + sales for that cycle.
- [ ] Coop dividend weights apply to the paisa; leftover remainder on last member.
- [ ] Contract delivery cannot exceed remaining obligation without amendment.
- [ ] Concurrent booking of the same vet slot → exactly one `CONFIRMED`.
- [ ] Duplicate `clientEventId` sync is idempotent.
- [ ] Field worker cannot read org P&L.
- [ ] Vendor in `KYC_PENDING` cannot appear in public search.
- [ ] Payment webhook replay does not double-credit vendor ledger.
- [ ] COD marketplace order pays vendor only after delivery confirm.
- [ ] UI locale switches bn/en for core farm and marketplace screens.
- [ ] docker-compose boots Postgres (PostGIS), Redis, API, and web.
- [ ] Seed: 1 small farm, 1 commercial multi-system farm, 1 cooperative, sample vendors (vet, feed, seed, transport), demo cycles and tagged animals.

---

## 17. Agent Implementation Notes

- Keep `PaymentProvider`, `WeatherProvider`, `TeleconsultProvider`, and `YieldModel` as interfaces with fake implementations for tests.
- `InventoryService.allocateFeFo` and `HealthService.assertWithdrawable` are single chokepoints.
- Cost ledger is append-only; corrections are reversing entries.
- Prefer domain services over fat controllers; one transition table per state machine.
- Seed passwords only for local; refuse seed when `NODE_ENV=production`.
- Map UI: MapLibre; store GeoJSON; never require a paid map token for local dev (free tiles / local style).
- Bangla labels in UI copy and SMS templates; API enum codes stay English.
- Reference the layout of `school-college-erp`, `event-wedding-management`, and `pharmacy-management`: independent `frontend/` and `backend/` packages, Prisma in backend, deploy compose under `deploy/`, no root workspace manifest.
