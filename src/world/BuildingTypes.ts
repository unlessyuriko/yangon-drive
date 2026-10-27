/** The Yangon building typology. Each lot along a street frontage is assigned one of these by height band and distance from Sule.
 *  To replace a procedural facade with a real photo, drop `public/buildings/<id>.jpg` (upper floors) and/or `<id>_ground.jpg` (shopfront). */
export interface BType {
  id: string;
  name: { en: string; my: string };
  note: string;                 // what the real thing looks like (the brief for the photos)
  hMin: number; hMax: number;   // height band this type can occupy
  core: number; rest: number;   // selection weight within CORE_RADIUS of Sule / elsewhere
  bay: number; floor: number; groundH: number;   // metres
  upper: string; lower: string | null;           // procedural facade ids (see Buildings.ts)
  tints: number[]; roof: number;
}

export const CORE_RADIUS = 650;

export const BUILDING_TYPES: BType[] = [
  { id: 'colonial-shophouse', name: { en: 'Colonial shophouse', my: 'ကိုလိုနီခေတ် ဆိုင်ခန်းတိုက်' },
    note: '3-5 storeys, narrow lots in continuous rows, arched or shuttered upper windows, cornice, arcaded or shuttered ground floor, faded pastel stucco, mildew stains.',
    hMin: 9, hMax: 22, core: 6, rest: 1.5, bay: 3.4, floor: 3.4, groundH: 4.2, upper: 'arched', lower: 'shop',
    tints: [0xe3d3ae, 0xd7b8a4, 0xc4d4c4, 0xe9dfc8, 0xe5c98c, 0xbcd0d6, 0xd9a99a], roof: 0x8a8782 },
  { id: 'colonial-grand', name: { en: 'Colonial landmark', my: 'ကိုလိုနီခေတ် အဆောက်အအုံကြီး' },
    note: 'Large red-brick or stucco government / bank / hotel buildings, 3-5 storeys, pilasters, deep cornice, central pediment or tower, tall windows.',
    hMin: 12, hMax: 26, core: 2, rest: 0.15, bay: 4.2, floor: 4.2, groundH: 5, upper: 'pilaster', lower: 'arcade',
    tints: [0xb5654a, 0xd9c9a3, 0xe8dcc0, 0xc9a37e], roof: 0x7a4a3c },
  { id: 'apartment-block', name: { en: 'Apartment block', my: 'တိုက်ခန်း' },
    note: '5-8 storey concrete slab block, balconies with metal grilles, hanging laundry, AC units, stained and weathered, shops on the ground floor, rooftop water tanks.',
    hMin: 14, hMax: 32, core: 3, rest: 5, bay: 3.6, floor: 3.2, groundH: 3.8, upper: 'balcony', lower: 'shop',
    tints: [0xd9d3c4, 0xcfc8b4, 0xc3c9bd, 0xd7c9b2, 0xbfb7a6, 0xd8cfd0], roof: 0x8c8a86 },
  { id: 'modern-shophouse', name: { en: 'Modern shophouse', my: 'ခေတ်သစ် ဆိုင်ခန်း' },
    note: '3-5 storey narrow concrete row house built after 1990, tiled front, aluminium and tinted-glass windows, colourful signboards, roller shutter ground floor.',
    hMin: 8, hMax: 19, core: 1.5, rest: 3.5, bay: 3.4, floor: 3.2, groundH: 3.8, upper: 'bandwin', lower: 'shop',
    tints: [0xe0d6c0, 0xd4c3a8, 0xc9d3cf, 0xe6cfc4, 0xd6e0d2, 0xd8d8e0], roof: 0x8c8a86 },
  { id: 'office-midrise', name: { en: 'Mid-rise office', my: 'ရုံးခန်း အဆောက်အအုံ' },
    note: '8-12 storey commercial building, ribbon windows with deep horizontal bands, concrete frame, banks and offices, signage at the top.',
    hMin: 20, hMax: 40, core: 2.5, rest: 1.5, bay: 3.6, floor: 3.5, groundH: 4.5, upper: 'ribbon', lower: 'shop',
    tints: [0xd9d4cc, 0xc9ccc9, 0xbfc9cf, 0xd7d0bf], roof: 0x8c8a86 },
  { id: 'condo-tower', name: { en: 'Condominium tower', my: 'ကွန်ဒို မျှော်စင်' },
    note: '15-30 storey glass and painted-panel tower with a podium, lift core, rooftop crown, usually new (post-2010).',
    hMin: 30, hMax: 200, core: 4, rest: 3, bay: 3.2, floor: 3.2, groundH: 3.2, upper: 'curtain', lower: null,
    tints: [0xdfe6ea, 0xd5dde2, 0xe3e0d6], roof: 0x9a9ea2 },
  { id: 'low-house', name: { en: 'Low house', my: 'အိမ်ပုပု' },
    note: '1-2 storey brick/plank house, corrugated zinc roof, small shuttered windows, fence or gate.',
    hMin: 0, hMax: 9, core: 1, rest: 3, bay: 3.2, floor: 3, groundH: 3, upper: 'lowhouse', lower: null,
    tints: [0xd2c8b0, 0xc8b8a0, 0xbfc6b4, 0xd8b8a8], roof: 0x9a5a44 },
];

export function pickType(h: number, dCentre: number, r: number): BType {
  const core = dCentre < CORE_RADIUS;
  let tot = 0;
  const w = BUILDING_TYPES.map((t) => { const v = h >= t.hMin && h <= t.hMax ? (core ? t.core : t.rest) : 0; tot += v; return v; });
  if (tot <= 0) return BUILDING_TYPES[2];
  let k = r * tot;
  for (let i = 0; i < w.length; i++) { k -= w[i]; if (k <= 0) return BUILDING_TYPES[i]; }
  return BUILDING_TYPES[2];
}
