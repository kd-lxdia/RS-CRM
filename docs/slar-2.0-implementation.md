# SLAR 2.0 EPC Control Implementation

This folder is a new isolated build based on the original `slar-crm`. The original folder is not changed.

## What SLAR 2.0 Adds

SLAR 2.0 adds an EPC control layer for Rocker Solar audit gaps:

- Lead duplicate controls by mobile, CA number, customer-name key, and address key.
- Mandatory follow-up, missed follow-up, hot lead, and lost-reason control fields.
- Project creation only after advance payment gate is satisfied.
- Project owner, sales owner, execution owner, documentation owner, installation owner, accounts owner, next action, deadline, and gate statuses.
- Survey control with roof/ground type, GPS proof, site photos, load/sanctioned load, shadow issue, structure requirement, checklist, and completion gate.
- Quotation cost sheet with module/inverter selection, all EPC cost heads, total cost, selling price, gross profit, margin percent, low-margin warning, and founder approval.
- BOM approval, lock, revision, shortage detection, and dispatch readiness.
- Warehouse serial tracking for panels/inverters and movement records for dispatch, return, damage, receiver proof, challan, and extra material approval.
- Payment milestone plan, overdue status, and dispatch block unless payment is cleared or founder override is approved.
- Installation checklist for structure, mounting, DC/AC wiring, inverter, earthing, testing, handover, mandatory photos, delay owner, punch points, and QC.
- Net metering/subsidy tracker with CA number, subsidy ID, B2C claim ID, DCR certificate, DISCOM/net meter/inspection/subsidy stages, and delay reason.
- Founder control room dashboard API and frontend page.
- Immutable-style audit log with old/new value payloads for critical changes.

## Backend Entry Point

All v2 APIs are mounted at:

```text
/api/epc-v2
```

Important endpoints:

```text
POST /api/epc-v2/leads/control
POST /api/epc-v2/projects/after-advance
POST /api/epc-v2/surveys
POST /api/epc-v2/quotations/cost-sheet
POST /api/epc-v2/quotations/:id/founder-approve
POST /api/epc-v2/bom
POST /api/epc-v2/bom/:id/approve-lock
POST /api/epc-v2/warehouse/material-movement
POST /api/epc-v2/payments/milestone-plan
POST /api/epc-v2/founder-overrides
POST /api/epc-v2/founder-overrides/:id/approve
POST /api/epc-v2/installation
PUT  /api/epc-v2/documentation/:projectId/subsidy
GET  /api/epc-v2/founder/control-room
```

## Frontend Entry Point

Admin and Project Head users can open:

```text
/admin/slar-2-control-room
/project-head/slar-2-control-room
```

The menu item is labelled `SLAR 2.0 Control`.

## Verification Notes

After dependencies are installed/generated in the `slar-2.0` folder:

```bash
cd slar-2.0/backend
npm install
npm run db:generate
npm run db:push
npm run build
```

Then run the frontend:

```bash
cd slar-2.0/frontend
npm install
npm run build
```

## Design Choice

The v2 models are additive and prefixed with `Epc*`. They reference legacy `Lead`, `Customer`, `Payment`, `StockItem`, and other records by ID/string instead of rewriting original models. This keeps the base CRM intact while giving Rocker Solar a stricter EPC operating layer.
