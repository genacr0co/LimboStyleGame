// Пост-обработка в одном проходе: обесцвечивание, контраст, виньетка, зерно плёнки, мерцание, затемнение.
import * as THREE from 'three';

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    this.rt = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: true });
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.rt.texture }, uTime: { value: 0 }, uFade: { value: 1 }, uAspect: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime, uFade, uAspect; varying vec2 vUv;
        float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          vec2 uv = vUv;
          vec3 c = texture2D(tDiffuse, uv).rgb;
          // лёгкое «дыхание» резкости по краям
          vec2 d = uv - 0.5;
          vec3 b = (texture2D(tDiffuse, uv + d * 0.012).rgb + texture2D(tDiffuse, uv - d * 0.012).rgb) * 0.5;
          float edge = smoothstep(0.15, 0.6, length(d));
          c = mix(c, b, edge * 0.8);
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, 0.18);
          c = smoothstep(0.015, 0.92, c);
          d.x *= uAspect;
          float v = smoothstep(1.15, 0.3, length(d));
          c *= mix(0.22, 1.0, v);
          float g = rnd(floor(uv * vec2(900.0 * uAspect, 900.0)) + fract(uTime * 13.37)) - 0.5;
          c += g * 0.075;
          c *= 0.975 + 0.025 * sin(uTime * 31.0) * sin(uTime * 7.3);
          c *= 1.0 - uFade;
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
  }
  setSize(w, h) { this.rt.setSize(w, h); this.mat.uniforms.uAspect.value = w / h; }
  render(scene, camera, time, fade) {
    const r = this.renderer;
    this.mat.uniforms.uTime.value = time;
    this.mat.uniforms.uFade.value = fade;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
  }
}
