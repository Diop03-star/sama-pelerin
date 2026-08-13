---
name: Pilgrim Management System
colors:
  surface: '#f9f9f7'
  surface-dim: '#dadad8'
  surface-bright: '#f9f9f7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4f2'
  surface-container: '#eeeeec'
  surface-container-high: '#e8e8e6'
  surface-container-highest: '#e2e3e1'
  on-surface: '#1a1c1b'
  on-surface-variant: '#45464d'
  inverse-surface: '#2f3130'
  inverse-on-surface: '#f1f1ef'
  outline: '#76777e'
  outline-variant: '#c6c6ce'
  surface-tint: '#535e7b'
  primary: '#09152e'
  on-primary: '#ffffff'
  primary-container: '#1f2a44'
  on-primary-container: '#8691b0'
  inverse-primary: '#bbc6e7'
  secondary: '#775928'
  on-secondary: '#ffffff'
  secondary-container: '#ffd79b'
  on-secondary-container: '#7a5c2b'
  tertiary: '#1f1400'
  on-tertiary: '#ffffff'
  tertiary-container: '#382804'
  on-tertiary-container: '#a78f61'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d9e2ff'
  primary-fixed-dim: '#bbc6e7'
  on-primary-fixed: '#0f1b34'
  on-primary-fixed-variant: '#3b4662'
  secondary-fixed: '#ffdeae'
  secondary-fixed-dim: '#e8c086'
  on-secondary-fixed: '#281800'
  on-secondary-fixed-variant: '#5d4213'
  tertiary-fixed: '#fcdfab'
  tertiary-fixed-dim: '#dfc391'
  on-tertiary-fixed: '#261900'
  on-tertiary-fixed-variant: '#57441d'
  background: '#f9f9f7'
  on-background: '#1a1c1b'
  surface-variant: '#e2e3e1'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1440px
  sidebar-width: 260px
  gutter: 24px
  margin-mobile: 16px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 24px
---

## Brand & Style
The design system is rooted in **Corporate Modernism** with a focus on administrative clarity and spiritual dignity. It serves a dual purpose: providing rigorous logistical control for operators while maintaining a calm, trustworthy environment for managing sacred journeys.

The aesthetic prioritizes high legibility, structured information density, and a premium "executive" feel. It utilizes generous white space to reduce cognitive load for non-technical users, ensuring that complex tasks—such as visa tracking and payment scheduling—feel manageable and transparent. The interface avoids decorative flourishes in favor of functional elegance.

## Colors
The palette is anchored by **Navy Blue**, signaling authority and stability. **Warm Gold/Bronze** is used sparingly for primary actions and "moments of achievement" (e.g., successful booking completion), providing a subtle nod to the prestige of the pilgrimage.

- **Backgrounds**: Use the soft off-white (`#F9F9F7`) for the main app canvas to reduce eye strain. Pure white (`#FFFFFF`) is reserved for cards and input surfaces.
- **Status System**: 
    - **Red**: Blocking issues, overdue payments, or rejected documents.
    - **Amber**: In-progress status, pending validations, or upcoming deadlines.
    - **Green**: Fully paid, validated documents, and completed milestones.
- **Currency**: All financial displays must use **FCFA** as the suffix (e.g., 2.500.000 FCFA).

## Typography
This design system uses **Inter** for its exceptional legibility in data-heavy SaaS environments. 

- **Hierarchy**: Use `display-lg` only for main dashboard overviews. `headline-sm` is the standard for card titles.
- **Data Display**: For passport numbers and transaction IDs, use the `data-mono` style to ensure characters are easily distinguishable.
- **Localization**: Language is French. Ensure that line heights accommodate common French diacritics (é, à, ç) without clipping. Dates must follow the `DD/MM/YYYY` format strictly.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. The sidebar remains fixed at 260px, while the main content area grows to a maximum width of 1440px to prevent excessive line lengths on ultra-wide monitors.

- **Grid**: Use a 12-column grid for the main content area with 24px gutters.
- **Sidebar**: Icons should be left-aligned with labels to their right. Active states use a subtle Navy Blue tint background and a 4px Gold left-border indicator.
- **Tables**: Use a "comfortable" density. Row heights should be minimum 56px to ensure touch targets are accessible and data is readable.

## Elevation & Depth
This design system avoids heavy shadows to maintain a clean, professional "paper-like" feel. 

- **Surface Strategy**: Contrast is created through tonal layering. The background is `#F9F9F7`, and primary containers (cards, sidebars) are `#FFFFFF`.
- **Borders**: Instead of shadows, use 1px solid borders in a light gray (`#E2E8F0`). 
- **Interactive States**: Buttons and clickable cards may use a very soft, highly diffused shadow (8% opacity Navy) only on hover to indicate interactivity.

## Shapes
A **Rounded** shape language is used to soften the institutional nature of the application. 

- **Cards**: Use `rounded-lg` (16px) for main content containers to create a modern, approachable feel.
- **Inputs & Buttons**: Use base `rounded` (8px) for a precise, professional appearance.
- **Status Badges**: Use fully rounded "pill" shapes for status indicators (Complete, Pending, etc.) to distinguish them clearly from interactive buttons.

## Components

### Action-Oriented Components
- **Progress Indicators**: Use horizontal stepped progress bars for document tracking (e.g., E-Visa, Medical, Flight). Use the 3-color status system to fill the segments.
- **Payment Timelines**: Vertical tracks showing paid vs. remaining balance in FCFA. Use the Gold accent for the "Current Step" and Green for "Completed Payments."
- **Alert Panels**: Low-saturation background tints of the status colors with a 4px solid left border in the high-saturation status color.

### Buttons & Inputs
- **Primary Button**: Navy Blue background with white text. High contrast, 8px radius.
- **Secondary Action**: White background, Navy Blue border, Navy Blue text.
- **Input Fields**: 1px light gray border. On focus, the border transitions to Navy Blue. Labels should be placed above the input using the `label-md` typography style.

### Navigation
- **Top Bar**: Minimalist design. Features the App Name on the left and the User Profile/Agency Name on the right.
- **Sidebar**: Grouped navigation links (e.g., "Gestion des Pèlerins," "Finances," "Logistique"). Use clear, stroke-based icons.

### Data Tables
- **Header**: Light gray background (`#F1F5F9`) with `label-md` text.
- **Cells**: `body-md` text. Include "Quick Action" buttons (View, Edit) that appear on row hover to keep the interface clean.