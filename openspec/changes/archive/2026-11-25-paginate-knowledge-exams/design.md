# Design

- Keep all answers in the runner state; pagination only slices rendering.
- Use a fixed page size of ten.
- Show Previous plus Next on pages 1..N-1; show Submit on page N.
- Keep the timer and auto-submit independent of the current page.
- Preserve global question numbering across pages.
