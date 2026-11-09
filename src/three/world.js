import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SIM, clamp, clockFromMinutes } from '../../logic.js';
import { createSky, createMountains, createIceFloe, createSnowfall } from './environment.js';
import {
  TABLE_Y,
  createTable,
  createCup,
  createStopwatch,
  createTrainingStand,
  createLantern,
  createSignpost,
  createCrate,
} from './lab.js';
import { loadPolarBear } from './polarbear.js';
import { thermometerMeniscusLocalY } from './thermometer.js';

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.home = { pos: new THREE.Vector3(0.9, 2.9, 6.25), target: new THREE.Vector3(0.55, 1.02, 0) };
    this.pos = this.home.pos.clone();
    this.target = this.home.target.clone();
    this.fromPos = this.pos.clone();
    this.fromTarget = this.target.clone();
    this.tween = 1;
    this.duration = 1;
    this.drift = true;
    this.eye = null;
    this.elevation = 0;
    this.base = null;
  }

  moveTo(pos, target, duration = 1.1) {
    this.eye = null;
    this.drift = false;
    this.fromPos.copy(this.camera.position);
    this.fromTarget.copy(this.target);
    this.pos.copy(pos);
    this.target.copy(target);
    this.tween = 0;
    this.duration = Math.max(0.001, duration);
    this.base = { pos: pos.clone(), target: target.clone() };
  }

  focusEye({ target, radius, elevation = 0, duration = 0.9 }) {
    this.eye = { target: target.clone(), radius };
    this.elevation = elevation;
    this.drift = false;
    const pos = this.eyePos(elevation);
    this.fromPos.copy(this.camera.position);
    this.fromTarget.copy(this.target);
    this.pos.copy(pos);
    this.target.copy(target);
    this.tween = 0;
    this.duration = Math.max(0.001, duration);
    this.base = { pos: pos.clone(), target: target.clone() };
  }

  eyePos(elevationDeg) {
    const rad = (elevationDeg * Math.PI) / 180;
    return new THREE.Vector3(
      this.eye.target.x,
      this.eye.target.y + Math.sin(rad) * this.eye.radius,
      this.eye.target.z + Math.cos(rad) * this.eye.radius,
    );
  }

  setElevation(elevationDeg, immediate = true) {
    if (!this.eye) return;
    this.elevation = elevationDeg;
    const pos = this.eyePos(elevationDeg);
    if (immediate) {
      this.tween = 1;
      this.pos.copy(pos);
      this.fromPos.copy(pos);
      this.camera.position.copy(pos);
      this.camera.lookAt(this.eye.target);
      this.base = { pos: pos.clone(), target: this.eye.target.clone() };
    } else {
      this.fromPos.copy(this.camera.position);
      this.fromTarget.copy(this.target);
      this.pos.copy(pos);
      this.target.copy(this.eye.target);
      this.tween = 0;
      this.duration = 0.22;
    }
  }

  wide(duration = 1.2) {
    this.eye = null;
    this.drift = true;
    const portrait = this.camera.aspect < 0.95;
    const pos = portrait
      ? new THREE.Vector3(0.4, 2.2, 4.7)
      : new THREE.Vector3(0.55, 1.88, 2.9);
    const target = portrait
      ? new THREE.Vector3(0.4, 1.12, 0.02)
      : new THREE.Vector3(0.55, 1.12, 0.02);
    this.moveTo(pos, target, duration);
    this.base = { pos: pos.clone(), target: target.clone() };
  }

  analysis(duration = 1.3) {
    this.eye = null;
    this.drift = true;
    this.moveTo(new THREE.Vector3(1.55, 1.92, 2.9), new THREE.Vector3(0.3, 1.15, 0), duration);
    this.base = { pos: new THREE.Vector3(1.55, 1.92, 2.9), target: new THREE.Vector3(0.3, 1.15, 0) };
  }

  update(dt, time) {
    if (this.tween < 1) {
      this.tween = Math.min(1, this.tween + dt / this.duration);
      const e = easeInOut(this.tween);
      this.camera.position.lerpVectors(this.fromPos, this.pos, e);
      const look = new THREE.Vector3().lerpVectors(this.fromTarget, this.target, e);
      this.camera.lookAt(look);
    } else if (this.eye) {
      this.camera.lookAt(this.eye.target);
    } else if (this.drift && this.base) {
      const p = this.base.pos;
      this.camera.position.set(
        p.x + Math.sin(time * 0.11) * 0.1,
        p.y + Math.sin(time * 0.17) * 0.022,
        p.z + Math.cos(time * 0.09) * 0.05,
      );
      this.camera.lookAt(this.base.target);
    }
  }
}

function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 1200 ? 1.5 : 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x04131f, 1);
  return renderer;
}

export async function createWorld({ canvas, onProgress = () => {} } = {}) {
  onProgress(6, '正在建立北極光…');
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x061a2b, 0.022);
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.03, 140);

  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    const envScene = new RoomEnvironment();
    const envRT = pmrem.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.32;
    envScene.dispose?.();
  } catch (e) {
    console.warn('environment map unavailable', e);
  }
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xbfeaff, 0x0a2233, 1.05);
  scene.add(hemi);
  const moonLight = new THREE.DirectionalLight(0xd8f2ff, 2.7);
  moonLight.position.set(-5.5, 9.5, 5.5);
  moonLight.castShadow = true;
  const shadowSize = window.innerWidth < 1200 ? 1024 : 2048;
  moonLight.shadow.mapSize.set(shadowSize, shadowSize);
  moonLight.shadow.camera.left = -6;
  moonLight.shadow.camera.right = 6;
  moonLight.shadow.camera.top = 6;
  moonLight.shadow.camera.bottom = -6;
  moonLight.shadow.camera.near = 0.5;
  moonLight.shadow.camera.far = 28;
  moonLight.shadow.bias = -0.0004;
  scene.add(moonLight);
  const rimLight = new THREE.PointLight(0x6ee7f9, 2.2, 9, 2);
  rimLight.position.set(-3.5, 3.2, -3.8);
  scene.add(rimLight);
  const fill = new THREE.DirectionalLight(0x8fbcd6, 0.55);
  fill.position.set(4, 3, 4);
  scene.add(fill);

  onProgress(18, '正在鋪設冰原…');
  const sky = createSky();
  scene.add(sky.group);
  scene.add(createMountains());
  scene.add(createIceFloe());
  const snowfall = createSnowfall();
  scene.add(snowfall.points);

  onProgress(34, '正在佈置實驗桌…');
  scene.add(createTable());
  const lantern = createLantern();
  scene.add(lantern);
  const crate = createCrate();
  scene.add(crate);
  const signpost = createSignpost();
  signpost.position.set(-2.55, 0, -0.55);
  signpost.rotation.y = 0.35;
  scene.add(signpost);

  const cupsGroup = new THREE.Group();
  const controlCup = createCup({ insulated: false, x: -0.34, z: 0 });
  const cottonCup = createCup({ insulated: true, x: 0.34, z: 0 });
  cupsGroup.add(controlCup, cottonCup);
  scene.add(cupsGroup);

  const stopwatch = createStopwatch();
  scene.add(stopwatch);

  const trainingStand = createTrainingStand();
  trainingStand.visible = false;
  scene.add(trainingStand);

  // A soft green light that pulses when it is time to measure.
  const cueLight = new THREE.PointLight(0x5fe3a1, 0, 4.2, 2);
  cueLight.position.set(0, 1.55, 0.35);
  scene.add(cueLight);

  let bear = null;
  onProgress(54, '正在呼喚北極熊…');
  try {
    bear = await loadPolarBear();
    scene.add(bear.group);
  } catch (err) {
    console.warn('polar bear model failed to load', err);
  }

  const rig = new CameraRig(camera);
  rig.moveTo(rig.home.pos, rig.home.target, 0.01);
  rig.tween = 0;
  rig.duration = 2.4;

  const state = {
    stage: 'home',
    temps: { control: SIM.startTempC, cotton: SIM.startTempC, training: SIM.startTempC },
    activeCup: 'control',
    cue: 'idle',
    clockText: '',
  };

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 1200 ? 1.5 : 1.8));
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', resize);

  const setCupTemp = (cup, temp) => {
    state.temps[cup] = temp;
    const group = cup === 'control' ? controlCup : cottonCup;
    group.userData.setTemp(temp);
  };

  const cupPoint = (cup) => {
    const x = cup === 'control' ? -0.34 : 0.34;
    const temp = state.temps[cup];
    return new THREE.Vector3(x, TABLE_Y + 0.2 + thermometerMeniscusLocalY(temp), 0.01);
  };
  const trainingPoint = () => {
    const temp = state.temps.training;
    return new THREE.Vector3(0, TABLE_Y + 0.31 + thermometerMeniscusLocalY(temp), 0.08);
  };

  const world = {
    scene,
    camera,
    renderer,
    rig,
    get temperature() {
      return { ...state.temps };
    },
    setStage(stage, { instant = false } = {}) {
      state.stage = stage;
      if (stage === 'training') {
        trainingStand.visible = true;
        cupsGroup.visible = false;
        stopwatch.visible = false;
        lantern.visible = true;
      } else {
        trainingStand.visible = false;
        cupsGroup.visible = true;
        stopwatch.visible = stage !== 'home';
        lantern.visible = true;
      }
      if (stage !== 'experiment') {
        stopwatch.userData.setCue('idle');
        cueLight.intensity = 0;
      }
      if (stage === 'home' || stage === 'login') {
        rig.drift = true;
        rig.moveTo(new THREE.Vector3(0.9, 2.9, 6.25), new THREE.Vector3(0.55, 1.02, 0), instant ? 0.01 : 1.6);
      } else if (stage === 'experiment') {
        rig.wide(instant ? 0.01 : 1.1);
      } else if (stage === 'analysis') {
        rig.analysis(instant ? 0.01 : 1.2);
      } else if (stage === 'training') {
        rig.focusEye({ target: trainingPoint(), radius: 0.62, elevation: 0, duration: instant ? 0.01 : 1 });
      }
      if (instant) rig.tween = 1;
    },
    setTrainingTemp(temp) {
      state.temps.training = temp;
      trainingStand.userData.setTemp(temp);
    },
    setCupTemps(controlTemp, cottonTemp) {
      setCupTemp('control', controlTemp);
      setCupTemp('cotton', cottonTemp);
    },
    setActiveCup(cup) {
      state.activeCup = cup;
      controlCup.userData.setActive(cup === 'control');
      cottonCup.userData.setActive(cup === 'cotton');
    },
    focusCup(cup, elevation = 0, duration = 0.85) {
      world.setActiveCup(cup);
      rig.focusEye({ target: cupPoint(cup), radius: 0.52, elevation, duration });
    },
    focusTraining(elevation = 0, duration = 0.8) {
      rig.focusEye({ target: trainingPoint(), radius: 0.62, elevation, duration });
    },
    setElevation(deg) {
      rig.setElevation(deg, true);
    },
    getElevation() {
      return rig.elevation;
    },
    leaveEye() {
      if (state.stage === 'experiment') rig.wide(1);
      else if (state.stage === 'training') rig.focusEye({ target: trainingPoint(), radius: 0.62, elevation: 0, duration: 0.8 });
    },
    setCue(cue) {
      state.cue = cue;
      stopwatch.userData.setCue(cue);
      if (cue === 'ready') cueLight.color.set(0x5fe3a1);
      else if (cue === 'near') cueLight.color.set(0xffc95c);
      cueLight.intensity = cue === 'ready' ? 2.2 : cue === 'near' ? 0.9 : 0;
    },
    setClock(minutes, nextLabel = '') {
      const time = clockFromMinutes(minutes);
      const key = `${time}|${nextLabel}|${state.cue}`;
      if (key === state.clockText) return;
      state.clockText = key;
      stopwatch.userData.clock.draw({
        time,
        label: 'MIN : SEC',
        next: nextLabel,
        tone: state.cue === 'ready' ? '#5fe3a1' : state.cue === 'near' ? '#ffc95c' : '#6ee7f9',
      });
    },
    setBearVisible(visible) {
      if (bear) bear.group.visible = visible;
    },
    pulseMeasure() {
      // quick ring flash around the stopwatch
      const ring = stopwatch.children.find((c) => c.geometry?.type === 'TorusGeometry' && c.material?.transparent);
      if (!ring) return;
      ring.material.opacity = 0.95;
      ring.scale.setScalar(1);
      const start = performance.now();
      const animate = (now) => {
        const t = Math.min(1, (now - start) / 700);
        ring.scale.setScalar(1 + t * 0.55);
        ring.material.opacity = 0.95 * (1 - t);
        if (t < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };

  let lastFrame = performance.now();
  let elapsed = 0;

  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    elapsed += dt;
    sky.update(elapsed);
    snowfall.update(elapsed, dt);
    if (bear) bear.update(elapsed);
    controlCup.userData.steam.update(elapsed, state.temps.control, dt);
    cottonCup.userData.steam.update(elapsed, state.temps.cotton, dt);
    if (state.cue === 'ready') {
      cueLight.intensity = 1.6 + Math.sin(elapsed * 4) * 0.5;
    }
    lantern.children.find((c) => c.isPointLight).intensity = 2.0 + Math.sin(elapsed * 2.2) * 0.2;
    rig.update(dt, elapsed);
    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(loop);

  onProgress(86, '正在校正溫度計…');
  // Warm up one frame so screenshots and the first paint are complete.
  controlCup.userData.setTemp(SIM.startTempC);
  cottonCup.userData.setTemp(SIM.startTempC);
  trainingStand.userData.setTemp(SIM.startTempC);
  world.setClock(0, '');
  renderer.render(scene, camera);
  onProgress(100, '準備好！');

  return world;
}
