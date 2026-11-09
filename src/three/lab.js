import * as THREE from 'three';
import { SIM, clamp } from '../../logic.js';
import {
  makeLabelTexture,
  makeClockTexture,
  makeWoodTexture,
  makeSoftCircleTexture,
} from './textures.js';
import { createThermometer } from './thermometer.js';

export const TABLE_Y = 0.84;
export const CUP_X = 0.34;
export const THERMO_Y_IN_CUP = 0.2;

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

function shadowed(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function labelPlane(texture, w, h, { basic = false } = {}) {
  const mat = basic
    ? new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
    : new THREE.MeshStandardMaterial({ map: texture, roughness: 0.65, metalness: 0.02 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

export function createTable() {
  const group = new THREE.Group();
  group.name = 'lab-table';

  const wood = makeWoodTexture();
  const woodMat = new THREE.MeshStandardMaterial({ map: wood, color: 0xd8bd98, roughness: 0.72, metalness: 0.02 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x9b6f48, roughness: 0.8 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3d5665, roughness: 0.34, metalness: 0.8 });

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.09, 1.02), woodMat);
  top.position.y = TABLE_Y - 0.045;
  shadowed(top, true, true);
  group.add(top);

  const edge = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.035, 1.07), darkWood);
  edge.position.y = TABLE_Y - 0.098;
  shadowed(edge, true, false);
  group.add(edge);

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.055, 0.7), darkWood);
  shelf.position.set(0, 0.35, 0);
  shadowed(shelf, true, true);
  group.add(shelf);

  for (const x of [-0.82, 0.82]) {
    for (const z of [-0.38, 0.38]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.76, 12), metal);
      leg.position.set(x, 0.38, z);
      shadowed(leg, true, false);
      group.add(leg);
    }
  }

  // Frosty runner on the table top
  const runner = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.006, 0.56),
    new THREE.MeshPhysicalMaterial({
      color: 0xdff6ff,
      roughness: 0.25,
      metalness: 0,
      transparent: true,
      opacity: 0.34,
      clearcoat: 1,
    }),
  );
  runner.position.set(0, TABLE_Y + 0.004, 0.05);
  runner.receiveShadow = true;
  group.add(runner);

  // Front nameplate
  const plaque = labelPlane(
    makeLabelTexture({
      title: 'POLAR FUR LAB',
      sub: '4LD2 · 動物的適應特徵',
      accent: '#6ee7f9',
      dark: true,
      width: 900,
      height: 180,
    }),
    0.78,
    0.156,
    { basic: true },
  );
  plaque.position.set(0, TABLE_Y - 0.185, 0.56);
  group.add(plaque);

  // Cut-paper texture on the top edge
  const edgeLight = new THREE.Mesh(
    new THREE.BoxGeometry(1.98, 0.008, 1.05),
    new THREE.MeshBasicMaterial({ color: 0xa9d7e8, transparent: true, opacity: 0.16 }),
  );
  edgeLight.position.y = TABLE_Y + 0.001;
  group.add(edgeLight);

  return group;
}

function createSteam() {
  const count = 30;
  const positions = new Float32Array(count * 3);
  const seeds = [];
  const rand = mulberry32(99);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 0.06;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = 0.19 + rand() * 0.18;
    positions[i * 3 + 2] = Math.sin(a) * r;
    seeds.push({ phase: rand() * 10, speed: 0.025 + rand() * 0.05, sway: 0.01 + rand() * 0.03, baseX: positions[i * 3], baseZ: positions[i * 3 + 2] });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: makeSoftCircleTexture(),
    size: 0.045,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: 0xd8f5ff,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;
  return {
    points,
    update(time, tempC, dt) {
      const arr = geo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        const s = seeds[i];
        arr[i * 3 + 1] += s.speed * dt;
        if (arr[i * 3 + 1] > 0.45) {
          arr[i * 3 + 1] = 0.19;
          arr[i * 3] = s.baseX;
          arr[i * 3 + 2] = s.baseZ;
        }
        arr[i * 3] = s.baseX + Math.sin(time * 1.3 + s.phase) * s.sway;
        arr[i * 3 + 2] = s.baseZ + Math.cos(time * 1.1 + s.phase * 0.8) * s.sway * 0.6;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = clamp((tempC - 26) / 22, 0, 1) * 0.34;
    },
  };
}

function createCottonWrap(radius = 0.124, height = 0.25, seed = 7) {
  const group = new THREE.Group();
  const rand = mulberry32(seed);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf8fdff,
    roughness: 0.98,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  // A thin, lumpy cotton jacket rather than a pile of big spheres.
  const shellGeo = new THREE.CylinderGeometry(radius + 0.006, radius + 0.012, height - 0.018, 48, 10, true);
  const pos = shellGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (Math.hypot(x, z) < 0.02) continue;
    const a = Math.atan2(z, x);
    const n = 1 + 0.018 * Math.sin(a * 13 + y * 38) + 0.012 * Math.sin(a * 29 - y * 23 + 1.4);
    pos.setX(i, x * n);
    pos.setZ(i, z * n);
  }
  shellGeo.computeVertexNormals();
  const shell = new THREE.Mesh(shellGeo, mat);
  shell.position.y = height / 2;
  shell.castShadow = true;
  shell.receiveShadow = true;
  group.add(shell);

  // Small surface puffs make the jacket read as cotton, without bulk.
  const puffGeo = new THREE.IcosahedronGeometry(0.016, 1);
  const count = 46;
  const puffs = new THREE.InstancedMesh(puffGeo, mat, count);
  puffs.castShadow = true;
  puffs.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const yy = 0.025 + rand() * (height - 0.05);
    const r = radius + 0.01 + rand() * 0.012;
    dummy.position.set(Math.cos(a) * r, yy, Math.sin(a) * r);
    dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    const sc = 0.55 + rand() * 0.75;
    dummy.scale.set(sc, sc * (0.75 + rand() * 0.2), sc);
    dummy.updateMatrix();
    puffs.setMatrixAt(i, dummy.matrix);
  }
  puffs.instanceMatrix.needsUpdate = true;
  group.add(puffs);

  // A soft rolled edge at the top opening.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const puff = new THREE.Mesh(puffGeo, mat);
    puff.position.set(Math.cos(a) * (radius + 0.006), height - 0.012, Math.sin(a) * (radius + 0.006));
    puff.scale.setScalar(0.55 + rand() * 0.35);
    puff.castShadow = true;
    group.add(puff);
  }

  const twine = new THREE.Mesh(
    new THREE.TorusGeometry(radius + 0.013, 0.0025, 6, 40),
    new THREE.MeshStandardMaterial({ color: 0x8a6743, roughness: 0.9 }),
  );
  twine.rotation.x = Math.PI / 2;
  twine.position.y = height * 0.72;
  group.add(twine);

  return group;
}

export function createCup({ insulated = false, x = 0, z = 0 } = {}) {
  const group = new THREE.Group();
  group.position.set(x, TABLE_Y, z);
  group.name = insulated ? 'cotton-cup' : 'control-cup';

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd9f7ff,
    transparent: true,
    opacity: 0.14,
    roughness: 0.04,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: insulated ? 0x4fc8dd : 0x47b8f2,
    transparent: true,
    opacity: 0.55,
    roughness: 0.12,
    metalness: 0,
    emissive: insulated ? 0x0b5560 : 0x0a4770,
    emissiveIntensity: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    depthWrite: false,
  });

  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.105, 0.27, 36, 1, true), glassMat);
  glass.position.y = 0.135;
  glass.renderOrder = 2;
  group.add(glass);

  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.012, 36), glassMat);
  bottom.position.y = 0.006;
  bottom.renderOrder = 2;
  group.add(bottom);

  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.1, 0.17, 36), waterMat);
  water.position.y = 0.085;
  water.renderOrder = 1;
  group.add(water);

  const surface = new THREE.Mesh(
    new THREE.CircleGeometry(0.107, 36),
    new THREE.MeshPhysicalMaterial({
      color: 0x9ee9ff,
      transparent: true,
      opacity: 0.38,
      roughness: 0.05,
      metalness: 0,
      clearcoat: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = 0.171;
  surface.renderOrder = 3;
  group.add(surface);

  // Thermometer, bulb under the water surface. No front clamp: the old
  // bracket crossed the scale and blocked the reading.
  const thermo = createThermometer();
  thermo.position.set(0, THERMO_Y_IN_CUP, 0);
  group.add(thermo);

  if (insulated) {
    const wrap = createCottonWrap(0.124, 0.25, 71);
    wrap.position.y = 0.01;
    group.add(wrap);
  }

  const steam = createSteam();
  steam.points.position.y = 0;
  group.add(steam.points);

  // Tent card
  const card = new THREE.Group();
  const label = labelPlane(
    makeLabelTexture({
      title: insulated ? '棉花（皮毛模型）' : '清水（對照）',
      sub: insulated ? 'COTTON · FUR MODEL' : 'WATER · CONTROL',
      accent: insulated ? '#f3a712' : '#22b8d6',
      width: 760,
      height: 230,
    }),
    0.34,
    0.103,
    { basic: true },
  );
  label.position.y = 0.055;
  card.add(label);
  const cardBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.12, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x0a2133, roughness: 0.6 }),
  );
  cardBack.position.set(0, 0.055, -0.008);
  card.add(cardBack);
  card.position.set(0, 0.012, 0.31);
  card.rotation.x = -0.16;
  group.add(card);

  group.userData.thermometer = thermo;
  group.userData.water = water;
  group.userData.steam = steam;
  group.userData.setTemp = (t) => {
    thermo.userData.setTemp(t);
    const cool = clamp((t - SIM.roomTempC) / (SIM.startTempC - SIM.roomTempC), 0, 1);
    waterMat.color.setHSL(insulated ? 0.52 : 0.55, 0.62, 0.42 + cool * 0.16);
    waterMat.emissiveIntensity = 0.12 + cool * 0.22;
  };
  group.userData.setActive = (active) => thermo.userData.setActive(active);
  group.userData.setTemp(SIM.startTempC);
  return group;
}

export function createStopwatch() {
  const group = new THREE.Group();
  group.position.set(0, TABLE_Y + 0.02, -0.34);
  group.rotation.x = -0.12;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.27, 0.17, 0.055),
    new THREE.MeshStandardMaterial({ color: 0x0a1c29, roughness: 0.4, metalness: 0.55 }),
  );
  body.position.y = 0.09;
  shadowed(body, true, false);
  group.add(body);

  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(0.29, 0.19, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x385767, roughness: 0.3, metalness: 0.8 }),
  );
  bezel.position.set(0, 0.09, -0.008);
  group.add(bezel);

  const clock = makeClockTexture();
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.245, 0.14),
    new THREE.MeshBasicMaterial({ map: clock.texture, toneMapped: false }),
  );
  face.position.set(0, 0.09, 0.034);
  group.add(face);

  const cueRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.004, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0x5fe3a1, transparent: true, opacity: 0 }),
  );
  cueRing.rotation.x = Math.PI / 2;
  cueRing.position.y = 0.09;
  group.add(cueRing);

  const stand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.075, 0.035, 16),
    new THREE.MeshStandardMaterial({ color: 0x3d5665, metalness: 0.7, roughness: 0.35 }),
  );
  stand.position.y = 0.017;
  group.add(stand);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.06, 10),
    new THREE.MeshStandardMaterial({ color: 0x3d5665, metalness: 0.7, roughness: 0.35 }),
  );
  stem.position.y = 0.045;
  group.add(stem);

  group.userData.clock = clock;
  group.userData.setCue = (state) => {
    // state: 'idle' | 'near' | 'ready'
    if (state === 'ready') {
      cueRing.material.color.set(0x5fe3a1);
      cueRing.material.opacity = 0.85;
    } else if (state === 'near') {
      cueRing.material.color.set(0xffc95c);
      cueRing.material.opacity = 0.6;
    } else {
      cueRing.material.opacity = 0;
    }
  };
  return group;
}

export function createTrainingStand() {
  const group = new THREE.Group();
  group.position.set(0, TABLE_Y, 0.06);
  group.name = 'training-stand';

  const metal = new THREE.MeshStandardMaterial({ color: 0x486373, roughness: 0.36, metalness: 0.75 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.045, 24), metal);
  base.position.y = 0.023;
  shadowed(base, true, true);
  group.add(base);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.52, 14), metal);
  pole.position.set(0, 0.3, -0.04);
  shadowed(pole, true, false);
  group.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.022, 0.13), metal);
  arm.position.set(0, 0.31, -0.01);
  group.add(arm);

  const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.005, 8, 24), metal);
  clamp.rotation.x = Math.PI / 2;
  clamp.position.set(0, 0.31, 0.02);
  group.add(clamp);

  const thermo = createThermometer();
  thermo.position.set(0, 0.31, 0.02);
  group.add(thermo);

  const plate = labelPlane(
    makeLabelTexture({
      title: 'EYE-LEVEL PRACTICE',
      sub: '眼睛要與液面水平',
      accent: '#6ee7f9',
      width: 760,
      height: 170,
    }),
    0.34,
    0.076,
    { basic: true },
  );
  plate.position.set(0, 0.095, 0.19);
  plate.rotation.x = -0.25;
  group.add(plate);

  group.userData.thermometer = thermo;
  group.userData.setTemp = (t) => thermo.userData.setTemp(t);
  group.userData.setActive = (v) => thermo.userData.setActive(v);
  return group;
}

export function createLantern() {
  const group = new THREE.Group();
  group.position.set(0.88, TABLE_Y, -0.12);

  const metal = new THREE.MeshStandardMaterial({ color: 0x3b4a51, roughness: 0.45, metalness: 0.65 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.03, 16), metal);
  base.position.y = 0.015;
  group.add(base);

  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.2, 20, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: 0xffd6a3,
      transparent: true,
      opacity: 0.42,
      emissive: 0xff9a4a,
      emissiveIntensity: 1.4,
      roughness: 0.2,
      side: THREE.DoubleSide,
    }),
  );
  glass.position.y = 0.14;
  group.add(glass);

  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.045, 16), metal);
  top.position.y = 0.265;
  group.add(top);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.005, 8, 24, Math.PI), metal);
  handle.position.y = 0.3;
  group.add(handle);

  const light = new THREE.PointLight(0xffa85a, 2.2, 3.4, 2);
  light.position.set(0, 0.16, 0);
  light.castShadow = false;
  group.add(light);

  return group;
}

export function createSignpost() {
  const group = new THREE.Group();
  group.position.set(2.55, 0, -0.6);
  group.rotation.y = -0.35;

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.055, 1.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x7b593c, roughness: 0.9 }),
  );
  post.position.y = 0.6;
  post.castShadow = true;
  group.add(post);

  const board = labelPlane(
    makeLabelTexture({
      title: '−30 °C',
      sub: 'ARCTIC FIELD LAB',
      accent: '#6ee7f9',
      dark: true,
      width: 620,
      height: 220,
    }),
    0.7,
    0.25,
    { basic: true },
  );
  board.position.set(0, 1.02, 0.03);
  group.add(board);

  return group;
}

export function createCrate() {
  const group = new THREE.Group();
  group.position.set(-1.15, 0, 0.35);
  const mat = new THREE.MeshStandardMaterial({ color: 0x9c724a, roughness: 0.85 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.4), mat);
  box.position.y = 0.18;
  shadowed(box, true, true);
  group.add(box);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.045, 0.43), new THREE.MeshStandardMaterial({ color: 0x7a5637, roughness: 0.9 }));
  lid.position.y = 0.365;
  group.add(lid);
  return group;
}
