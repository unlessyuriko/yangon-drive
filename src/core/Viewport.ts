/** Phones always play in landscape. When a phone is held in portrait the whole page is turned 90 degrees by CSS (body.rot), so the player never has to rotate the device.
 *  `vp` is the virtual (landscape) size; use it instead of innerWidth/innerHeight, and `toVirt` / `dVirt` to turn pointer positions and movements into virtual ones. */
export const coarse = matchMedia('(pointer: coarse)').matches || /[?&]touch(&|$)/.test(location.search);   // ?touch forces the phone layout on a desktop browser
export const vp = { rot: false, w: innerWidth, h: innerHeight };
export function updateViewport() {
  vp.rot = coarse && innerHeight > innerWidth;
  vp.w = vp.rot ? innerHeight : innerWidth; vp.h = vp.rot ? innerWidth : innerHeight;
  document.body.classList.toggle('rot', vp.rot);
  document.documentElement.style.setProperty('--vw', vp.w + 'px'); document.documentElement.style.setProperty('--vh', vp.h + 'px');
}
/** client (screen) coordinates -> virtual page coordinates */
export const toVirt = (cx: number, cy: number): [number, number] => (vp.rot ? [cy, innerWidth - cx] : [cx, cy]);
/** screen movement -> virtual movement */
export const dVirt = (dx: number, dy: number): [number, number] => (vp.rot ? [dy, -dx] : [dx, dy]);
updateViewport();
