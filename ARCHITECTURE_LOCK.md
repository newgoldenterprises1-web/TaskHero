# Near Family Architecture Lock

Status: LOCKED

This repository uses a multi-file architecture for Near Family. Do not convert the customer application into a monolithic single-page `index.html`.

## Customer application

The root `index.html` is a lightweight loader/shell only. It may contain document metadata, external library/configuration references, mount slots, and the customer shell loader.

Customer screens, sections, modals, styles, and application logic must remain in separate files:

- `customer/pages/splash.html`
- `customer/pages/auth.html`
- `customer/pages/app-shell.html`
- `customer/pages/header.html`
- `customer/pages/home.html`
- `customer/pages/bookings.html`
- `customer/pages/family.html`
- `customer/pages/profile.html`
- `customer/pages/navigation.html`
- `customer/pages/modals.html`
- `customer/css/app.css`
- `customer/js/app.js`
- `customer/js/shell-loader.js`

## Partner application

Partner UI is also multi-file:
- `partner.html` = shell/markup
- `partner/js/app.js` = partner logic
- `partner/css/app.css` = partner styling

Do not merge the partner application back into a monolithic `partner.html`.

## Customer and Partner application boundary

Customer and Partner are two separate applications and must remain separate.

### Customer
- Entry: `index.html`
- UI: `customer/pages/`
- JS: `customer/js/`
- CSS: `customer/css/`

### Partner
- Entry: `partner.html`
- JS: `partner/js/`
- CSS: `partner/css/`

Rules:
1. Never merge Customer and Partner screens into one application shell.
2. Never load Partner pages/components into the Customer app.
3. Never load Customer pages/components into the Partner app.
4. Do not share UI files between Customer and Partner.
5. Shared backend/API contracts may be reused, but frontend application files remain separate.
6. A future developer must preserve this separation unless the user explicitly requests an architecture change.

## Admin application

Admin UI logic and styling remain separated:

- `admin.html` for the admin shell/markup
- `admin/js/app.js` for admin logic
- `admin/css/app.css` for admin styling

## Backend and security

Backend/business logic remains separate from UI:

- `functions/index.js`
- `backend.js`
- `firestore.rules`
- `storage.rules`

## Change rules

1. Do not merge the customer screens back into root `index.html`.
2. Do not place the complete customer application, all screen markup, or all application JavaScript in a single file.
3. New customer screens/features should be added to the appropriate file under `customer/pages`, `customer/js`, or `customer/css`.
4. New admin logic should go to `admin/js/app.js`; new admin styling should go to `admin/css/app.css`.
5. Backend and security changes must remain outside the customer UI files.
6. Preserve the existing Near Family UI/design unless the user explicitly requests a design change.
7. This architecture lock applies to future Near Family development unless the user explicitly changes it.

Verified structure at lock time: root `index.html` is a loader, customer screens are split, and admin JS/CSS are separate files.
