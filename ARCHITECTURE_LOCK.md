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
- `customer/pages/auth/login.html`
- `customer/pages/auth/signup.html`
- `customer/pages/modals/family.html`
- `customer/pages/modals/service.html`
- `customer/pages/modals/booking.html`
- `customer/pages/modals/success.html`
- `customer/pages/modals/toast.html`
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

## Non-monolithic code requirement

Customer and Partner are two separate applications. They must never be merged into one app or one frontend entry file.

Customer:
- Separate shell: `index.html`
- Separate UI files under `customer/pages/`
- Separate logic under `customer/js/`
- Separate styles under `customer/css/`

Partner:
- Separate shell: `partner.html`
- Separate logic under `partner/js/`
- Separate styles under `partner/css/`

Both applications must remain modular. Do not put complete screens, all application logic, or a long feature implementation into one entry HTML file.

Keep files reasonably small and responsibility-focused. New features should be split into the appropriate page/module/style file rather than making an existing entry file excessively long.

Customer and Partner may share backend services/API contracts, but their frontend codebases, screens, navigation, and state logic remain separate.


## Screen-level file rule

Every customer UI screen or independently meaningful UI component must have its own focused file. Splash, login, signup, home, bookings, family, profile, booking form, service detail, success/tracking, navigation, and modal components are not to be bundled into one large HTML file.

Wrapper files may only contain layout slots or composition markup. They must not contain the complete child screens.

The same principle applies to Partner and Admin: keep entry files lightweight and place feature UI and logic in focused files.


## Native Customer mobile app

The actual Customer mobile application is Flutter and lives under `customer_app/`.

Required rules:
1. `customer_app/` is the source of truth for the Customer mobile application.
2. Do not convert the Customer mobile app into an HTML/WebView wrapper.
3. Keep screens in separate Dart files under `customer_app/lib/screens/`.
4. Keep models, data, state, theme and reusable widgets in separate directories/files.
5. `customer_app/lib/main.dart` must remain a lightweight entry point.
6. The root `customer/` HTML/CSS/JS frontend is not the native Customer mobile application.
7. Do not merge all Customer mobile code into a single Dart file.


## Near Family customer UI design lock

Status: LOCKED

The Customer mobile Home UI visual direction is now fixed unless the user explicitly requests a design change.

Locked direction:
- Premium, friendly, modern mobile marketplace presentation.
- Near Family brand palette: Deep Navy, Sunset Peach, Warm Beige, Earth Brown, with balanced 60-30-10 usage.
- Header: Near Family logo/wordmark, tagline, current location, notifications, and profile.
- Clean search bar below the header.
- Two equal 50/50 hero cards:
  - Popular Services: warm peach/beige presentation with human/family assistance imagery.
  - Community Bulk Orders: neighbourhood/community imagery with a stronger navy/teal treatment and clear bulk-quote CTA.
- Popular Services below the hero cards in a clean multi-card service grid.
- Trust highlights for verified providers, family-first service, and 24/7 support.
- Community/neighbourhood promotional content may appear below the core service content.
- Five-item bottom navigation: Home, Bookings, Bulk Orders, Family, Profile.
- Imagery should remain high-quality, relevant, natural-looking, and consistent with the Near Family brand.
- Do not redesign the home screen or change the visual direction unless the user explicitly asks for a UI/design change.
