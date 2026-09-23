# Near Family Developer Guide

## Architecture principle

Near Family is a multi-file application. Do not rebuild it as one large `index.html`.

The root `index.html` is only the customer entry shell/loader. It is not the place for customer screen markup, feature logic, or the full application.

## Customer app

### Pages
`customer/pages/` contains separate HTML fragments for customer screens and UI sections:

- `splash.html`
- `auth.html`
- `app-shell.html`
- `header.html`
- `home.html`
- `bookings.html`
- `family.html`
- `profile.html`
- `navigation.html`
- `modals.html`

Add a new customer screen as a new HTML file instead of expanding root `index.html`.

### JavaScript
`customer/js/app.js` contains customer application behavior.

`customer/js/shell-loader.js` loads the customer HTML fragments.

Keep feature logic in JS files. Do not place the whole customer application inside HTML.

### CSS
`customer/css/app.css` contains customer-specific styling.

Keep reusable styling here rather than creating a giant inline style section in root `index.html`.

## Admin app

- `admin.html` = admin shell/markup
- `admin/js/app.js` = admin behavior
- `admin/css/app.css` = admin styling

New admin features should follow this separation.

## Partner app

- `partner.html` = partner shell/markup
- `partner/js/app.js` = partner behavior and Firebase interactions
- `partner/css/app.css` = partner styling

Keep new partner features in these separate files. Do not move the full partner application back into `partner.html`.

## Backend

- `functions/index.js` = Cloud Functions entry points and orchestration
- `functions/lib/lifecycle.js` = centralized booking state machine and transition rules
- `functions/lib/catalog.js` = server-authoritative service catalogue and pricing
- `functions/lib/booking-validation.js` = shared booking payload/date/location validation
- `backend.js` = browser-side Firebase adapter
- `firestore.rules` = Firestore authorization
- `storage.rules` = Storage authorization
- `firestore.indexes.json` = Firestore indexes

Never move server authorization into browser-only code.

For new backend feature logic, prefer a small module under `functions/lib/` when the logic is reusable or independently testable. Keep `functions/index.js` focused on callable/event orchestration rather than becoming another monolith.

## Feature placement

For a new customer feature:

1. Screen/UI -> `customer/pages/<feature>.html`
2. Behavior/state -> `customer/js/app.js` or a dedicated JS module
3. Styling -> `customer/css/app.css`
4. Firebase callable wrapper -> `backend.js`
5. Server logic/validation -> `functions/index.js`
6. Database authorization -> `firestore.rules`
7. File upload authorization -> `storage.rules`

For a new admin feature:

1. Markup -> `admin.html`
2. Behavior -> `admin/js/app.js`
3. Styling -> `admin/css/app.css`
4. Authorization/business logic -> `functions/index.js`

## Rules for future developers

- Do not merge all screens into root `index.html`.
- Do not create a new monolithic customer HTML file.
- Keep UI, client logic, backend logic, and security rules separated.
- Preserve the existing Near Family UI/design unless a design change is explicitly requested.
- Use transactions for booking/partner lifecycle changes where race conditions are possible.
- Treat Firebase/Firestore/Storage rules as part of the security boundary.
- Do not claim production Firebase connectivity until real project configuration and deployment are verified.

## Local development

Because the customer shell loads HTML fragments with `fetch()`, serve the repository through HTTP during local testing. Do not open root `index.html` directly with `file://`.

Example:

```powershell
py -m http.server 8080 --bind 0.0.0.0
```

Then open the local server URL from the browser/phone on the same network.

## Architecture lock

See `ARCHITECTURE_LOCK.md`. That file is the canonical architecture constraint for future Near Family development.
