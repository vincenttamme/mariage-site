import {
  Box3,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';

/**
 * The scene renders exactly one character. Color rules and UI state stay outside it.
 * Both existing GLB outfits are cached per URL; only clothing materials and skeletons are cloned.
 * Build this file with npm run build. The UI lazy-loads scene.bundle.js.
 *
 * @typedef {{id:string, label?:string, modelId:string, colorId:string, role?:string}} Participant
 * @typedef {{id:string, label?:string, url:string|null, clothingMaterials:string[], clothingMeshes?:string[], height?:number, rotation?:number}} Model
 * @typedef {{id:string, hex:string}} Swatch
 * @typedef {{models:Model[], colors:Swatch[]}} SceneConfig
 * @typedef {{loaded:number,total:number,bytes:number,characterId:string|null,message:string}} Progress
 * @typedef {{container:HTMLElement,config:SceneConfig,character:Participant,onProgress?:(progress:Progress)=>void,onError?:(error:Error,context:{characterId:string,modelId:string})=>void,onContextLost?:()=>void}} SceneOptions
 */

const STUDIO_COLOR = '#eae5dd';

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
  canvas.setAttribute('aria-label', 'Personnage en trois dimensions. Utilisez les flèches gauche et droite pour le faire tourner.');
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


  const loader = new GLTFLoader();
  /** @type {Map<string, Promise<import('three/addons/loaders/GLTFLoader.js').GLTF>>} */
  const assetCache = new Map();
  /** @type {Set<import('three').Object3D>} */
  const sourceScenes = new Set();
  /** @type {Set<AbortController>} */
  const requests = new Set();
  /** @type {{root:Group,modelId:string,width:number,height:number,depth:number,materials:MeshStandardMaterial[],skeletons:Set<import('three').Skeleton>}|null} */
  let instance = null;
  let character = { ...options.character };
  let loadVersion = 0;
  let disposed = false;
  let contextLost = false;
  let visible = true;
  let dirty = true;
  let frame = 0;
  let width = Math.max(1, container.clientWidth);
  let height = Math.max(1, container.clientHeight || 480);
  let yaw = 0;
  let targetYaw = 0;
  let receivedBytes = 0;
  let renderedFrames = 0;
  let lastFrameMs = 0;
  let slowFrames = 0;
  let pixelRatio = initialPixelRatio;
  const target = new Vector3(0, 0.95, 0);
  /** @type {{id:number,x:number,startX:number,startY:number,horizontal:boolean}|null} */
  let pointer = null;

  function scheduleRender() {
    dirty = true;
    if (!disposed && !contextLost && visible && !document.hidden && !frame) frame = requestAnimationFrame(render);
  }

  function applyColor() {
    if (!instance || instance.modelId !== character.modelId) return;
    const value = colors.get(character.colorId);
    if (!value) return;
    for (const material of instance.materials) material.color.set(value);
  }

  function frameCamera() {
    camera.aspect = width / height;
    const model = models.get(character.modelId);
    const modelHeight = instance?.height || model?.height || 1.78;
    const modelWidth = instance?.width || 1.05;
    const modelDepth = instance?.depth || 0.8;
    const verticalFov = camera.fov * Math.PI / 180;
    const radius = Math.hypot(modelWidth / 2, modelDepth / 2);
    const verticalDistance = modelHeight * 0.62 / Math.tan(verticalFov / 2);
    const horizontalDistance = radius * 1.27 / (Math.tan(verticalFov / 2) * camera.aspect);
    const distance = Math.max(verticalDistance, horizontalDistance);
    target.set(0, modelHeight * 0.5, 0);
    camera.position.set(0, target.y + distance * 0.07, distance);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }

  function render() {
    frame = 0;
    if (disposed || contextLost || !visible || document.hidden || !dirty) return;
    dirty = false;
    const started = performance.now();
    if (reducedMotion.matches) yaw = targetYaw;
    else {
      const difference = targetYaw - yaw;
      if (Math.abs(difference) > 0.002) {
        yaw += difference * 0.32;
        scheduleRender();
      } else yaw = targetYaw;
    }
    group.rotation.y = yaw;
    renderer.info.reset();
    renderer.setViewport(0, 0, width, height);
    frameCamera();
    applyColor();
    renderer.render(scene, camera);
    renderedFrames += 1;
    lastFrameMs = performance.now() - started;
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
    scheduleRender();
  }

  function reportProgress() {
    if (disposed) return;
    const loaded = instance?.modelId === character.modelId ? 1 : 0;
    options.onProgress?.({
      loaded, total: 1, bytes: receivedBytes, characterId: character.id,
      message: loaded ? 'La tenue est prête.' : 'Chargement du personnage…',
    });
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


  /** @param {Participant} selected @param {number} version */
  async function loadCharacter(selected, version) {
    const model = models.get(selected.modelId);
    try {
      if (!model?.url) throw new Error('Cette tenue 3D n’est pas encore disponible.');
      const source = await getAsset(model.url);
      if (disposed || version !== loadVersion) return;
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
        throw new Error('Aucun matériau textile recolorable dans ce modèle.');
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
      const scale = (model.height || 1.78) / size.y;
      normalized.scale.setScalar(scale);
      normalized.add(object);
      const root = new Group();
      root.add(normalized);
      removeInstance();
      instance = {
        root, modelId: selected.modelId,
        width: size.x * scale, height: size.y * scale, depth: size.z * scale,
        materials: [...clonedMaterials.values()], skeletons,
      };
      group.add(root);
      applyColor();
      renderer.shadowMap.needsUpdate = true;
      scheduleRender();
      reportProgress();
    } catch (error) {
      if (disposed || version !== loadVersion) return;
      options.onError?.(error instanceof Error ? error : new Error('Impossible de charger cette tenue 3D.'), { characterId: selected.id, modelId: selected.modelId });
    }
  }

  function removeInstance() {
    if (!instance) return;
    group.remove(instance.root);
    instance.materials.forEach((material) => material.dispose());
    instance.skeletons.forEach((skeleton) => skeleton.dispose());
    instance = null;
  }

  /** @param {Participant} next */
  function setCharacter(next) {
    if (disposed) return;
    if (!models.has(next.modelId)) throw new RangeError('Modèle 3D inconnu.');
    const requiresLoad = !instance || instance.modelId !== next.modelId;
    character = { ...next };
    if (requiresLoad) {
      const version = ++loadVersion;
      removeInstance();
      reportProgress();
      void loadCharacter({ ...character }, version);
    } else {
      applyColor();
      scheduleRender();
    }
  }

  /** @param {string} colorId */
  function setColor(colorId) {
    if (disposed) return;
    if (!colors.has(colorId)) throw new RangeError('Couleur inconnue.');
    character.colorId = colorId;
    applyColor();
    scheduleRender();
  }

  /** @param {number} radians */
  function rotate(radians) {
    if (disposed || !Number.isFinite(radians)) return;
    targetYaw += radians;
    renderer.shadowMap.needsUpdate = true;
    scheduleRender();
  }

  function resetView() {
    targetYaw = 0;
    renderer.shadowMap.needsUpdate = true;
    scheduleRender();
  }

  /** @param {PointerEvent} event */
  function onPointerDown(event) {
    if (pointer || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointer = { id: event.pointerId, x: event.clientX, startX: event.clientX, startY: event.clientY, horizontal: false };
    if (event.pointerType === 'mouse') canvas.setPointerCapture(event.pointerId);
  }

  /** @param {PointerEvent} event */
  function onPointerMove(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    const x = event.clientX - pointer.startX;
    const y = event.clientY - pointer.startY;
    if (!pointer.horizontal && (Math.abs(x) < 6 || Math.abs(x) <= Math.abs(y))) return;
    pointer.horizontal = true;
    rotate((event.clientX - pointer.x) * 0.007);
    pointer.x = event.clientX;
  }

  /** @param {PointerEvent} event */
  function onPointerUp(event) {
    if (!pointer || event.pointerId !== pointer.id) return;
    pointer = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  /** @param {KeyboardEvent} event */
  function onKeyDown(event) {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const actions = {
      ArrowLeft: () => rotate(-0.18),
      ArrowRight: () => rotate(0.18),
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
  canvas.addEventListener('keydown', onKeyDown);
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  document.addEventListener('visibilitychange', onVisibilityChange);
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
    ++loadVersion;
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
    canvas.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    requests.forEach((controller) => controller.abort());
    requests.clear();
    pointer = null;
    removeInstance();
    disposeSources(sourceScenes);
    sourceScenes.clear();
    assetCache.clear();
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
  queueMicrotask(() => {
    if (disposed || loadVersion > 0) return;
    reportProgress();
    void loadCharacter({ ...character }, ++loadVersion);
  });

  return {
    setCharacter,
    setColor,
    rotate,
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
        loadedCharacters: instance ? 1 : 0,
        cachedModels: assetCache.size,
        receivedBytes,
        renderedFrames,
        lastRenderSubmissionMs: Number(lastFrameMs.toFixed(2)),
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        pixelRatio,
        characters: instance ? [{
          id: character.id, modelId: instance.modelId,
          clothing: instance.materials.map((material) => ({ materialId: material.uuid, color: '#' + material.color.getHexString() })),
        }] : [],
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
