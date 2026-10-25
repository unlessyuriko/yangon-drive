# Yangon Drive: Design Document

A browser driving-school game set in real Yangon. Runs on phones and desktop.

## Decisions
- **Platforms:** desktop and mobile browsers (touch, keyboard, gamepad). Target 30 fps+ on mid-range Android.
- **Look:** clean, simplified, flat colors, low-poly buildings.
- **Audience:** learners (strict rules, instructor, exam) and casual players (free drive, relaxed).
- **Language:** Burmese + English. Signboards show both. UI and voice toggle, Burmese default.
- **Map area:** Sule, Pabaedan, Shwedagon, Hledan, plus the connecting roads (Pyay Rd, Bogyoke Aung San Rd, U Wisara Rd). Flyover at Hledan comes later.
- **Map source:** OpenStreetMap (credit OSM), converted offline into small chunks that load as you drive.
- **Camera:** first person default, third person on `C`. 
- **Gearbox:** automatic only.
- **Saving:** on device only (localStorage). No accounts.
- **Traffic side:** right-hand traffic.
- **Tech:** TypeScript, Vite, Three.js. Custom arcade car physics at first; revisit Rapier if needed.

## Modes
| | Learner | Free drive |
|---|---|---|
| Rules | strict, violations counted | relaxed, score only |
| Instructor | voice + tips | off |
| Assists | optional | off |
| Goal | lessons, exam, certificate | explore, missions |

## Lessons
1. Controls  2. Lane and speed  3. Lights and stop lines  4. Zebra crossings  5. Roundabouts (Sule)  6. Parking  7. Night and rain  8. Exam

## Phases
1. **Prototype:** drivable car, both cameras, touch/keyboard controls, test map. (in progress)
2. Sule + Pabaedan from OSM, Sule Pagoda, bilingual signs.
3. Rules and first lessons.
4. Shwedagon + Hledan (flyover).
5. AI cars, YBS buses, pedestrians.
6. Rain, night, instructor voice, exam.

## Mobile budget
First download under 15 MB. Instanced buildings, no heavy shadows, one low-res rear mirror, installable offline (PWA).
