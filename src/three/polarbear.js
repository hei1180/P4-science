import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeSoftCircleTexture } from './textures.js';

/**
 * Load the free low-poly bear (Poly by Google, CC BY 3.0) and turn it into a
 * polar bear by replacing the brown material with a snow-white one.
 */
export async function loadPolarBear(url = './assets/models/bear.glb') {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const model = gltf.scene;

  const white = new THREE.MeshStandardMaterial({
    color: 0xf4fbff,
    roughness: 0.93,
    metalness: 0,
  });
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.material = white;
    obj.castShadow = true;
    obj.receiveShadow = true;
    obj.frustumCulled = true;
  });

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  const target = 2.5;
  const s = target / (longest || 1);
  model.scale.setScalar(s);

  // Re-measure after scaling and put the feet on the ice.
  const box2 = new THREE.Box3().setFromObject(model);
  const center = box2.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box2.min.y;

  const group = new THREE.Group();
  group.name = 'polar-bear';
  group.add(model);
  group.position.set(3.0, 0, -1.55);
  group.rotation.y = -0.55;

  // Soft contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.8),
    new THREE.MeshBasicMaterial({
      map: makeSoftCircleTexture('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.008, 0);
  shadow.scale.set(1.3, 1.3, 1);
  group.add(shadow);

  const baseY = 0;
  return {
    group,
    model,
    update(time) {
      group.position.y = baseY + Math.sin(time * 0.8) * 0.008;
      model.scale.y = s * (1 + Math.sin(time * 0.9) * 0.006);
      model.rotation.z = Math.sin(time * 0.4) * 0.004;
    },
  };
}
