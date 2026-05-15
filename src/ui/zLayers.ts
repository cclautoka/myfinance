/** Single source of truth for stacking — use `z-[${n}]` in classNames. */
export const zLayers = {
  base: 0,
  stickyHeader: 40,
  dockNav: 50,
  spotlightBackdrop: 200,
  spotlightRing: 208,
  spotlightPopover: 210,
  /** Blocking first-run household setup (full viewport). */
  setupWizard: 225,
  monthGate: 240,
  toast: 260,
  /** Confirm / blocking dialogs */
  modal: 10000,
} as const;
