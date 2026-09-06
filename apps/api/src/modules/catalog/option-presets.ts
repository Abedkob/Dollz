export const catalogOptionPresets = {
  'eye-color': {
    code: 'eye-color',
    name: 'Eye color',
    description: 'Choose the doll eye color.',
    inputType: 'COLOR' as const,
    isRequired: true,
    affects3d: true,
    threeDProperty: 'eyes',
    values: [
      { code: 'warm-brown', label: 'Warm brown', colorHex: '#6F4A3A' },
      { code: 'soft-blue', label: 'Soft blue', colorHex: '#6F91B2' },
      { code: 'sage-green', label: 'Sage green', colorHex: '#78866B' },
      { code: 'hazel', label: 'Hazel', colorHex: '#96775A' },
    ],
  },
  'hair-color': {
    code: 'hair-color',
    name: 'Hair color',
    description: 'Choose the doll hair color.',
    inputType: 'COLOR' as const,
    isRequired: true,
    affects3d: true,
    threeDProperty: 'hair',
    values: [
      { code: 'espresso', label: 'Espresso', colorHex: '#3B2923' },
      { code: 'chestnut', label: 'Chestnut', colorHex: '#70452F' },
      { code: 'honey-blonde', label: 'Honey blonde', colorHex: '#C9A66B' },
      { code: 'copper', label: 'Copper', colorHex: '#A95C3D' },
      { code: 'soft-black', label: 'Soft black', colorHex: '#252326' },
    ],
  },
  'skin-tone': {
    code: 'skin-tone',
    name: 'Skin tone',
    description: 'Choose the doll fabric skin tone.',
    inputType: 'COLOR' as const,
    isRequired: true,
    affects3d: false,
    threeDProperty: null,
    values: [
      { code: 'porcelain', label: 'Porcelain', colorHex: '#F1D2C2' },
      { code: 'warm-beige', label: 'Warm beige', colorHex: '#DDB08D' },
      { code: 'golden-brown', label: 'Golden brown', colorHex: '#B97850' },
      { code: 'deep-brown', label: 'Deep brown', colorHex: '#70452F' },
    ],
  },
  'outfit-color': {
    code: 'outfit-color',
    name: 'Outfit color',
    description: 'Choose the main outfit color.',
    inputType: 'COLOR' as const,
    isRequired: false,
    affects3d: false,
    threeDProperty: null,
    values: [
      { code: 'plum', label: 'Plum', colorHex: '#6F315F' },
      { code: 'rose', label: 'Dusty rose', colorHex: '#C9828D' },
      { code: 'sage', label: 'Sage', colorHex: '#87977A' },
      { code: 'cream', label: 'Cream', colorHex: '#EDE1CC' },
      { code: 'navy', label: 'Navy', colorHex: '#34445C' },
    ],
  },
} as const;

export type CatalogOptionPresetCode = keyof typeof catalogOptionPresets;

export function catalogOptionPreset(code: CatalogOptionPresetCode) {
  return catalogOptionPresets[code];
}
