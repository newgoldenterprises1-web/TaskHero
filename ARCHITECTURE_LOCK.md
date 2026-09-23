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
