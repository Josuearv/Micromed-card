import { MutableRefObject, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createBioEntityMesh,
  createBloodstreamErythrocytes,
  Entity3DHandle,
} from '../three/bioEntities';
import {
  createCardDeckStack,
  createContactShadowPlane,
  createMedicalMaterials,
  createPharmacologyTray,
  createStethoscopeModel,
  createSurgicalTable,
  createVitalMonitorRig,
} from '../three/models';
import { createOrganRig, OrganRigHandle } from '../three/organRigs';
import {
  createBrushedMetalRoughnessTexture,
  createCardBackTexture,
  createPlayedCardTexture,
  createRadialShadowTexture,
  createSurgicalMatTexture,
  VitalMonitorScreen,
} from '../three/textures';
import {
  CameraPreset,
  CombatEvent,
  DuelTelemetry,
  MedicalClass,
} from '../types/game';

export interface SlotAnchorDomRefs {
  player: Array<HTMLDivElement | null>;
  enemy: Array<HTMLDivElement | null>;
}

interface MedicalTableCanvasProps {
  telemetry: DuelTelemetry;
  cameraPreset: CameraPreset;
  eventBatch: CombatEvent[];
  playedCardMeta: { nonce: number; medicalClass: MedicalClass; name: string } | null;
  reducedMotion?: boolean;
  slotAnchorRefs: MutableRefObject<SlotAnchorDomRefs>;
  onClickPlayerSlot: (lane: number) => void;
  onClickEnemySlot: (lane: number) => void;
  onInspectOrgan: () => void;
  onClickDeck: () => void;
  onWebGLUnavailable?: () => void;
}

const CAMERA_TARGETS: Record<
  CameraPreset,
  { pos: [number, number, number]; look: [number, number, number] }
> = {
  overview: { pos: [0.0, 6.7, 9.0], look: [0, 0.1, 0.2] },
  organ: { pos: [-1.6, 2.6, 3.4], look: [0, 0.9, -0.1] },
  heart: { pos: [-1.6, 2.6, 3.4], look: [0, 0.9, -0.1] },
  instruments: { pos: [3.1, 3.0, 4.1], look: [1.6, 0.35, 0.2] },
};

const PLAYER_SLOT_POS: [number, number, number][] = [
  [-2.1, 0.14, 1.25],
  [0, 0.14, 1.25],
  [2.1, 0.14, 1.25],
];

const ENEMY_SLOT_POS: [number, number, number][] = [
  [-2.1, 0.14, -1.45],
  [0, 0.14, -1.45],
  [2.1, 0.14, -1.45],
];

const _desiredPos = new THREE.Vector3();
const _desiredLook = new THREE.Vector3();
const _rayMouse = new THREE.Vector2();
const _beamStart = new THREE.Vector3();
const _beamEnd = new THREE.Vector3();
const _beamMid = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();

function detectSoftwareGl(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function MedicalTableCanvas({
  telemetry,
  cameraPreset,
  eventBatch,
  playedCardMeta,
  reducedMotion = false,
  slotAnchorRefs,
  onClickPlayerSlot,
  onClickEnemySlot,
  onInspectOrgan,
  onClickDeck,
  onWebGLUnavailable,
}: MedicalTableCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const telemetryRef = useRef<DuelTelemetry>(telemetry);
  const presetRef = useRef<CameraPreset>(cameraPreset);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const userOrbitingRef = useRef(false);
  const transitionActiveRef = useRef(false);

  const inspectCbRef = useRef(onInspectOrgan);
  const deckCbRef = useRef(onClickDeck);
  const playerSlotCbRef = useRef(onClickPlayerSlot);
  const enemySlotCbRef = useRef(onClickEnemySlot);
  const fallbackCbRef = useRef(onWebGLUnavailable);

  // A10: Ordered VFX event queue instead of dropping earlier events
  const eventQueueRef = useRef<CombatEvent[]>([]);
  const lastEventNonceRef = useRef<number>(0);
  const cardTriggerRef = useRef<{
    nonce: number;
    medicalClass: MedicalClass;
    name: string;
  } | null>(null);
  const lastCardNonceRef = useRef<number>(0);

  useEffect(() => {
    const prevState = telemetryRef.current.gameState;
    telemetryRef.current = telemetry;
    if (prevState === 'TITLE_MENU' && telemetry.gameState === 'PLAYING') {
      userOrbitingRef.current = false;
      transitionActiveRef.current = true;
    }
  }, [telemetry]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    if (presetRef.current !== cameraPreset) {
      presetRef.current = cameraPreset;
      userOrbitingRef.current = false;
      transitionActiveRef.current = true;
    }
  }, [cameraPreset]);

  useEffect(() => {
    inspectCbRef.current = onInspectOrgan;
    deckCbRef.current = onClickDeck;
    playerSlotCbRef.current = onClickPlayerSlot;
    enemySlotCbRef.current = onClickEnemySlot;
    fallbackCbRef.current = onWebGLUnavailable;
  }, [
    onInspectOrgan,
    onClickDeck,
    onClickPlayerSlot,
    onClickEnemySlot,
    onWebGLUnavailable,
  ]);

  useEffect(() => {
    for (const evt of eventBatch) {
      if (evt.nonce > lastEventNonceRef.current) {
        lastEventNonceRef.current = evt.nonce;
        eventQueueRef.current.push(evt);
        if (eventQueueRef.current.length > 16) {
          eventQueueRef.current.shift();
        }
      }
    }
  }, [eventBatch]);

  useEffect(() => {
    if (playedCardMeta && playedCardMeta.nonce !== lastCardNonceRef.current) {
      lastCardNonceRef.current = playedCardMeta.nonce;
      cardTriggerRef.current = playedCardMeta;
    }
  }, [playedCardMeta]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    const isSoftwareGl = detectSoftwareGl();

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      fallbackCbRef.current?.();
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const bgHex = 0x081018;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.028);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 80);
    camera.position.set(0, 6.7, 9.0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 2.8;
    controls.maxDistance = 17.0;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI / 2 - 0.12;
    controls.target.set(0, 0.1, 0.2);

    const onControlStart = () => {
      userOrbitingRef.current = true;
      transitionActiveRef.current = false;
    };
    controls.addEventListener('start', onControlStart);

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xa5d8ff, 0x0d1b26, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1e0, 2.2);
    keyLight.position.set(4.5, 8.2, 5.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 22;
    keyLight.shadow.camera.left = -6.5;
    keyLight.shadow.camera.right = 6.5;
    keyLight.shadow.camera.top = 6.5;
    keyLight.shadow.camera.bottom = -6.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.05);
    rimLight.position.set(-5.2, 4.5, -5.8);
    scene.add(rimLight);

    const bioPointLight = new THREE.PointLight(0x10b981, 1.1, 6.5, 2);
    bioPointLight.position.set(0, 1.35, -0.1);
    scene.add(bioPointLight);

    // Shared Textures & Materials
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const matTexture = createSurgicalMatTexture(maxAniso);
    const brushedMap = createBrushedMetalRoughnessTexture();
    const shadowTexture = createRadialShadowTexture();
    const cardBackTexture = createCardBackTexture(maxAniso);
    const monitorScreen = new VitalMonitorScreen(maxAniso);
    const mats = createMedicalMaterials(brushedMap, isSoftwareGl);

    // 1. Surgical Table & Bloodstream
    const table = createSurgicalTable(mats, matTexture);
    scene.add(table);

    const bloodstream = createBloodstreamErythrocytes();
    scene.add(bloodstream.mesh);

    // 2. Vital Monitor Rig
    const monitorRig = createVitalMonitorRig(mats, monitorScreen);
    monitorRig.position.set(-3.45, 0.055, -2.25);
    monitorRig.rotation.y = 0.44;
    scene.add(monitorRig);
    const monitorShadow = createContactShadowPlane(shadowTexture, 2.2, 1.8, 0.48);
    monitorShadow.position.set(-3.45, 0.062, -2.25);
    scene.add(monitorShadow);

    // 3. Dynamic Central Organ Rig (supports all 5 organs with clean dispose)
    let activeOrganRig: OrganRigHandle = createOrganRig(
      telemetryRef.current.organId,
      mats,
      isSoftwareGl,
    );
    activeOrganRig.root.position.set(0, 0.055, -0.1);
    activeOrganRig.root.scale.setScalar(0.72);
    scene.add(activeOrganRig.root);
    const organShadow = createContactShadowPlane(shadowTexture, 1.85, 1.85, 0.48);
    organShadow.position.set(0, 0.062, -0.1);
    scene.add(organShadow);

    // 4. Stethoscope, Pharmacology Tray & Deck Stack
    const stethoscope = createStethoscopeModel(mats);
    stethoscope.position.set(-3.65, 0.065, 1.35);
    stethoscope.rotation.y = 0.5;
    scene.add(stethoscope);

    const pharmaTray = createPharmacologyTray(mats);
    pharmaTray.position.set(3.55, 0.062, -0.65);
    pharmaTray.rotation.y = -0.35;
    scene.add(pharmaTray);
    const trayShadow = createContactShadowPlane(shadowTexture, 2.0, 1.45, 0.4);
    trayShadow.position.set(3.55, 0.06, -0.65);
    trayShadow.rotation.y = -0.35;
    scene.add(trayShadow);

    const { group: deckGroup, hitProxy: deckHit } = createCardDeckStack(
      mats,
      cardBackTexture,
    );
    deckGroup.position.set(3.75, 0.064, 1.55);
    deckGroup.rotation.y = -0.2;
    scene.add(deckGroup);
    const deckShadow = createContactShadowPlane(shadowTexture, 1.45, 1.8, 0.42);
    deckShadow.position.set(3.75, 0.061, 1.55);
    deckShadow.rotation.y = -0.2;
    scene.add(deckShadow);

    // 5. Dynamic Biological Entities per Lane
    const playerEntityMap: Array<{ uid: string; handle: Entity3DHandle } | null> = [
      null,
      null,
      null,
    ];
    const enemyEntityMap: Array<{ uid: string; handle: Entity3DHandle } | null> = [
      null,
      null,
      null,
    ];

    const disposeEntityHandle = (handle: Entity3DHandle) => {
      scene.remove(handle.root);
      handle.root.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material?.dispose();
        }
      });
    };

    // 6. Action Beam + Shockwave Ring + Played Card Arc
    const beamGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 12);
    beamGeo.rotateX(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    const actionBeam = new THREE.Mesh(beamGeo, beamMat);
    actionBeam.visible = false;
    scene.add(actionBeam);
    let beamTimer = 0;

    const waveGeo = new THREE.RingGeometry(0.18, 0.34, 32);
    waveGeo.rotateX(-Math.PI / 2);
    const waveMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const shockwaveRing = new THREE.Mesh(waveGeo, waveMat);
    shockwaveRing.visible = false;
    scene.add(shockwaveRing);
    let waveTimer = 0;

    const playedCardGeo = new THREE.BoxGeometry(0.95, 0.018, 1.34);
    let currentCardTex = createPlayedCardTexture('Inmunologia', 'Duelo Clínico', maxAniso);
    const playedCardTopMat = new THREE.MeshStandardMaterial({
      map: currentCardTex,
      roughness: 0.4,
      metalness: 0.05,
    });
    const playedCardSideMat = new THREE.MeshStandardMaterial({
      color: 0x0f1b28,
      roughness: 0.5,
    });
    const playedCardMesh = new THREE.Mesh(playedCardGeo, [
      playedCardSideMat,
      playedCardSideMat,
      playedCardTopMat,
      playedCardSideMat,
      playedCardSideMat,
      playedCardSideMat,
    ]);
    playedCardMesh.visible = false;
    playedCardMesh.castShadow = true;
    scene.add(playedCardMesh);
    let cardFlightT = 0;
    let cardVisibleTimer = 0;

    // 7. Pooled Particle System
    const PARTICLE_COUNT = 84;
    const pPositions = new Float32Array(PARTICLE_COUNT * 3);
    const pVelocities = new Float32Array(PARTICLE_COUNT * 3);
    const pLife = new Float32Array(PARTICLE_COUNT);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x10b981,
      size: 0.095,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particlePoints = new THREE.Points(pGeo, pMat);
    particlePoints.frustumCulled = false;
    scene.add(particlePoints);
    let particleBurstTimer = 0;

    const triggerBurst = (
      colorHex: number,
      ox: number,
      oy: number,
      oz: number,
      upward = false,
    ) => {
      pMat.color.setHex(colorHex);
      particleBurstTimer = 1.0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = upward ? 0.4 + Math.random() * 0.9 : 0.9 + Math.random() * 2.1;
        pPositions[i * 3] = ox + (Math.random() - 0.5) * 0.4;
        pPositions[i * 3 + 1] = oy + (Math.random() - 0.5) * 0.3;
        pPositions[i * 3 + 2] = oz + (Math.random() - 0.5) * 0.4;

        pVelocities[i * 3] = Math.cos(angle) * speed;
        pVelocities[i * 3 + 1] = upward
          ? 1.4 + Math.random() * 1.4
          : 0.6 + Math.random() * 1.8;
        pVelocities[i * 3 + 2] = Math.sin(angle) * speed;
        pLife[i] = 0.55 + Math.random() * 0.35;
      }
      (pGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    };

    // 8. Interactive 3D Slot Pads
    const padHitGeo = new THREE.BoxGeometry(1.38, 0.9, 1.38);
    const padHitMat = new THREE.MeshBasicMaterial({ visible: false });
    const padRingGeo = new THREE.RingGeometry(0.46, 0.56, 36);
    padRingGeo.rotateX(-Math.PI / 2);

    const playerPadRings: THREE.Mesh[] = [];
    const enemyPadRings: THREE.Mesh[] = [];
    const playerSlotHits: THREE.Mesh[] = [];
    const enemySlotHits: THREE.Mesh[] = [];

    PLAYER_SLOT_POS.forEach((pos, idx) => {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(padRingGeo, ringMat);
      ring.position.set(pos[0], 0.072, pos[2]);
      scene.add(ring);
      playerPadRings.push(ring);

      const hit = new THREE.Mesh(padHitGeo, padHitMat);
      hit.position.set(pos[0], 0.45, pos[2]);
      hit.layers.set(1);
      hit.userData = { interactiveType: 'player_slot', lane: idx };
      scene.add(hit);
      playerSlotHits.push(hit);
    });

    ENEMY_SLOT_POS.forEach((pos, idx) => {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(padRingGeo, ringMat);
      ring.position.set(pos[0], 0.072, pos[2]);
      scene.add(ring);
      enemyPadRings.push(ring);

      const hit = new THREE.Mesh(padHitGeo, padHitMat);
      hit.position.set(pos[0], 0.45, pos[2]);
      hit.layers.set(1);
      hit.userData = { interactiveType: 'enemy_slot', lane: idx };
      scene.add(hit);
      enemySlotHits.push(hit);
    });

    // Raycasting with pointerup + drag threshold (A13)
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    let interactiveProxies: THREE.Object3D[] = [
      activeOrganRig.hitProxy,
      deckHit,
      ...playerSlotHits,
      ...enemySlotHits,
    ];
    let lastHoverCheck = 0;
    let downX = 0;
    let downY = 0;
    let pointerDownActive = false;

    const updateRayMouse = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _rayMouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _rayMouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 60) return;
      lastHoverCheck = now;
      updateRayMouse(e);
      raycaster.setFromCamera(_rayMouse, camera);
      const hits = raycaster.intersectObjects(interactiveProxies, false);
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      pointerDownActive = true;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDownActive) return;
      pointerDownActive = false;
      if (telemetryRef.current.gameState !== 'PLAYING') return;
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist > 6) return; // Dragged to orbit -> ignore click

      updateRayMouse(e);
      raycaster.setFromCamera(_rayMouse, camera);
      const hits = raycaster.intersectObjects(interactiveProxies, false);
      if (hits.length > 0) {
        const data = hits[0].object.userData;
        if (data.interactiveType === 'player_slot') {
          playerSlotCbRef.current(data.lane);
        } else if (data.interactiveType === 'enemy_slot') {
          enemySlotCbRef.current(data.lane);
        } else if (data.interactiveType === 'organ' || data.interactiveType === 'heart') {
          inspectCbRef.current();
          triggerBurst(telemetryRef.current.organAccentHex || 0x38bdf8, 0, 0.9, -0.1, true);
        } else if (data.interactiveType === 'deck') {
          deckCbRef.current();
        }
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      fallbackCbRef.current?.();
    };
    const onContextRestored = () => {
      if (!isSoftwareGl) renderer.compile(scene, camera);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    if (!isSoftwareGl) renderer.compile(scene, camera);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(
        isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
      );
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let screenUpdateAccum = 0;
    let shakeAmplitude = 0;
    let organHighlightPulse = 0;
    let eventCooldown = 0;

    const scheduleNext = (cb: () => void) => {
      if (disposed || document.hidden) return;
      if (isSoftwareGl) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed || document.hidden) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = requestAnimationFrame(cb);
      }
    };

    const onVisibilityChange = () => {
      if (!document.hidden && !disposed) {
        clock.getDelta();
        scheduleNext(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    function tick() {
      if (disposed || document.hidden) return;

      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.elapsedTime;
      const tel = telemetryRef.current;

      // 0. Hot-swap Central Organ 3D Rig when organId changes across Endless Guard levels
      if (activeOrganRig.organId !== tel.organId) {
        scene.remove(activeOrganRig.root);
        activeOrganRig.dispose();
        activeOrganRig = createOrganRig(tel.organId, mats, isSoftwareGl);
        activeOrganRig.root.position.set(0, 0.055, -0.1);
        activeOrganRig.root.scale.setScalar(0.72);
        scene.add(activeOrganRig.root);
        interactiveProxies = [
          activeOrganRig.hitProxy,
          deckHit,
          ...playerSlotHits,
          ...enemySlotHits,
        ];
        organHighlightPulse = 1.0;
      }

      // 1. Sync 3D Biological Entities with Engine Slots
      for (let i = 0; i < 3; i++) {
        const pUnit = tel.playerSlots[i];
        const existingP = playerEntityMap[i];
        if (!pUnit && existingP) {
          disposeEntityHandle(existingP.handle);
          playerEntityMap[i] = null;
        } else if (pUnit && (!existingP || existingP.uid !== pUnit.uid)) {
          if (existingP) disposeEntityHandle(existingP.handle);
          const handle = createBioEntityMesh(pUnit.archetype);
          const pos = PLAYER_SLOT_POS[i];
          handle.root.position.set(pos[0], pos[1], pos[2]);
          handle.root.scale.setScalar(0.15);
          scene.add(handle.root);
          playerEntityMap[i] = { uid: pUnit.uid, handle };
        }

        const eUnit = tel.enemySlots[i];
        const existingE = enemyEntityMap[i];
        if (!eUnit && existingE) {
          disposeEntityHandle(existingE.handle);
          enemyEntityMap[i] = null;
        } else if (eUnit && (!existingE || existingE.uid !== eUnit.uid)) {
          if (existingE) disposeEntityHandle(existingE.handle);
          const handle = createBioEntityMesh(eUnit.archetype);
          const pos = ENEMY_SLOT_POS[i];
          handle.root.position.set(pos[0], pos[1], pos[2]);
          handle.root.scale.setScalar(0.15);
          scene.add(handle.root);
          enemyEntityMap[i] = { uid: eUnit.uid, handle };
        }
      }

      // 2. Animate Idle, Status Rings, Directional Lunges & Slot Pads
      const pulseWave = 0.5 + 0.5 * Math.sin(elapsed * 5.2);

      for (let i = 0; i < 3; i++) {
        const pEntry = playerEntityMap[i];
        const pUnit = tel.playerSlots[i];
        if (pEntry && pUnit) {
          const h = pEntry.handle;
          const isSelectedAttacker =
            tel.phase === 'COMBATE' && tel.selectedAttackerLane === i;
          const targetS = (isSelectedAttacker ? 1.15 : 1.0) + h.pulseBoost * 0.35;
          h.root.scale.x = THREE.MathUtils.damp(h.root.scale.x, targetS, 9, dt);
          h.root.scale.y = THREE.MathUtils.damp(h.root.scale.y, targetS, 9, dt);
          h.root.scale.z = THREE.MathUtils.damp(h.root.scale.z, targetS, 9, dt);
          h.pulseBoost = THREE.MathUtils.damp(h.pulseBoost, 0, 7, dt);
          h.lungeX = THREE.MathUtils.damp(h.lungeX, 0, 8, dt);
          h.lungeZ = THREE.MathUtils.damp(h.lungeZ, 0, 8, dt);

          h.bodyGroup.position.y = 0.42 + Math.sin(elapsed * 2.6 + i) * 0.045;
          h.bodyGroup.position.x = h.lungeX;
          h.bodyGroup.position.z = h.lungeZ;
          h.bodyGroup.rotation.y += dt * (h.archetype === 'unidad_qx' ? 0.6 : 1.0);

          h.shieldRing.visible = Boolean(pUnit.statuses.escudo);
          h.stunRing.visible = Boolean(pUnit.statuses.aturdido);
        }

        const pRing = playerPadRings[i];
        const pMat = pRing.material as THREE.MeshBasicMaterial;
        const canPlaceEmpty = tel.selectingSummonOrMove && !pUnit;
        const isAllyTarget = tel.selectingAllyTarget && Boolean(pUnit);
        const isPendingCombat =
          tel.phase === 'COMBATE' &&
          pUnit !== null &&
          !pUnit.hasAttackedThisTurn &&
          !pUnit.statuses.aturdido;
        const isAttacker = tel.phase === 'COMBATE' && tel.selectedAttackerLane === i;

        if (isAttacker) {
          pMat.color.setHex(0xfbbf24);
          pMat.opacity = 0.9;
          pRing.scale.setScalar(1.22 + pulseWave * 0.08);
        } else if (canPlaceEmpty || isAllyTarget) {
          pMat.color.setHex(0x10b981);
          pMat.opacity = 0.55 + pulseWave * 0.35;
          pRing.scale.setScalar(1.12 + pulseWave * 0.08);
        } else if (isPendingCombat) {
          pMat.color.setHex(0xf59e0b);
          pMat.opacity = 0.45 + pulseWave * 0.3;
          pRing.scale.setScalar(1.08);
        } else {
          pMat.color.setHex(0x10b981);
          pMat.opacity = pUnit ? 0.28 : 0.14;
          pRing.scale.setScalar(1.0);
        }

        const eEntry = enemyEntityMap[i];
        const eUnit = tel.enemySlots[i];
        if (eEntry && eUnit) {
          const h = eEntry.handle;
          const targetS = 1.0 + h.pulseBoost * 0.3;
          h.root.scale.x = THREE.MathUtils.damp(h.root.scale.x, targetS, 9, dt);
          h.root.scale.y = THREE.MathUtils.damp(h.root.scale.y, targetS, 9, dt);
          h.root.scale.z = THREE.MathUtils.damp(h.root.scale.z, targetS, 9, dt);
          h.pulseBoost = THREE.MathUtils.damp(h.pulseBoost, 0, 7, dt);
          h.lungeX = THREE.MathUtils.damp(h.lungeX, 0, 8, dt);
          h.lungeZ = THREE.MathUtils.damp(h.lungeZ, 0, 8, dt);

          h.bodyGroup.position.y = 0.42 + Math.cos(elapsed * 2.4 + i) * 0.045;
          h.bodyGroup.position.x = h.lungeX;
          h.bodyGroup.position.z = h.lungeZ;
          h.bodyGroup.rotation.y -= dt * 0.9;

          h.opsonizedRing.visible = Boolean(eUnit.statuses.opsonizado);
          if (h.opsonizedRing.visible) {
            h.opsonizedRing.rotation.x += dt * 2.8;
            h.opsonizedRing.rotation.y += dt * 1.9;
          }
          h.biofilmShell.visible = Boolean(eUnit.statuses.biofilm);
          h.stunRing.visible = Boolean(eUnit.statuses.aturdido);
          if (h.stunRing.visible) {
            h.stunRing.rotation.z += dt * 4.0;
          }
        }

        const eRing = enemyPadRings[i];
        const eMat = eRing.material as THREE.MeshBasicMaterial;
        const canAttackOrTreat =
          Boolean(eUnit) &&
          (tel.selectingEnemyTarget ||
            (tel.phase === 'COMBATE' && tel.selectedAttackerLane !== null));
        if (canAttackOrTreat) {
          eMat.color.setHex(0xfb7185);
          eMat.opacity = 0.55 + pulseWave * 0.35;
          eRing.scale.setScalar(1.15 + pulseWave * 0.08);
        } else {
          eMat.color.setHex(0xf43f5e);
          eMat.opacity = eUnit ? 0.25 : 0.1;
          eRing.scale.setScalar(1.0);
        }
      }

      // 3. Played Card Arc
      if (cardTriggerRef.current) {
        const meta = cardTriggerRef.current;
        cardTriggerRef.current = null;
        currentCardTex.dispose();
        currentCardTex = createPlayedCardTexture(meta.medicalClass, meta.name, maxAniso);
        playedCardTopMat.map = currentCardTex;
        playedCardTopMat.needsUpdate = true;
        playedCardMesh.visible = true;
        cardFlightT = 0;
        cardVisibleTimer = 1.5;
      }

      // 4. Ordered Combat Event Queue Playback
      eventCooldown = Math.max(0, eventCooldown - dt);
      if (eventCooldown === 0 && eventQueueRef.current.length > 0) {
        const evt = eventQueueRef.current.shift()!;
        eventCooldown = 0.14;

        const srcPos =
          evt.sourceLane >= 0
            ? (evt.sourceSide === 'player' ? PLAYER_SLOT_POS : ENEMY_SLOT_POS)[
                evt.sourceLane
              ]
            : [0, 0.6, 0.5];
        const dstPos =
          evt.targetLane >= 0
            ? (evt.targetSide === 'player' ? PLAYER_SLOT_POS : ENEMY_SLOT_POS)[
                evt.targetLane
              ]
            : evt.targetSide === 'enemy'
              ? [0, 0.5, -2.5]
              : [0, 0.5, 2.3];

        if (evt.sourceSide === 'player' && evt.sourceLane >= 0) {
          const h = playerEntityMap[evt.sourceLane]?.handle;
          if (h) {
            const dx = dstPos[0] - srcPos[0];
            const dz = dstPos[2] - srcPos[2];
            const len = Math.hypot(dx, dz) || 1;
            const mag = evt.animKind === 'phagocytosis' ? 2.1 : 1.05;
            h.lungeX = (dx / len) * mag;
            h.lungeZ = (dz / len) * mag;
            h.pulseBoost = evt.animKind === 'phagocytosis' ? 1.2 : 0.7;
          }
        } else if (evt.sourceSide === 'enemy' && evt.sourceLane >= 0) {
          const h = enemyEntityMap[evt.sourceLane]?.handle;
          if (h) {
            h.lungeX = 0;
            h.lungeZ = 0.95;
            h.pulseBoost = 0.65;
          }
        }

        if (evt.animKind === 'summon' || evt.animKind === 'infect') {
          waveMat.color.setHex(evt.colorHex);
          shockwaveRing.position.set(dstPos[0], 0.08, dstPos[2]);
          shockwaveRing.scale.setScalar(0.5);
          shockwaveRing.visible = true;
          waveTimer = 0.45;
          triggerBurst(evt.colorHex, dstPos[0], 0.4, dstPos[2], true);
        } else if (evt.animKind === 'heal' || evt.animKind === 'mitosis') {
          triggerBurst(0x10b981, dstPos[0], 0.35, 1.15, true);
          organHighlightPulse = 0.9;
        } else if (evt.animKind === 'opsonize' || evt.animKind === 'trap') {
          waveMat.color.setHex(evt.animKind === 'trap' ? 0xa855f7 : 0x38bdf8);
          shockwaveRing.position.set(dstPos[0], 0.3, dstPos[2]);
          shockwaveRing.scale.setScalar(0.4);
          shockwaveRing.visible = true;
          waveTimer = 0.5;
          triggerBurst(
            evt.animKind === 'trap' ? 0xa855f7 : 0x38bdf8,
            dstPos[0],
            0.55,
            dstPos[2],
            true,
          );
        } else {
          _beamStart.set(srcPos[0], 0.48, srcPos[2]);
          _beamEnd.set(dstPos[0], 0.48, dstPos[2]);
          _beamMid.addVectors(_beamStart, _beamEnd).multiplyScalar(0.5);
          const dist = _beamStart.distanceTo(_beamEnd);
          actionBeam.position.copy(_beamMid);
          actionBeam.scale.set(1, 1, Math.max(0.2, dist));
          actionBeam.lookAt(_beamEnd);
          beamMat.color.setHex(evt.colorHex);
          actionBeam.visible = true;
          beamTimer = 0.42;

          triggerBurst(evt.colorHex, dstPos[0], 0.55, dstPos[2], false);
          if (!reducedMotionRef.current) {
            shakeAmplitude = evt.isCritical ? 0.13 : 0.075;
          }
          organHighlightPulse = 1.0;
        }
      }

      // 5. Erythrocyte Flow
      const laneX = [-2.1, 0, 2.1];
      for (let i = 0; i < bloodstream.phases.length; i++) {
        bloodstream.phases[i] = (bloodstream.phases[i] + dt * bloodstream.speeds[i]) % 1;
        const z = -2.35 + bloodstream.phases[i] * 4.7;
        const x = laneX[i % 3] + Math.sin(elapsed * 1.4 + i) * 0.24;
        _dummyObj.position.set(x, 0.072, z);
        _dummyObj.rotation.set(elapsed * 0.4 + i, elapsed * 0.6, 0.2);
        _dummyObj.scale.setScalar(0.85);
        _dummyObj.updateMatrix();
        bloodstream.mesh.setMatrixAt(i, _dummyObj.matrix);
      }
      bloodstream.mesh.instanceMatrix.needsUpdate = true;

      // 6. Beam & Shockwave Fades
      if (beamTimer > 0) {
        beamTimer = Math.max(0, beamTimer - dt);
        beamMat.opacity = (beamTimer / 0.42) * 0.92;
        if (beamTimer === 0) actionBeam.visible = false;
      }

      if (waveTimer > 0) {
        waveTimer = Math.max(0, waveTimer - dt);
        const p = 1 - waveTimer / 0.45;
        shockwaveRing.scale.setScalar(0.5 + p * 2.4);
        waveMat.opacity = (1 - p) * 0.85;
        if (waveTimer === 0) shockwaveRing.visible = false;
      }

      // 7. Active Organ Rig Dynamics & Telemetry Color
      activeOrganRig.update(dt, elapsed, tel, organHighlightPulse);
      organHighlightPulse = THREE.MathUtils.damp(organHighlightPulse, 0, 5, dt);

      const danger = tel.playerLp <= 1200 || tel.isCritical;
      const targetColor = danger ? 0xf43f5e : tel.organAccentHex || 0x10b981;
      mats.glowRing.color.setHex(targetColor);
      mats.glowRing.emissive.setHex(targetColor);
      bioPointLight.color.setHex(targetColor);
      bioPointLight.intensity = 1.0 + organHighlightPulse * 1.25;

      // 8. Played Card Flight
      if (playedCardMesh.visible) {
        cardFlightT = Math.min(1, cardFlightT + dt * 3.5);
        const ease = 1 - Math.pow(1 - cardFlightT, 3);
        playedCardMesh.position.set(
          0,
          THREE.MathUtils.lerp(0.9, 0.085, ease) + Math.sin(ease * Math.PI) * 0.5,
          THREE.MathUtils.lerp(2.7, 0.35, ease),
        );
        playedCardMesh.rotation.x = THREE.MathUtils.lerp(-0.5, 0, ease);
        cardVisibleTimer -= dt;
        if (cardVisibleTimer <= 0) playedCardMesh.visible = false;
      }

      // 9. Particle Burst
      if (particleBurstTimer > 0) {
        particleBurstTimer = Math.max(0, particleBurstTimer - dt * 1.25);
        pMat.opacity = particleBurstTimer;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          if (pLife[i] > 0) {
            pLife[i] -= dt;
            pPositions[i * 3] += pVelocities[i * 3] * dt;
            pPositions[i * 3 + 1] += pVelocities[i * 3 + 1] * dt;
            pPositions[i * 3 + 2] += pVelocities[i * 3 + 2] * dt;
            pVelocities[i * 3 + 1] -= 2.2 * dt;
          }
        }
        (pGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      } else if (pMat.opacity !== 0) {
        pMat.opacity = 0;
      }

      // 10. Monitor Update
      screenUpdateAccum += dt;
      if (screenUpdateAccum >= 0.042) {
        screenUpdateAccum = 0;
        monitorScreen.update(0.042, tel);
      }

      // 11. Camera Damping
      if (tel.gameState === 'TITLE_MENU') {
        const angle = elapsed * 0.16;
        _desiredPos.set(Math.sin(angle) * 1.6 - 0.6, 3.9, 6.6);
        _desiredLook.set(-1.05, 0.8, -0.2);
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredPos.x, 3.2, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredPos.y, 3.2, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredPos.z, 3.2, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _desiredLook.x, 3.2, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _desiredLook.y, 3.2, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _desiredLook.z, 3.2, dt);
        controls.enabled = false;
      } else {
        controls.enabled = true;
        if (transitionActiveRef.current && !userOrbitingRef.current) {
          const cfg = CAMERA_TARGETS[presetRef.current] ?? CAMERA_TARGETS.overview;
          _desiredPos.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
          _desiredLook.set(cfg.look[0], cfg.look[1], cfg.look[2]);
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _desiredPos.x, 5.5, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _desiredPos.y, 5.5, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _desiredPos.z, 5.5, dt);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, _desiredLook.x, 5.5, dt);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, _desiredLook.y, 5.5, dt);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, _desiredLook.z, 5.5, dt);

          if (camera.position.distanceTo(_desiredPos) < 0.03) {
            transitionActiveRef.current = false;
          }
        }
      }

      controls.update();

      if (shakeAmplitude > 0.002 && !reducedMotionRef.current) {
        camera.position.x += (Math.random() - 0.5) * shakeAmplitude;
        camera.position.y += (Math.random() - 0.5) * shakeAmplitude;
        shakeAmplitude = THREE.MathUtils.damp(shakeAmplitude, 0, 12, dt);
      } else {
        shakeAmplitude = 0;
      }

      renderer.render(scene, camera);

      // 12. Project 3D Slot Anchors relative to actual canvas rect (inerts when out-of-frustum)
      const rect = renderer.domElement.getBoundingClientRect();
      const viewW = rect.width || window.innerWidth;
      const viewH = rect.height || window.innerHeight;
      for (let i = 0; i < 3; i++) {
        const pEl = slotAnchorRefs.current.player[i];
        if (pEl) {
          const pos = PLAYER_SLOT_POS[i];
          const zOffset = tel.playerSlots[i] ? 0.52 : 0.0;
          const yOffset = tel.playerSlots[i] ? 0.06 : 0.14;
          _projVec.set(pos[0], yOffset, pos[2] + zOffset).project(camera);
          const visible =
            _projVec.z >= -1 &&
            _projVec.z <= 1 &&
            _projVec.x >= -1.05 &&
            _projVec.x <= 1.05 &&
            _projVec.y >= -1.05 &&
            _projVec.y <= 1.05;
          const sx = rect.left + (_projVec.x * 0.5 + 0.5) * viewW;
          const sy = rect.top + (-_projVec.y * 0.5 + 0.5) * viewH;
          pEl.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0) translate(-50%, -50%)`;
          pEl.style.opacity = visible ? '1' : '0';
          pEl.style.visibility = visible ? 'visible' : 'hidden';
          pEl.style.pointerEvents = visible ? 'auto' : 'none';
        }

        const eEl = slotAnchorRefs.current.enemy[i];
        if (eEl) {
          const pos = ENEMY_SLOT_POS[i];
          _projVec.set(pos[0], 0.06, pos[2] - 0.54).project(camera);
          const visible =
            _projVec.z >= -1 &&
            _projVec.z <= 1 &&
            _projVec.x >= -1.05 &&
            _projVec.x <= 1.05 &&
            _projVec.y >= -1.05 &&
            _projVec.y <= 1.05;
          const sx = rect.left + (_projVec.x * 0.5 + 0.5) * viewW;
          const sy = rect.top + (-_projVec.y * 0.5 + 0.5) * viewH;
          eEl.style.transform = `translate3d(${Math.round(sx)}px, ${Math.round(sy)}px, 0) translate(-50%, -50%)`;
          eEl.style.opacity = visible ? '1' : '0';
          eEl.style.visibility = visible ? 'visible' : 'hidden';
          eEl.style.pointerEvents = visible ? 'auto' : 'none';
        }
      }

      scheduleNext(tick);
    }

    transitionActiveRef.current = true;
    monitorScreen.update(0.016, telemetryRef.current);
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      playerEntityMap.forEach((entry) => entry && disposeEntityHandle(entry.handle));
      enemyEntityMap.forEach((entry) => entry && disposeEntityHandle(entry.handle));
      activeOrganRig.dispose();

      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh ||
          obj instanceof THREE.InstancedMesh ||
          obj instanceof THREE.Points
        ) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material?.dispose();
        }
      });

      matTexture.dispose();
      brushedMap.dispose();
      shadowTexture.dispose();
      cardBackTexture.dispose();
      currentCardTex.dispose();
      monitorScreen.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-screen h-[100dvh] overflow-hidden bg-[#081018]"
      aria-label="Arena microvascular 3D interactiva"
    />
  );
}
