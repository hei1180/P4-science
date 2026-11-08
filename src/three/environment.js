import * as THREE from 'three';
import { makeSnowTexture, makeSoftCircleTexture } from './textures.js';

const SKY_VERT = `
  varying vec3 vWorld;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const SKY_FRAG = `
  varying vec3 vWorld;
  void main(){
    float h = normalize(vWorld).y;
    vec3 bottom = vec3(0.012, 0.055, 0.085);
    vec3 horizon = vec3(0.035, 0.16, 0.24);
    vec3 top = vec3(0.005, 0.018, 0.045);
    vec3 col = mix(horizon, top, smoothstep(0.0, 0.72, h));
    col = mix(bottom, col, smoothstep(-0.25, 0.06, h));
    // subtle teal glow near the horizon
    col += vec3(0.01, 0.06, 0.075) * pow(max(0.0, 1.0 - abs(h) * 3.2), 3.0);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const AURORA_VERT = `
  varying vec2 vUv;
  void main(){
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const AURORA_FRAG = `
  uniform float uTime;
  uniform float uPhase;
  varying vec2 vUv;
  void main(){
    float x = vUv.x;
    float y = vUv.y;
    float b1 = sin(x * 7.0 + uTime * 0.18 + uPhase + sin(x * 3.2 + uPhase) * 1.1) * 0.5 + 0.5;
    float b2 = sin(x * 13.0 - uTime * 0.14 + uPhase * 1.7) * 0.5 + 0.5;
    float curtain = pow(b1 * 0.7 + b2 * 0.3, 2.2);
    float vertical = smoothstep(0.0, 0.32, y) * smoothstep(1.0, 0.34, y);
    float streak = 0.55 + 0.45 * sin(y * 54.0 + uTime * 0.65 + x * 9.0 + uPhase);
    vec3 col = mix(vec3(0.12, 0.95, 0.70), vec3(0.42, 0.52, 1.0), y);
    col = mix(col, vec3(0.65, 0.35, 0.95), smoothstep(0.7, 1.0, y) * 0.35);
    float alpha = curtain * vertical * (0.14 + 0.20 * streak);
    gl_FragColor = vec4(col, alpha);
  }
`;

export function createSky() {
  const group = new THREE.Group();
  group.name = 'arctic-sky';

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(48, 40, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
    }),
  );
  group.add(sky);

  // Stars
  const starCount = 1000;
  const starPos = new Float32Array(starCount * 3);
  const rand = mulberry32(17);
  for (let i = 0; i < starCount; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(rand() * 0.92 + 0.04);
    const r = 42;
    starPos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    starPos[i * 3 + 1] = Math.cos(phi) * r;
    starPos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      map: makeSoftCircleTexture(),
      size: 0.14,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      color: 0xdff4ff,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }),
  );
  stars.frustumCulled = false;
  group.add(stars);

  // Moon + glow
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 48),
    new THREE.MeshBasicMaterial({ color: 0xe8f8ff, toneMapped: false }),
  );
  moon.position.set(-10, 12.5, -27);
  group.add(moon);
  const moonHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeSoftCircleTexture('rgba(190,238,255,0.85)', 'rgba(120,200,255,0)'),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  moonHalo.position.copy(moon.position);
  moonHalo.scale.set(7.5, 7.5, 1);
  group.add(moonHalo);

  // Aurora curtains
  const auroras = [];
  const auroraSpecs = [
    { x: -7, y: 9.5, z: -23, w: 30, h: 10, phase: 0.2, rot: 0.12 },
    { x: 5, y: 11.5, z: -26, w: 36, h: 12, phase: 2.4, rot: -0.08 },
    { x: 0, y: 7.5, z: -20, w: 24, h: 8, phase: 4.9, rot: 0.03 },
  ];
  for (const spec of auroraSpecs) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPhase: { value: spec.phase } },
      vertexShader: AURORA_VERT,
      fragmentShader: AURORA_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), mat);
    mesh.position.set(spec.x, spec.y, spec.z);
    mesh.rotation.z = spec.rot;
    group.add(mesh);
    auroras.push(mat);
  }

  return {
    group,
    update(time) {
      for (const mat of auroras) mat.uniforms.uTime.value = time;
    },
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createMountains() {
  const group = new THREE.Group();
  const rand = mulberry32(5);
  const dark = new THREE.Color(0x14384d);
  const snow = new THREE.Color(0xdff4ff);
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2 + rand() * 0.2;
    const radius = 16 + rand() * 12;
    const h = 4 + rand() * 7;
    const r = 2.4 + rand() * 3.4;
    const geo = new THREE.ConeGeometry(r, h, 7, 3);
    geo.translate(0, h / 2, 0);
    const pos = geo.attributes.position;
    const colors = [];
    const c = new THREE.Color();
    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v) / h;
      const t = Math.max(0, Math.min(1, (y - 0.42) / 0.48));
      c.copy(dark).lerp(snow, t * t);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    mesh.rotation.y = rand() * Math.PI;
    group.add(mesh);
  }
  return group;
}

export function createIceFloe() {
  const group = new THREE.Group();
  group.name = 'ice-floe';

  const geo = new THREE.CylinderGeometry(6.8, 7.15, 0.55, 72, 1, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > 1) {
      const a = Math.atan2(z, x);
      const n = 1 + 0.055 * Math.sin(a * 5 + 1.3) + 0.028 * Math.sin(a * 11 + 0.4);
      pos.setX(i, x * n);
      pos.setZ(i, z * n);
    }
  }
  geo.computeVertexNormals();

  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0x8fc6de,
    roughness: 0.36,
    metalness: 0.02,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
  });
  const snowMat = new THREE.MeshStandardMaterial({
    map: makeSnowTexture(),
    color: 0xf0fbff,
    roughness: 0.94,
    metalness: 0,
  });
  const floe = new THREE.Mesh(geo, [iceMat, snowMat, iceMat]);
  floe.position.y = -0.275;
  floe.receiveShadow = true;
  group.add(floe);

  // Snow mounds
  const rand = mulberry32(31);
  for (let i = 0; i < 16; i++) {
    const a = rand() * Math.PI * 2;
    const r = 2.2 + rand() * 4.2;
    const mound = new THREE.Mesh(
      new THREE.SphereGeometry(0.35 + rand() * 0.7, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xeaf9ff, roughness: 0.95 }),
    );
    mound.position.set(Math.cos(a) * r, 0.01, Math.sin(a) * r);
    mound.scale.y = 0.18 + rand() * 0.13;
    mound.receiveShadow = true;
    group.add(mound);
  }

  // Cracks
  const crackPositions = [];
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const r0 = 1.5 + rand() * 2;
    let x = Math.cos(a) * r0;
    let z = Math.sin(a) * r0;
    let y = 0.004;
    for (let j = 0; j < 4; j++) {
      const nx = x + (rand() - 0.5) * 0.8;
      const nz = z + (rand() - 0.5) * 0.8;
      crackPositions.push(x, y, z, nx, y, nz);
      x = nx;
      z = nz;
      y = 0.004;
    }
  }
  const crackGeo = new THREE.BufferGeometry();
  crackGeo.setAttribute('position', new THREE.Float32BufferAttribute(crackPositions, 3));
  const cracks = new THREE.LineSegments(
    crackGeo,
    new THREE.LineBasicMaterial({ color: 0x7fb7cf, transparent: true, opacity: 0.35 }),
  );
  group.add(cracks);

  // Paw prints
  const pawMat = new THREE.MeshBasicMaterial({ color: 0x9fc8d9, transparent: true, opacity: 0.38 });
  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? 0.11 : -0.11;
    const paw = new THREE.Mesh(new THREE.CircleGeometry(0.055, 12), pawMat);
    paw.rotation.x = -Math.PI / 2;
    paw.position.set(2.0 - i * 0.28, 0.006, 0.5 + side * 1.8 + i * 0.1);
    group.add(paw);
  }

  // Rocks
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const r = 3.2 + rand() * 3;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.22 + rand() * 0.45, 0),
      new THREE.MeshStandardMaterial({ color: 0x315264, roughness: 0.88, flatShading: true }),
    );
    rock.position.set(Math.cos(a) * r, 0.06, Math.sin(a) * r);
    rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    rock.castShadow = true;
    group.add(rock);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.22 + rand() * 0.3, 10, 6),
      new THREE.MeshStandardMaterial({ color: 0xeaf9ff, roughness: 0.95 }),
    );
    cap.position.copy(rock.position);
    cap.position.y += rock.geometry.parameters.radius * 0.7;
    cap.scale.y = 0.35;
    group.add(cap);
  }

  return group;
}

export function createSnowfall() {
  const count = 1100;
  const positions = new Float32Array(count * 3);
  const seeds = [];
  const rand = mulberry32(44);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (rand() - 0.5) * 26;
    positions[i * 3 + 1] = rand() * 14;
    positions[i * 3 + 2] = (rand() - 0.5) * 22;
    seeds.push({ speed: 0.25 + rand() * 0.55, sway: 0.1 + rand() * 0.35, phase: rand() * 10 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: makeSoftCircleTexture(),
    size: 0.085,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    color: 0xffffff,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    update(time, dt) {
      const arr = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        const s = seeds[i];
        arr[i * 3 + 1] -= s.speed * dt;
        arr[i * 3] += Math.sin(time * 0.4 + s.phase) * s.sway * dt * 0.25;
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3 + 1] = 14;
          arr[i * 3] = (rand() - 0.5) * 26;
          arr[i * 3 + 2] = (rand() - 0.5) * 22;
        }
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
