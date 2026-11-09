import * as THREE from 'three';
import { SIM } from '../../logic.js';
import { makeScaleTexture } from './textures.js';

const RANGE = SIM.thermometerMax - SIM.thermometerMin;
const USABLE = 1940 / 2048; // texture padding in makeScaleTexture
const SCALE_H = RANGE * SIM.scaleMetersPerDegree;
const PLANE_H = SCALE_H / USABLE;
const PLANE_Y = SCALE_H / 2;

let scaleTexture = null;
function getScaleTexture() {
  if (!scaleTexture) scaleTexture = makeScaleTexture(SIM.thermometerMin, SIM.thermometerMax);
  return scaleTexture;
}

/**
 * A large demonstration thermometer.
 * Local y = 0 is the 20 °C mark; y = 0.351 is the 50 °C mark.
 * The printed scale sits behind the column so the parallax model is visible.
 */
export function createThermometer({ scale = 1 } = {}) {
  const group = new THREE.Group();
  group.name = 'thermometer';

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9f2ff,
    transparent: true,
    opacity: 0.09,
    roughness: 0.04,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const columnMat = new THREE.MeshStandardMaterial({
    color: 0xff4b55,
    emissive: 0xff2638,
    emissiveIntensity: 0.55,
    roughness: 0.3,
    metalness: 0,
  });

  // Printed scale backing
  const scaleMat = new THREE.MeshBasicMaterial({ map: getScaleTexture(), toneMapped: false });
  const scalePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.118, PLANE_H), scaleMat);
  scalePlane.position.set(0, PLANE_Y, -0.034);
  scalePlane.name = 'scale';
  group.add(scalePlane);

  // Thin frame around the printed scale
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x5f8ba3, roughness: 0.45, metalness: 0.55 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.126, PLANE_H + 0.01, 0.006), frameMat);
  frame.position.set(0, PLANE_Y, -0.038);
  group.add(frame);

  // Glass tube
  const tubeH = 0.41;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, tubeH, 24, 1, true), glassMat);
  tube.position.y = SCALE_H / 2 + 0.005;
  group.add(tube);
  const topCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.019, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    glassMat,
  );
  topCap.position.y = SCALE_H + 0.005 + tubeH / 2;
  group.add(topCap);

  // Bulb
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 18), columnMat);
  bulb.position.y = -0.045;
  bulb.castShadow = false;
  group.add(bulb);

  // Column (cylinder from bulb to the current temperature)
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 1, 12), columnMat);
  column.name = 'column';
  group.add(column);
  const meniscus = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 12, 8), columnMat);
  meniscus.name = 'meniscus';
  group.add(meniscus);

  // Metal collar at the top
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.0195, 0.0028, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0x9fb9c8, metalness: 0.75, roughness: 0.3 }),
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = SCALE_H + 0.02;
  group.add(collar);

  group.scale.setScalar(scale);
  group.userData.setTemp = (tempC) => {
    const t = Math.max(SIM.thermometerMin, Math.min(SIM.thermometerMax, tempC));
    const top = (t - SIM.thermometerMin) * SIM.scaleMetersPerDegree;
    const bottom = -0.045;
    const h = Math.max(0.006, top - bottom);
    column.scale.y = h;
    column.position.y = bottom + h / 2;
    meniscus.position.y = top;
    meniscus.visible = t > SIM.thermometerMin + 0.1;
  };
  group.userData.setActive = () => {
    // The active cup is indicated by the tab and the reading panel;
    // no ring is drawn across the scale because it can hide a tick.
  };
  group.userData.setTemp(SIM.startTempC);
  return group;
}

export function thermometerMeniscusLocalY(tempC) {
  return (Math.max(SIM.thermometerMin, Math.min(SIM.thermometerMax, tempC)) - SIM.thermometerMin) * SIM.scaleMetersPerDegree;
}

export { SCALE_H, PLANE_H };
