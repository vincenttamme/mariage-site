import {
  Box3,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Raycaster,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

/**
 * The scene owns its WebGL resources. Business rules and UI state stay outside it.
 * Assets are cached per URL; only clothing materials and skeletons are cloned.
 * Build this file with npm run build. The UI lazy-loads scene.bundle.js.
 *
 * @typedef {{id:string, label?:string, modelId:string, colorId:string, role?:string}} Participant
 * @typedef {{id:string, label?:string, url:string|null, clothingMaterials:string[], clothingMeshes?:string[], height?:number, rotation?:number}} Model
 * @typedef {{id:string, hex:string}} Swatch
 * @typedef {{models:Model[], colors:Swatch[]}} SceneConfig
 * @typedef {{compliant:Participant[], alternative:Participant[]}} Comparison
 * @typedef {{loaded:number,total:number,bytes:number,characterId:string|null,message:string}} Progress
 * @typedef {{container:HTMLElement,config:SceneConfig,composition:Participant[],onSelect?:(id:string)=>void,onProgress?:(progress:Progress)=>void,onError?:(error:Error,context:{characterId:string,modelId:string})=>void,onContextLost?:()=>void}} SceneOptions
 */

const COMPARISON_BREAKPOINT = 700;
const STUDIO_COLOR = '#eae5dd';
const SELECTED_COLOR = '#735a50';
const MAX_ROTATION = Math.PI;

/** @param {SceneOptions} options */
export function createScene(options) {
  const { container, config } = options;
  const models = new Map(config.models.map((model) => [model.id, model]));
  const colors = new Map(config.colors.map((color) => [color.id, color.hex]));
  const isSmallDevice = window.matchMedia('(max-width: 700px)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const memory = /** @type {Navigator & {deviceMemory?:number}} */ (navigator).deviceMemory;
  const constrainedDevice = (memory !== undefined && memory <= 4) || navigator.hardwareConcurrency <= 4;
  const initialPixelRatio = Math.min(window.devicePixelRatio || 1, isSmallDevice || constrainedDevice ? 1.35 : 1.75);

  const canvas = document.createElement('canvas');
  canvas.className = 'dress-code-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Groupe de tenues en trois dimensions. Flèches gauche et droite pour tourner, touches plus et moins pour zoomer, touche Origine pour revenir à la vue de groupe. La sélection et les couleurs sont aussi disponibles dans le panneau.');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;';

  // Throw before changing the host if this browser cannot create a WebGL context.
  const renderer = new WebGLRenderer({ canvas, antialias: !constrainedDevice, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(initialPixelRatio);
  renderer.setClearColor(STUDIO_COLOR);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;
  container.append(canvas);

  const scene = new Scene();
  scene.background = new Color(STUDIO_COLOR);
  scene.fog = new Fog(STUDIO_COLOR, 15, 35);
  const camera = new PerspectiveCamera(32, 1, 0.05, 60);
  const group = new Group();
  scene.add(group);

  const floorGeometry = new PlaneGeometry(80, 80);
  const floorMaterial = new MeshStandardMaterial({ color: STUDIO_COLOR, roughness: 0.93, metalness: 0 });
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.008;
  floor.receiveShadow = true;
  scene.add(floor);

  const fill = new HemisphereLight('#fffdf9', '#b7ab9a', 1.6);
  scene.add(fill);
  const key = new DirectionalLight('#fffaf1', 3.1);
  key.position.set(-3.5, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(constrainedDevice || isSmallDevice ? 1024 : 2048, constrainedDevice || isSmallDevice ? 1024 : 2048);
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 18;
  key.shadow.normalBias = 0.018;
  key.shadow.bias = -0.00015;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new DirectionalLight('#ffffff', 1.1);
  rim.position.set(4, 3.5, -4);
  scene.add(rim);

  const environmentGenerator = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = environmentGenerator.fromScene(room, 0.04, 0.1, 100);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.36;
  room.dispose();
  environmentGenerator.dispose();

  const selectionGeometry = new RingGeometry(0.33, 0.35, 64);
  const selectionMaterial = new MeshBasicMaterial({ color: SELECTED_COLOR, transparent: true, opacity: 0.65, depthWrite: false });
  const selectionRing = new Mesh(selectionGeometry, selectionMaterial);
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.position.y = 0.004;
  selectionRing.visible = false;
  group.add(selectionRing);

  const loader = new GLTFLoader();
  /** @type {Map<string, Promise<import('three/addons/loaders/GLTFLoader.js').GLTF>>} */
  const assetCache = new Map();
  /** @type {Set<import('three').Object3D>} */
  const sourceScenes = new Set();
  /** @type {Set<AbortController>} */
  const requests = new Set();
  /** @type {Map<string, {root:Group,modelId:string,width:number,height:number,depth:number,materials:MeshStandardMaterial[],skeletons:Set<import('three').Skeleton>}>} */
  const instances = new Map();
  /** @type {Map<string, string>} */
  const pending = new Map();
  /** @type {Set<string>} */
  const failed = new Set();
  let composition = options.composition.map((character) => ({ ...character }));
  /** @type {Comparison|null} */
  let comparison = null;
  /** @type {'compliant'|'alternative'} */
  let comparisonSide = 'compliant';
  /** @type {string|null} */
  let selectedId = null;
  let disposed = false;
  let contextLost = false;
  let visible = true;
  let dirty = true;
  let frame = 0;
  let width = Math.max(1, container.clientWidth);
  let height = Math.max(1, container.clientHeight || 480);
  let zoom = 1;
  let yaw = 0;
  let receivedBytes = 0;
  let renderedFrames = 0;
  let lastFrameMs = 0;
  let slowFrames = 0;
  let pixelRatio = initialPixelRatio;
  let loading = false;
  let loadRequested = false;
  let groupWidth = 4.6;
  let groupHeight = 1.9;
  let groupDepth = 1.4;

  const raycaster = new Raycaster();
  const pointerPosition = new Vector2();
  const target = new Vector3(0, 0.95, 0);
  /** @type {Map<number,{x:number,y:number,startX:number,startY:number,moved:boolean}>} */
  const pointers = new Map();
  let pinchDistance = 0;

  function isSplit() {
    return comparison !== null && width > COMPARISON_BREAKPOINT;
  }

  function scheduleRender() {
    dirty = true;
    if (!disposed && !contextLost && visible && !document.hidden && !frame) frame = requestAnimationFrame(render);
  }

  /** @param {Participant[]} displayed */
  function applyColors(displayed) {
    for (const character of displayed) {
      const instance = instances.get(character.id);
      const color = colors.get(character.colorId);
      if (!instance || !color) continue;
      for (const material of instance.materials) material.color.set(color);
    }
  }

  /** @param {number} viewportWidth */
  function frameCamera(viewportWidth) {
    const aspect = viewportWidth / height;
    camera.aspect = aspect;
    // Rotation-safe framing keeps the complete group visible, including during drag.
    const halfSpan = Math.hypot(groupWidth / 2, groupDepth / 2);
    const verticalFov = camera.fov * Math.PI / 180;
    const distanceForHeight = (groupHeight * 0.72) / Math.tan(verticalFov / 2);
    const distanceForWidth = (halfSpan * 1.26) / (Math.tan(verticalFov / 2) * aspect);
    const distance = Math.max(distanceForHeight, distanceForWidth) / zoom;
    target.set(0, groupHeight * 0.48, 0);
    const compact = (isSplit() ? width / 2 : width) <= 480 && composition.length > 3;
    camera.position.set(0, target.y + distance * (compact ? 0.3 : 0.115), distance);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function render() {
    frame = 0;
    if (disposed || contextLost || !visible || document.hidden || !dirty) return;
    dirty = false;
    const started = performance.now();
    renderer.info.reset();
    group.rotation.y = yaw;
    if (isSplit() && comparison) {
      const leftWidth = Math.floor(width / 2);
      const rightWidth = width - leftWidth;
      renderer.setScissorTest(true);
      renderer.setViewport(0, 0, leftWidth, height);
      renderer.setScissor(0, 0, leftWidth, height);
      frameCamera(leftWidth);
      applyColors(comparison.compliant);
      renderer.render(scene, camera);
      renderer.setViewport(leftWidth, 0, rightWidth, height);
      renderer.setScissor(leftWidth, 0, rightWidth, height);
      frameCamera(rightWidth);
      applyColors(comparison.alternative);
      renderer.render(scene, camera);
      renderer.setScissorTest(false);
    } else {
      renderer.setViewport(0, 0, width, height);
      renderer.setScissorTest(false);
      frameCamera(width);
      applyColors(comparison ? comparison[comparisonSide] : composition);
      renderer.render(scene, camera);
    }
    renderedFrames += 1;
    lastFrameMs = performance.now() - started;
    // Only adapt during actual user activity. No animation loop consumes idle power.
    // This measures CPU submission time, not a guaranteed GPU frame rate.
    slowFrames = lastFrameMs > 42 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (slowFrames >= 8 && pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.25);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      slowFrames = 0;
      scheduleRender();
    }
  }

  function resize() {
    if (disposed) return;
    width = Math.max(1, Math.round(container.clientWidth));
    height = Math.max(1, Math.round(container.clientHeight || 480));
    renderer.setSize(width, height, false);
    arrangeGroup();
    scheduleRender();
  }

  function arrangeGroup() {
    const count = composition.length;
    const compact = (isSplit() ? width / 2 : width) <= 480 && count > 3;
    // Narrow viewports use two staggered rows. Every face remains visible and both
    // comparison panels always share the same arrangement and camera settings.
    const columns = compact ? Math.ceil(count / 2) : count;
    const widths = composition.map((character) => instances.get(character.id)?.width || 0.7);
    const depths = composition.map((character) => instances.get(character.id)?.depth || 0.6);
    const rowDepth = Math.max(0.65, ...depths) + 0.2;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let index = 0; index < count; index += 1) {
      const character = composition[index];
      const instance = instances.get(character.id);
      const offset = index - (count - 1) / 2;
      const rowStart = Math.floor(index / columns) * columns;
      const rowWidths = widths.slice(rowStart, rowStart + columns);
      const rowWidth = rowWidths.reduce((total, item) => total + item, 0) + (rowWidths.length - 1) * 0.15;
      const precedingWidth = widths.slice(rowStart, index).reduce((total, item) => total + item + 0.15, 0);
      let x = -rowWidth / 2 + precedingWidth + widths[index] / 2;
      let z;
      if (compact) {
        const front = index < columns;
        x += front ? -0.17 : 0.17;
        z = front ? rowDepth / 2 : -rowDepth / 2;
      } else {
        z = -Math.abs(offset) * 0.13 + (index % 2 ? 0.025 : -0.025);
      }
      minX = Math.min(minX, x - widths[index] / 2);
      maxX = Math.max(maxX, x + widths[index] / 2);
      if (!instance) continue;
      instance.root.position.set(x, 0, z);
      const model = models.get(character.modelId);
      instance.root.rotation.y = (model?.rotation || 0) + offset * -0.025;
    }
    groupWidth = count ? Math.max(1.1, maxX - minX) : 1.1;
    groupHeight = Math.max(1.8, ...composition.map((character) => models.get(character.modelId)?.height || 1.78));
    groupDepth = compact ? rowDepth + Math.max(...depths) : Math.max(0.9, count * 0.13 + Math.max(...depths));
    updateSelection();
    renderer.shadowMap.needsUpdate = true;
  }

  function updateSelection() {
    const instance = selectedId ? instances.get(selectedId) : undefined;
    selectionRing.visible = Boolean(instance);
    if (instance) {
      selectionRing.position.x = instance.root.position.x;
      selectionRing.position.z = instance.root.position.z;
      // Keep the selection visible around wide hems, rather than under the dress.
      selectionRing.scale.set(
        Math.max(0.35, instance.width * 0.56) / 0.35,
        Math.max(0.35, instance.depth * 0.56) / 0.35,
        1,
      );
    }
  }

  /** @param {string|null} characterId */
  function reportProgress(characterId = null) {
    if (disposed) return;
    const total = composition.length;
    const loaded = composition.filter((character) => instances.has(character.id)).length;
    options.onProgress?.({ loaded, total, bytes: receivedBytes, characterId, message: loaded === total ? 'Les tenues sont prêtes.' : `Chargement des tenues : ${loaded} sur ${total}.` });
  }

  /** @param {string} url */
  async function getAsset(url) {
    const absoluteUrl = new URL(url, document.baseURI).href;
    let cached = assetCache.get(absoluteUrl);
    if (!cached) {
      cached = (async () => {
        const controller = new AbortController();
        requests.add(controller);
        try {
          const response = await fetch(absoluteUrl, { signal: controller.signal });
          if (!response.ok) throw new Error(`Le modèle 3D n’a pas pu être chargé (${response.status}).`);
          const buffer = await response.arrayBuffer();
          receivedBytes += buffer.byteLength;
          if (disposed) throw new DOMException('Chargement annulé.', 'AbortError');
          const asset = await loader.parseAsync(buffer, new URL('.', absoluteUrl).href);
          if (disposed) {
            disposeSources([asset.scene]);
            throw new DOMException('Chargement annulé.', 'AbortError');
          }
          sourceScenes.add(asset.scene);
          return asset;
        } finally {
          requests.delete(controller);
        }
      })();
      assetCache.set(absoluteUrl, cached);
    }
    return cached;
  }

  /** @param {Participant} character */
  async function loadCharacter(character) {
    const model = models.get(character.modelId);
    const token = `${character.id}:${character.modelId}`;
    pending.set(character.id, token);
    try {
      if (!model?.url) throw new Error('Cette tenue 3D n’est pas encore disponible. Le nuancier reste accessible.');
      const source = await getAsset(model.url);
      if (disposed || pending.get(character.id) !== token || !composition.some((item) => item.id === character.id && item.modelId === character.modelId)) return;
      const object = cloneSkeleton(source.scene);
      const targetMaterials = new Set(model.clothingMaterials);
      const targetMeshes = new Set(model.clothingMeshes || []);
      /** @type {Map<import('three').Material, MeshStandardMaterial>} */
      const clonedMaterials = new Map();
      /** @type {Set<import('three').Skeleton>} */
      const skeletons = new Set();
      object.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        node.castShadow = true;
        node.receiveShadow = true;
        node.userData.dressCodeCharacter = character.id;
        if ('isSkinnedMesh' in node && node.isSkinnedMesh && 'skeleton' in node) skeletons.add(/** @type {import('three').SkinnedMesh} */ (node).skeleton);
        /** @param {import('three').Material} material */
        function isolateClothing(material) {
          if (!(material instanceof MeshStandardMaterial)) return material;
          if (!targetMaterials.has(material.name) && !targetMeshes.has(node.name)) return material;
          let clone = clonedMaterials.get(material);
          if (!clone) {
            clone = material.clone();
            clonedMaterials.set(material, clone);
          }
          return clone;
        }
        node.material = Array.isArray(node.material) ? node.material.map(isolateClothing) : isolateClothing(node.material);
      });
      if (clonedMaterials.size === 0) {
        skeletons.forEach((skeleton) => skeleton.dispose());
        throw new Error('Les matières de cette tenue ne permettent pas encore de personnaliser sa couleur.');
      }
      object.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(object, true);
      const size = bounds.getSize(new Vector3());
      if (!Number.isFinite(size.y) || size.y <= 0) {
        clonedMaterials.forEach((material) => material.dispose());
        skeletons.forEach((skeleton) => skeleton.dispose());
        throw new Error('Les dimensions du modèle 3D ne sont pas valides.');
      }
      const center = bounds.getCenter(new Vector3());
      object.position.sub(new Vector3(center.x, bounds.min.y, center.z));
      const normalized = new Group();
      const modelScale = (model.height || 1.78) / size.y;
      normalized.scale.setScalar(modelScale);
      normalized.add(object);
      const root = new Group();
      root.add(normalized);
      removeInstance(character.id);
      instances.set(character.id, { root, modelId: character.modelId, width: size.x * modelScale, height: size.y * modelScale, depth: size.z * modelScale, materials: [...clonedMaterials.values()], skeletons });
      group.add(root);
      arrangeGroup();
      scheduleRender();
      reportProgress(character.id);
    } catch (error) {
      if (disposed || pending.get(character.id) !== token || !composition.some((item) => item.id === character.id && item.modelId === character.modelId)) return;
      failed.add(token);
      options.onError?.(error instanceof Error ? error : new Error('Impossible de charger cette tenue 3D.'), { characterId: character.id, modelId: character.modelId });
    } finally {
      if (pending.get(character.id) === token) pending.delete(character.id);
    }
  }

  /** @param {string} id */
  function removeInstance(id) {
    const instance = instances.get(id);
    if (!instance) return;
    group.remove(instance.root);
    instance.materials.forEach((material) => material.dispose());
    instance.skeletons.forEach((skeleton) => skeleton.dispose());
    instances.delete(id);
  }

  async function loadGroup() {
    // Sequential character scheduling gives useful progressive output and avoids a
    // burst of simultaneous texture decoding on phones. Shared models hit the cache.
    if (loading) {
      loadRequested = true;
      return;
    }
    loading = true;
    try {
      do {
        loadRequested = false;
        for (const character of composition) {
          if (disposed) return;
          if (!composition.some((item) => item.id === character.id && item.modelId === character.modelId)) continue;
          const existing = instances.get(character.id);
          const token = `${character.id}:${character.modelId}`;
          if (existing?.modelId === character.modelId || pending.get(character.id) === token || failed.has(token)) continue;
          await loadCharacter(character);
        }
      } while (loadRequested && !disposed);
    } finally {
      loading = false;
    }
  }

  /** @param {Participant[]} next */
  function setComposition(next) {
    if (disposed) return;
    const structureChanged = next.length !== composition.length || next.some((character, index) => character.id !== composition[index]?.id || character.modelId !== composition[index]?.modelId);
    composition = next.map((character) => ({ ...character }));
    if (structureChanged) {
      for (const [id, instance] of instances) {
        if (!composition.some((character) => character.id === id && character.modelId === instance.modelId)) removeInstance(id);
      }
      for (const [id] of pending) {
        if (!composition.some((character) => character.id === id)) pending.delete(id);
      }
      arrangeGroup();
      reportProgress();
      void loadGroup();
    }
    scheduleRender();
  }

  /** @param {number} radians */
  function rotate(radians) {
    if (disposed) return;
    yaw = ((yaw + radians + MAX_ROTATION) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - MAX_ROTATION;
    renderer.shadowMap.needsUpdate = true;
    scheduleRender();
  }

  /** @param {number} factor */
  function changeZoom(factor) {
    if (disposed || !Number.isFinite(factor) || factor <= 0) return;
    zoom = Math.min(1.2, Math.max(0.8, zoom * factor));
    scheduleRender();
  }

  function resetView() {
    if (disposed) return;
    yaw = 0;
    zoom = 1;
    renderer.shadowMap.needsUpdate = true;
    scheduleRender();
  }

  /** @param {PointerEvent} event */
  function selectAt(event) {
    if (disposed || contextLost) return;
    const rectangle = canvas.getBoundingClientRect();
    let x = event.clientX - rectangle.left;
    let viewportWidth = rectangle.width;
    if (isSplit()) {
      viewportWidth /= 2;
      if (x >= viewportWidth) x -= viewportWidth;
    }
    pointerPosition.set(x / viewportWidth * 2 - 1, -(event.clientY - rectangle.top) / rectangle.height * 2 + 1);
    frameCamera(viewportWidth);
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(pointerPosition, camera);
    const hits = raycaster.intersectObjects([...instances.values()].map((instance) => instance.root), true);
    const id = hits.find((hit) => typeof hit.object.userData.dressCodeCharacter === 'string')?.object.userData.dressCodeCharacter;
    if (typeof id === 'string') options.onSelect?.(id);
  }

  /** @param {PointerEvent} event */
  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false });
    canvas.setPointerCapture(event.pointerId);
    if (pointers.size > 1) for (const pointer of pointers.values()) pointer.moved = true;
    pinchDistance = distanceBetweenPointers();
  }

  function distanceBetweenPointers() {
    const points = [...pointers.values()];
    return points.length === 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
  }

  /** @param {PointerEvent} event */
  function onPointerMove(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const travelX = event.clientX - pointer.startX;
    const travelY = event.clientY - pointer.startY;
    pointer.moved ||= Math.hypot(travelX, travelY) > 5;
    if (pointers.size === 2) {
      const distance = distanceBetweenPointers();
      if (pinchDistance > 0) changeZoom(distance / pinchDistance);
      pinchDistance = distance;
    } else if (pointer.moved && Math.abs(travelX) >= Math.abs(travelY)) {
      rotate(dx * 0.007);
    }
  }

  /** @param {PointerEvent} event */
  function onPointerUp(event) {
    const pointer = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    pinchDistance = 0;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (pointer && !pointer.moved && event.type === 'pointerup') selectAt(event);
  }

  /** @param {WheelEvent} event */
  function onWheel(event) {
    if (document.activeElement !== canvas || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    changeZoom(Math.exp(-event.deltaY * 0.001));
  }

  /** @param {KeyboardEvent} event */
  function onKeyDown(event) {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const actions = {
      ArrowLeft: () => rotate(-0.14),
      ArrowRight: () => rotate(0.14),
      '+': () => changeZoom(1.08),
      '=': () => changeZoom(1.08),
      '-': () => changeZoom(1 / 1.08),
      Home: resetView,
    };
    const action = actions[/** @type {keyof typeof actions} */ (event.key)];
    if (action) {
      event.preventDefault();
      action();
    }
  }

  /** @param {Event} event */
  function onContextLost(event) {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    options.onContextLost?.();
  }

  function onContextRestored() {
    if (disposed) return;
    contextLost = false;
    renderer.shadowMap.needsUpdate = true;
    scheduleRender();
  }

  function onVisibilityChange() {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else scheduleRender();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  document.addEventListener('visibilitychange', onVisibilityChange);
  // No automatic movement is performed, including under reduced-motion settings.
  reducedMotion.addEventListener('change', scheduleRender);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) scheduleRender();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }, { threshold: 0 });
  intersectionObserver.observe(container);

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    frame = 0;
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    reducedMotion.removeEventListener('change', scheduleRender);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    requests.forEach((controller) => controller.abort());
    requests.clear();
    pointers.clear();
    pending.clear();
    for (const id of instances.keys()) removeInstance(id);
    disposeSources(sourceScenes);
    sourceScenes.clear();
    assetCache.clear();
    selectionGeometry.dispose();
    selectionMaterial.dispose();
    floorGeometry.dispose();
    floorMaterial.dispose();
    environment.dispose();
    key.shadow.dispose();
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  resize();
  // A microtask lets callers retain the adapter before receiving callbacks.
  queueMicrotask(() => {
    if (disposed) return;
    reportProgress();
    void loadGroup();
  });

  return {
    setComposition,
    /** @param {string|null} id */
    setSelection(id) {
      selectedId = id;
      updateSelection();
      scheduleRender();
    },
    /** @param {Comparison|null} next */
    setComparison(next) {
      const previouslySplit = isSplit();
      comparison = next ? { compliant: next.compliant.map((item) => ({ ...item })), alternative: next.alternative.map((item) => ({ ...item })) } : null;
      if (previouslySplit !== isSplit()) arrangeGroup();
      scheduleRender();
    },
    /** @param {'compliant'|'alternative'} side */
    setComparisonSide(side) {
      comparisonSide = side;
      scheduleRender();
    },
    rotate,
    zoom: changeZoom,
    resetView,
    resize,
    /** @param {boolean} next */
    setVisible(next) {
      visible = next;
      if (visible) scheduleRender();
      else {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    },
    dispose,
    diagnostics() {
      return {
        loadedCharacters: instances.size,
        cachedModels: assetCache.size,
        receivedBytes,
        renderedFrames,
        lastRenderSubmissionMs: Number(lastFrameMs.toFixed(2)),
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        pixelRatio,
        splitComparison: isSplit(),
        characters: [...instances].map(([id, instance]) => ({
          id,
          modelId: instance.modelId,
          clothing: instance.materials.map((material) => ({ materialId: material.uuid, color: `#${material.color.getHexString()}` })),
        })),
        reducedMotion: reducedMotion.matches,
        contextLost,
        disposed,
      };
    },
  };
}

/** Release shared source resources once, including ImageBitmap decoded textures.
 * @param {Iterable<import('three').Object3D>} objects
 */
function disposeSources(objects) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const skeletons = new Set();
  for (const object of objects) {
    object.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      geometries.add(node.geometry);
      const meshMaterials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of meshMaterials) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
      if ('isSkinnedMesh' in node && node.isSkinnedMesh && 'skeleton' in node) skeletons.add(/** @type {import('three').SkinnedMesh} */ (node).skeleton);
    });
  }
  skeletons.forEach((skeleton) => skeleton.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  for (const texture of textures) {
    texture.dispose();
    const image = texture.source?.data;
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
  }
}
