import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ChromaticAberrationEffect, VignetteEffect, ToneMappingEffect, ToneMappingMode,
} from 'postprocessing';

/** WebGLRenderer + pmndrs post-processing: bloom on HDR emissives, speed-scaled chromatic aberration, vignette, ACES tone mapping. */
export class GameRenderer {
  readonly gl: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private chroma: ChromaticAberrationEffect;
  private bloom: BloomEffect;
  private vignette: VignetteEffect;
  private tone: ToneMappingEffect;
  private bloomPass: EffectPass;
  /** post-processing on/off (the adaptive-quality code turns it off on slow devices) */
  fx = true;
  private pixelRatio = 1;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, phone: boolean) {
    this.gl = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    const gl = this.gl;
    gl.toneMapping = THREE.ACESFilmicToneMapping; // used when post-processing is bypassed
    gl.toneMappingExposure = 1.2;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    gl.setSize(innerWidth, innerHeight);
    document.body.appendChild(gl.domElement);

    this.composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: phone ? 0 : 4 });
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new BloomEffect({ luminanceThreshold: 1.0, luminanceSmoothing: 0.15, intensity: 1.8, mipmapBlur: true });
    this.bloomPass = new EffectPass(camera, this.bloom);
    this.chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0004, 0.0004), radialModulation: true, modulationOffset: 0.2 });
    this.vignette = new VignetteEffect({ darkness: 0.5, offset: 0.3 });
    this.tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new EffectPass(camera, this.chroma, this.vignette, this.tone));
  }

  get domElement() { return this.gl.domElement; }

  setPixelRatio(r: number) { this.pixelRatio = r; this.gl.setPixelRatio(r); }
  setSize(w: number, h: number) { this.gl.setPixelRatio(this.pixelRatio); this.composer.setSize(w, h); }
  setBloom(on: boolean) { this.bloomPass.enabled = on; }

  /** speed01: 0 idle .. 1 top speed. boost adds extra aberration (hard braking, impacts). */
  render(dt: number, scene: THREE.Scene, camera: THREE.Camera, speed01 = 0, boost = 0) {
    if (!this.fx) { this.gl.render(scene, camera); return; }
    const a = 0.0004 + speed01 * 0.0014 + boost * 0.002;
    this.chroma.offset.set(a, a);
    this.composer.render(dt);
  }
}
