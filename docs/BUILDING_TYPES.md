# Yangon building types

The city is built from 7 building types ([src/world/BuildingTypes.ts](../src/world/BuildingTypes.ts)).
Every street frontage is cut into lots of 5-14 m, and each lot gets its own type, tint and ground floor.
A type is chosen by building height and by distance from Sule (colonial types are more common within 650 m).

| id | what it is | height band | where it is common |
|---|---|---|---|
| `colonial-shophouse` | 3-5 storey row house, arched or shuttered windows, cornice | 9-22 m | downtown core |
| `colonial-grand` | large bank / government / hotel, pilasters, pediment | 12-26 m | downtown core, rare |
| `apartment-block` | 5-8 storey slab, balcony grilles, laundry, AC units | 14-32 m | everywhere |
| `modern-shophouse` | 3-5 storey post-1990 row house, tile and aluminium windows | 8-19 m | outside the core |
| `office-midrise` | 8-12 storey, ribbon windows | 20-40 m | mixed |
| `condo-tower` | glass or painted-panel tower | over 30 m | mixed |
| `low-house` | 1-2 storey, zinc roof, shuttered windows | under 9 m | outside the core |

## Feeding photos

For each type, drop front-on photos (straight on, no perspective, one to two floors of a single bay or two) into `public/buildings/`:

- `<id>.jpg`: upper floors. It is tiled once per bay per floor, so crop to one repeating bay.
- `<id>_ground.jpg`: shopfront / ground floor (types with a ground floor only).

If the file exists, it replaces the procedural facade for that type. If not, the game keeps the drawn one.
After adding photos for a type, we refine its proportions (floor height, bay width, roof) in the type table.

Check the mix in the browser console: `window.__buildingTypes` (lots per type).

Sources used for the typology: [Downtown Yangon](https://en.wikipedia.org/wiki/Downtown_Yangon) (colonial 4-storey mixed-use stock, 14 ft ceilings) and [Yangon](https://en.wikipedia.org/wiki/Yangon) (8-storey apartment blocks). No formal typology study was found, so the rest is from general knowledge and needs your photos to confirm.
