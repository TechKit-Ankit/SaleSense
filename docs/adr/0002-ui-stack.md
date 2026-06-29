# ADR 0002: UI Stack

## Status

Proposed

## Date

2026-06-18

## Context

SaleSense must feel fast and trustworthy at the billing counter, clear on mobile for owners, and professional in analytics and inventory screens. The UI must support dense tables, touch-friendly POS actions, accessible dialogs, forms, tabs, dropdowns, charts, toasts, and responsive layouts.

The project should avoid a generic admin-template look while still moving quickly.

## Decision

Use:

| Area               | Choice                                 | Reason                                                       |
| ------------------ | -------------------------------------- | ------------------------------------------------------------ |
| Component system   | shadcn/ui                              | Polished defaults while keeping component source in our repo |
| Styling            | Tailwind CSS                           | Fast styling, design tokens, responsive utility workflow     |
| Primitive behavior | Radix UI via shadcn components         | Accessibility, keyboard handling, focus management           |
| Icons              | lucide-react                           | Clean icon set for buttons, navigation, and toolbars         |
| Tables             | TanStack Table                         | Inventory, product, purchase, sales, and analytics tables    |
| Charts             | Recharts through shadcn chart patterns | Good fit for dashboard charts                                |
| Forms              | React Hook Form + Zod                  | Reliable form state and schema validation                    |
| Toasts             | Sonner                                 | Lightweight user feedback                                    |

Verified package baselines on 2026-06-18:

| Package                 | Latest observed stable |
| ----------------------- | ---------------------- |
| `shadcn`                | `4.11.0`               |
| `tailwindcss`           | `4.3.1`                |
| `lucide-react`          | `1.21.0`               |
| `@tanstack/react-table` | `8.21.3`               |
| `react-hook-form`       | `7.79.0`               |
| `zod`                   | `4.4.3`                |
| `recharts`              | `3.8.1`                |
| `sonner`                | `2.0.7`                |

## Why shadcn/ui

shadcn/ui is a good fit because components are added as source code to the project. This means SaleSense can start with strong UI defaults, then evolve into its own design system without being trapped behind a closed theme API.

Use shadcn/ui for:

- app shell, sidebar, navigation, breadcrumbs
- buttons, inputs, selects, dialogs, sheets, drawers
- POS panels, inventory forms, settings screens
- tables, badges, alerts, skeletons, empty states
- chart wrappers and dashboard cards

## Why Radix Is Still Mentioned

Radix is not a competing UI library in this decision. Many shadcn/ui components use Radix primitives underneath.

```text
Radix UI = accessibility and interaction behavior
shadcn/ui = styled project-owned components using Tailwind
```

Install Radix packages only when the shadcn component being added requires them. Direct Radix usage should be rare and reserved for custom components that shadcn does not provide.

## Why Not MUI

MUI is mature and reliable, but it often gives apps a generic enterprise-admin feel. Deep customization can also become theme-heavy. SaleSense needs a retail POS feel: fast, clear, touch-friendly, and product-specific.

MUI is not rejected because it is bad. It is rejected because shadcn/ui gives more design ownership for this product.

## Why Not Ant Design

Ant Design is strong for enterprise dashboards, but it is heavier than we need and can feel too back-office focused for a retail counter product.

## UI Design Rules

1. Prefer feature-specific screens over generic dashboard templates.
2. POS actions must be large, fast, and touch-friendly.
3. Inventory and reports can be dense, but must stay scannable.
4. Use icons for common actions where recognizable.
5. Use semantic tokens and component variants before raw color classes.
6. Use tables for operational data, not decorative cards.
7. Avoid nested cards and marketing-style hero layouts inside the app.
8. Every dialog, sheet, drawer, and form must be keyboard-accessible.
9. Use shadcn components before writing custom markup.
10. Document custom component patterns in `developer-reference/`.

## Initial Component Set

When the frontend is scaffolded, start with:

```text
button
input
label
field
select
checkbox
switch
textarea
dialog
sheet
drawer
dropdown-menu
tabs
table
badge
card
alert
separator
tooltip
popover
toast/sonner
skeleton
empty
sidebar
chart
```

## Revisit When

- UI customization becomes harder than expected
- shadcn version changes break too many local components
- the app needs a fully custom design system
- enterprise customers require a denser admin UI than planned
