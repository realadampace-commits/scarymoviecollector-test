import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

function load(loader, url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

async function fileMap(model) {
  const urls = [];
  const entries = await Promise.all((model.files || []).map(async (file) => {
    if (!Array.isArray(file.parts)) return [file.name.toLowerCase(), file.url];
    const responses = await Promise.all(file.parts.map(async (part) => {
      const response = await fetch(part.url);
      if (!response.ok) throw new Error(`Unable to load ${file.name}.`);
      return response.blob();
    }));
    const url = URL.createObjectURL(new Blob(responses, { type: file.type || 'application/octet-stream' }));
    urls.push(url);
    return [file.name.toLowerCase(), url];
  }));
  return { assets: new Map(entries), release: () => urls.forEach((url) => URL.revokeObjectURL(url)) };
}

async function loadObject(model, manager) {
  if (model.model_format === 'glb' || model.model_format === 'gltf') {
    const gltf = await load(new GLTFLoader(manager), model.model_url);
    return gltf.scene;
  }
  if (model.model_format === 'fbx') return load(new FBXLoader(manager), model.model_url);
  if (model.model_format === 'stl') {
    const geometry = await load(new STLLoader(manager), model.model_url);
    geometry.computeVertexNormals();
    return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xb8beca, roughness: 0.65, metalness: 0.1 }));
  }
  if (model.model_format === 'obj') {
    const objLoader = new OBJLoader(manager);
    const material = (model.files || []).find((file) => file.name.toLowerCase().endsWith('.mtl'));
    if (material) {
      const materials = await load(new MTLLoader(manager), material.url);
      materials.preload();
      objLoader.setMaterials(materials);
    }
    return load(objLoader, model.model_url);
  }
  throw new Error('Unsupported 3D model format.');
}

export async function mountModelViewer(container, model) {
  if (!container || !model?.model_url) throw new TypeError('A viewer container and model are required.');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Interactive 3D collectible viewer. Drag to rotate and scroll to zoom.');
  canvas.setAttribute('role', 'img');
  container.replaceChildren(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x10141d);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 10000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x263042, 2.4));
  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(4, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xef476f, 1.8);
  rim.position.set(-4, 2, -3);
  scene.add(rim);

  const { assets, release } = await fileMap(model);
  const primary = (model.files || []).find((file) => file.name.toLowerCase().endsWith(`.${model.model_format}`));
  const resolvedModel = {
    ...model,
    model_url: assets.get(primary?.name.toLowerCase()) || model.model_url,
    files: (model.files || []).map((file) => ({ ...file, url: assets.get(file.name.toLowerCase()) || file.url }))
  };
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (/^(data:|blob:)/i.test(url)) return url;
    const name = decodeURIComponent(url.split('/').pop().split('?')[0]).toLowerCase();
    if (assets.has(name)) return assets.get(name);
    return /^https?:/i.test(url) ? 'data:,' : url;
  });
  const object = await loadObject(resolvedModel, manager);
  scene.add(object);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) throw new Error('The model contains no visible geometry.');
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  object.position.sub(center);
  const radius = Math.max(size.x, size.y, size.z) / 2 || 1;
  camera.near = Math.max(radius / 100, 0.001);
  camera.far = radius * 100;
  camera.position.set(radius * 1.8, radius * 1.25, radius * 2.4);
  controls.target.set(0, 0, 0);
  controls.minDistance = radius * 0.25;
  controls.maxDistance = radius * 10;
  controls.update();

  let frame = 0;
  const resize = () => {
    const width = Math.max(container.clientWidth, 280);
    const height = Math.max(container.clientHeight, 360);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  const render = () => {
    controls.update();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  };
  render();
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    controls.dispose();
    object.traverse((node) => {
      node.geometry?.dispose?.();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.filter(Boolean).forEach((material) => {
        Object.values(material).forEach((value) => value?.isTexture && value.dispose());
        material.dispose?.();
      });
    });
    renderer.dispose();
    release();
  };
}
