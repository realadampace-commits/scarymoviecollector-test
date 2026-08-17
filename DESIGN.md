# Scary Movie Collector — UI tokens

The shared `styles.css` defines the mobile-first visual language: deep blue-black surfaces, horror-pink accents, accessible focus rings, 44px touch targets, responsive grids, reduced-motion support, and reusable card/status/button primitives. Page data modules remain responsible for fetching, authorization, escaping, and rendering data.

## Layout
- `.wrap` is the responsive page container; desktop content reserves space for the sidebar.
- `.card`/`.panel` are elevated surfaces.
- `.grid` adapts from two-column mobile cards to fluid desktop collections.
- `.status` and `.empty` provide consistent feedback states.

## Accessibility
Contrast is prioritized for body text and controls, all form controls have visible focus states, and reduced-motion preferences are honored. Keep semantic headings, labels, alt text, and existing escaping in page modules.
