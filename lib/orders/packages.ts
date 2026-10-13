// Must match the presets in public.create_order.
export const PACKAGE_PRESET_IDS = ["envelope", "small_box", "medium_box"] as const;
export type PackagePresetId = (typeof PACKAGE_PRESET_IDS)[number];
