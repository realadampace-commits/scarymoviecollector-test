# Scary Movie Collector — visual system

The shared `styles.css` is the single source of truth for the product's visual language. It uses an archival horror direction: neutral black surfaces, warm ivory type, restrained crimson actions, aged-gold links, fine square borders, editorial serif headings, and subtle film grain. Avoid generic neon gradients, excessive pills, blue social-network styling, and one-off page themes.

## Layout
- `.wrap` is the responsive page container; desktop content reserves space for the sidebar.
- `.card`/`.panel` are archival surfaces with a restrained crimson index mark.
- `.grid` adapts from two-column mobile cards to fluid desktop collections.
- `.status` and `.empty` provide consistent feedback states.

## Accessibility
Contrast is prioritized for body text and controls, all form controls have visible focus states, and reduced-motion preferences are honored. Keep semantic headings, labels, alt text, and existing escaping in page modules.

## Guardrails
- Load `/styles.css` after page-local legacy styles so shared tokens remain authoritative.
- Use the shared `.btn`, `.card`, `.panel`, `.grid`, `.status`, and avatar primitives before adding a new component.
- Keep primary actions crimson and secondary actions neutral; do not invent page-specific accent colors.
- Use `var(--display-font)` for editorial headings and `var(--ui-font)` for controls and body copy.
- New controls must retain 44px touch targets, visible focus, reduced-motion behavior, and mobile stacking.
