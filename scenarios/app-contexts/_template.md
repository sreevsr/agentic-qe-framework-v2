# App-Context: {App Name} ({domain})

## Application Overview
- **URL:** {{ENV.BASE_URL}}
- **Type:** {enterprise-spa | e-commerce | internal-tool | saas | mobile-web}
- **Tech Stack:** {React 18, MUI 5 | Angular 16, PrimeNG | Vue 3, Vuetify | etc.}
- **Auth:** {SSO/ADFS | form-based | OAuth2 | API token | none}
- **Routing:** {hash (#/) | path-based (/) | server-rendered}
- **API Style:** {REST | GraphQL | mixed}

---

## Component Library
- **UI Framework:** {MUI 5 | Ant Design 5 | Fluent UI | Kendo UI | PrimeReact | Bootstrap | custom}
- **Dropdowns:** {MUI Select (not native) | Ant Select | native <select> | custom}
- **Date Pickers:** {MUI DatePicker | flatpickr | native input[type=date] | custom}
- **Data Grids:** {MUI DataGrid | AG Grid | Kendo Grid | native table | custom}
- **Modals:** {MUI Dialog | Ant Modal | Bootstrap Modal | custom}

---

## Pacing
- **Post-navigation wait:** {networkIdle | 500ms | 1000ms}
- **Post-click wait:** {0 | 300ms (for MUI animations) | 500ms}
- **Post-filter wait:** {networkIdle (grid refreshes via API) | 1000ms}
- **Form submission wait:** {networkIdle | redirect detection}

---

## Learned Patterns

### Pattern: {Short Name}
- **Component:** {what UI element}
- **Expected:** {what you'd think happens}
- **Actual:** {what really happens}
- **Working approach:** {how to handle it}
- **Discovered:** {date}

---

## Known Page Structure
- **{Page Name} ({route}):** {brief description of key elements}

---

## Authentication Flow
- {describe the login/SSO flow step by step}
- {note any redirects, MFA, CAPTCHA}
- {session cookie name if known}

---

## Known Issues
- {any persistent bugs, flaky elements, or workarounds}
