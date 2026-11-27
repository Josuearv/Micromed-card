import * as THREE from 'three';
import { VitalMonitorScreen } from './textures';

export interface MedicalMaterials {
  titanium: THREE.MeshStandardMaterial;
  darkSlate: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  heartTissue: THREE.MeshPhysicalMaterial;
  arteryRed: THREE.MeshStandardMaterial;
  veinBlue: THREE.MeshStandardMaterial;
  glowRing: THREE.MeshStandardMaterial;
  serumEmerald: THREE.MeshStandardMaterial;
  serumCyan: THREE.MeshStandardMaterial;
  serumAmber: THREE.MeshStandardMaterial;
  serumCoral: THREE.MeshStandardMaterial;
}

export function createMedicalMaterials(
  brushedRoughnessMap: THREE.CanvasTexture,
  isSoftwareGl: boolean,
): MedicalMaterials {
  return {
    titanium: new THREE.MeshStandardMaterial({
      color: 0x8a99ad,
      metalness: 0.85,
      roughness: 0.28,
      roughnessMap: brushedRoughnessMap,
    }),
    darkSlate: new THREE.MeshStandardMaterial({
      color: 0x16202c,
      metalness: 0.15,
      roughness: 0.72,
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.94,
      roughness: 0.12,
    }),
    rubber: new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.0,
      roughness: 0.88,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe,
      metalness: 0.0,
      roughness: 0.06,
      transmission: isSoftwareGl ? 0 : 0.88,
      transparent: true,
      opacity: isSoftwareGl ? 0.32 : 1,
      ior: 1.5,
      thickness: 0.4,
      depthWrite: false,
    }),
    heartTissue: new THREE.MeshPhysicalMaterial({
      color: 0xd9384a,
      emissive: 0x5c0f1a,
      emissiveIntensity: 0.55,
      metalness: 0.08,
      roughness: 0.34,
      clearcoat: 0.65,
      clearcoatRoughness: 0.2,
    }),
    arteryRed: new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x450a0a,
      emissiveIntensity: 0.4,
      metalness: 0.1,
      roughness: 0.42,
    }),
    veinBlue: new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.45,
      metalness: 0.12,
      roughness: 0.38,
    }),
    glowRing: new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 1.15,
      metalness: 0.3,
      roughness: 0.25,
    }),
    serumEmerald: new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x064e3b,
      emissiveIntensity: 0.45,
      metalness: 0.05,
      roughness: 0.18,
    }),
    serumCyan: new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.45,
      metalness: 0.05,
      roughness: 0.18,
    }),
    serumAmber: new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0x78350f,
      emissiveIntensity: 0.4,
      metalness: 0.05,
      roughness: 0.18,
    }),
    serumCoral: new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.4,
      metalness: 0.05,
      roughness: 0.18,
    }),
  };
}

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

export function createContactShadowPlane(
  shadowTexture: THREE.CanvasTexture,
  width: number,
  depth: number,
  opacity = 0.44,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, depth);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.008;
  return mesh;
}

export function createSurgicalTable(
  mats: MedicalMaterials,
  matTexture: THREE.CanvasTexture,
): THREE.Group {
  const group = new THREE.Group();

  // Primary tabletop slab (beveled extrude)
  const slabShape = createRoundedRectShape(11.6, 7.6, 0.45);
  const slabGeo = new THREE.ExtrudeGeometry(slabShape, {
    depth: 0.28,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.05,
    bevelSegments: 3,
  });
  slabGeo.rotateX(Math.PI / 2);
  const slab = new THREE.Mesh(slabGeo, mats.darkSlate);
  slab.position.y = 0;
  slab.receiveShadow = true;
  group.add(slab);

  // Anodized titanium perimeter bumper frame
  const railShape = createRoundedRectShape(11.95, 7.95, 0.52);
  const hole = createRoundedRectShape(11.45, 7.45, 0.42);
  railShape.holes.push(hole);
  const railGeo = new THREE.ExtrudeGeometry(railShape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
  });
  railGeo.rotateX(Math.PI / 2);
  const rail = new THREE.Mesh(railGeo, mats.titanium);
  rail.position.y = -0.02;
  rail.receiveShadow = true;
  group.add(rail);

  // Calibrated sterile surgical mat sitting flush above slab (+0.024 offset)
  const matGeo = new THREE.PlaneGeometry(9.6, 5.8);
  matGeo.rotateX(-Math.PI / 2);
  const matMaterial = new THREE.MeshStandardMaterial({
    map: matTexture,
    roughness: 0.78,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const surgicalMat = new THREE.Mesh(matGeo, matMaterial);
  surgicalMat.position.set(0, 0.055, 0.1);
  surgicalMat.receiveShadow = true;
  group.add(surgicalMat);

  return group;
}

export function createVitalMonitorRig(
  mats: MedicalMaterials,
  screen: VitalMonitorScreen,
): THREE.Group {
  const group = new THREE.Group();

  // 1. Weighted Lathe pedestal base (bottom at y=0)
  const baseProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.72, 0),
    new THREE.Vector2(0.7, 0.06),
    new THREE.Vector2(0.45, 0.14),
    new THREE.Vector2(0.22, 0.18),
    new THREE.Vector2(0, 0.18),
  ];
  const baseGeo = new THREE.LatheGeometry(baseProfile, 32);
  const baseMesh = new THREE.Mesh(baseGeo, mats.titanium);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);

  // 2. Articulated curved gimbal arm (TubeGeometry)
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.14, 0),
    new THREE.Vector3(0, 0.85, -0.18),
    new THREE.Vector3(0, 1.48, 0.04),
  ]);
  const armGeo = new THREE.TubeGeometry(armCurve, 24, 0.08, 16, false);
  const armMesh = new THREE.Mesh(armGeo, mats.chrome);
  armMesh.castShadow = true;
  group.add(armMesh);

  // 3. Gimbal joint collar
  const collarGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.24, 20);
  collarGeo.rotateZ(Math.PI / 2);
  const collar = new THREE.Mesh(collarGeo, mats.darkSlate);
  collar.position.set(0, 1.48, 0.04);
  group.add(collar);

  // 4. Beveled monitor chassis
  const monitorTiltGroup = new THREE.Group();
  monitorTiltGroup.position.set(0, 1.56, 0.18);
  monitorTiltGroup.rotation.x = -0.16;

  const chassisShape = createRoundedRectShape(2.9, 1.85, 0.14);
  const chassisGeo = new THREE.ExtrudeGeometry(chassisShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 3,
  });
  const chassis = new THREE.Mesh(chassisGeo, mats.darkSlate);
  chassis.position.z = -0.18;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  monitorTiltGroup.add(chassis);

  // 5. Titanium bezel frame around display
  const bezelShape = createRoundedRectShape(2.74, 1.69, 0.08);
  const screenHole = createRoundedRectShape(2.56, 1.52, 0.04);
  bezelShape.holes.push(screenHole);
  const bezelGeo = new THREE.ExtrudeGeometry(bezelShape, {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 2,
  });
  const bezel = new THREE.Mesh(bezelGeo, mats.titanium);
  bezel.position.z = 0.01;
  monitorTiltGroup.add(bezel);

  // 6. Live ECG canvas display plane
  const displayGeo = new THREE.PlaneGeometry(2.56, 1.52);
  const displayMat = new THREE.MeshBasicMaterial({
    map: screen.texture,
  });
  const display = new THREE.Mesh(displayGeo, displayMat);
  display.position.z = 0.032;
  monitorTiltGroup.add(display);

  // 7. Side alarm indicator bar
  const barGeo = new THREE.BoxGeometry(0.12, 0.56, 0.04);
  const bar = new THREE.Mesh(barGeo, mats.glowRing);
  bar.position.set(1.42, 0.42, 0.01);
  monitorTiltGroup.add(bar);

  group.add(monitorTiltGroup);
  return group;
}

export interface HeartRigHandles {
  root: THREE.Group;
  heartPivot: THREE.Group;
  outerRing: THREE.Mesh;
  innerRing: THREE.Mesh;
  coreMesh: THREE.Mesh;
  hitProxy: THREE.Mesh;
}

export function createAnatomicalHeartRig(mats: MedicalMaterials): HeartRigHandles {
  const root = new THREE.Group();

  // 1. Machined emitter pedestal (bottom-center y=0)
  const pedProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(1.05, 0),
    new THREE.Vector2(1.02, 0.08),
    new THREE.Vector2(0.84, 0.14),
    new THREE.Vector2(0.76, 0.22),
    new THREE.Vector2(0.55, 0.24),
    new THREE.Vector2(0, 0.24),
  ];
  const pedGeo = new THREE.LatheGeometry(pedProfile, 40);
  const pedestal = new THREE.Mesh(pedGeo, mats.darkSlate);
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  root.add(pedestal);

  // 2. Titanium emitter collar ring
  const collarGeo = new THREE.TorusGeometry(0.84, 0.045, 16, 48);
  collarGeo.rotateX(Math.PI / 2);
  const collar = new THREE.Mesh(collarGeo, mats.titanium);
  collar.position.y = 0.15;
  root.add(collar);

  // 3. Glowing bio-telemetry base ring
  const glowRingGeo = new THREE.TorusGeometry(0.64, 0.025, 12, 48);
  glowRingGeo.rotateX(Math.PI / 2);
  const innerRing = new THREE.Mesh(glowRingGeo, mats.glowRing);
  innerRing.position.y = 0.25;
  root.add(innerRing);

  // 4. Translucent glass containment ring
  const glassCylGeo = new THREE.CylinderGeometry(0.72, 0.78, 0.22, 36, 1, true);
  const glassCollar = new THREE.Mesh(glassCylGeo, mats.glass);
  glassCollar.position.y = 0.34;
  glassCollar.renderOrder = 4;
  root.add(glassCollar);

  // 5. Rotating orbital diagnostic ring
  const outerRingGeo = new THREE.TorusGeometry(0.95, 0.022, 12, 64);
  const outerRing = new THREE.Mesh(outerRingGeo, mats.veinBlue);
  outerRing.position.y = 1.15;
  outerRing.rotation.x = Math.PI / 3;
  root.add(outerRing);

  // 6. Anatomical Heart Sculpture Pivot
  const heartPivot = new THREE.Group();
  heartPivot.position.y = 1.15;

  // Left & Right Ventricular Myocardium (Lathe sculpted chamber)
  const heartProfile = [
    new THREE.Vector2(0.01, -0.46),
    new THREE.Vector2(0.18, -0.34),
    new THREE.Vector2(0.38, -0.1),
    new THREE.Vector2(0.44, 0.16),
    new THREE.Vector2(0.32, 0.36),
    new THREE.Vector2(0.01, 0.42),
  ];
  const ventricleGeo = new THREE.LatheGeometry(heartProfile, 32);
  const leftVentricle = new THREE.Mesh(ventricleGeo, mats.heartTissue);
  leftVentricle.scale.set(1.05, 1.0, 0.88);
  leftVentricle.rotation.z = 0.22;
  leftVentricle.castShadow = true;
  heartPivot.add(leftVentricle);

  // Right Atrium / Auricle bulge
  const atriumGeo = new THREE.SphereGeometry(0.24, 24, 24);
  const rightAtrium = new THREE.Mesh(atriumGeo, mats.heartTissue);
  rightAtrium.position.set(-0.26, 0.2, 0.06);
  rightAtrium.scale.set(0.95, 1.15, 0.9);
  rightAtrium.castShadow = true;
  heartPivot.add(rightAtrium);

  // Aortic Arch (TubeGeometry)
  const aortaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, 0.25, 0),
    new THREE.Vector3(0.06, 0.56, 0.04),
    new THREE.Vector3(-0.18, 0.66, -0.04),
    new THREE.Vector3(-0.28, 0.38, -0.14),
  ]);
  const aortaGeo = new THREE.TubeGeometry(aortaCurve, 28, 0.095, 14, false);
  const aorta = new THREE.Mesh(aortaGeo, mats.arteryRed);
  aorta.castShadow = true;
  heartPivot.add(aorta);

  // Superior Vena Cava & Pulmonary Trunk (TubeGeometry)
  const venaCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.28, 0.16, 0.08),
    new THREE.Vector3(-0.34, 0.54, 0.1),
  ]);
  const venaGeo = new THREE.TubeGeometry(venaCurve, 16, 0.075, 12, false);
  const vena = new THREE.Mesh(venaGeo, mats.veinBlue);
  heartPivot.add(vena);

  const pulmCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.12, 0.22, 0.14),
    new THREE.Vector3(0.22, 0.44, 0.05),
    new THREE.Vector3(0.42, 0.42, -0.06),
  ]);
  const pulmGeo = new THREE.TubeGeometry(pulmCurve, 18, 0.07, 12, false);
  const pulmonary = new THREE.Mesh(pulmGeo, mats.veinBlue);
  heartPivot.add(pulmonary);

  // Coronary Pulse Core
  const coreGeo = new THREE.SphereGeometry(0.14, 18, 18);
  const coreMesh = new THREE.Mesh(coreGeo, mats.glowRing);
  coreMesh.position.set(0.08, 0.04, 0.28);
  heartPivot.add(coreMesh);

  root.add(heartPivot);

  // Invisible raycast proxy box for fast hover/click inspection
  const hitGeo = new THREE.CylinderGeometry(0.85, 0.85, 1.9, 12);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitProxy = new THREE.Mesh(hitGeo, hitMat);
  hitProxy.position.y = 1.0;
  hitProxy.userData.interactiveType = 'heart';
  hitProxy.layers.set(1);
  root.add(hitProxy);

  return {
    root,
    heartPivot,
    outerRing,
    innerRing,
    coreMesh,
    hitProxy,
  };
}

export function createStethoscopeModel(mats: MedicalMaterials): THREE.Group {
  const group = new THREE.Group();

  // 1. Machined chestpiece diaphragm (LatheGeometry, y=0 grounded)
  const chestProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.26, 0),
    new THREE.Vector2(0.28, 0.04),
    new THREE.Vector2(0.24, 0.09),
    new THREE.Vector2(0.11, 0.14),
    new THREE.Vector2(0.08, 0.2),
    new THREE.Vector2(0, 0.2),
  ];
  const chestGeo = new THREE.LatheGeometry(chestProfile, 28);
  const chestpiece = new THREE.Mesh(chestGeo, mats.chrome);
  chestpiece.position.set(0, 0, 0.4);
  chestpiece.castShadow = true;
  group.add(chestpiece);

  // 2. Non-chill rubber ring on diaphragm
  const chillGeo = new THREE.TorusGeometry(0.265, 0.02, 10, 32);
  chillGeo.rotateX(Math.PI / 2);
  const chillRing = new THREE.Mesh(chillGeo, mats.rubber);
  chillRing.position.set(0, 0.025, 0.4);
  group.add(chillRing);

  // 3. Acoustic flexible tubing (TubeGeometry resting smoothly on table)
  const tubeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.08, 0.24),
    new THREE.Vector3(-0.35, 0.04, -0.05),
    new THREE.Vector3(-0.55, 0.04, -0.58),
    new THREE.Vector3(-0.18, 0.05, -0.95),
    new THREE.Vector3(0.26, 0.05, -0.78),
  ]);
  const tubeGeo = new THREE.TubeGeometry(tubeCurve, 36, 0.042, 12, false);
  const tubing = new THREE.Mesh(tubeGeo, mats.rubber);
  tubing.castShadow = true;
  group.add(tubing);

  // 4. Chrome binaural headset U-arch
  const binauralCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.26, 0.05, -0.78),
    new THREE.Vector3(0.55, 0.06, -0.45),
    new THREE.Vector3(0.45, 0.07, -0.05),
  ]);
  const binauralGeo = new THREE.TubeGeometry(binauralCurve, 20, 0.028, 10, false);
  const binaural = new THREE.Mesh(binauralGeo, mats.chrome);
  binaural.castShadow = true;
  group.add(binaural);

  // 5. Soft silicone ear tips
  const tipGeo = new THREE.SphereGeometry(0.048, 14, 14);
  const tip1 = new THREE.Mesh(tipGeo, mats.darkSlate);
  tip1.position.set(0.45, 0.07, -0.05);
  group.add(tip1);

  return group;
}

export function createPharmacologyTray(mats: MedicalMaterials): THREE.Group {
  const group = new THREE.Group();

  // 1. Brushed aluminum surgical tray (grounded y=0)
  const trayShape = createRoundedRectShape(1.55, 1.05, 0.12);
  const trayGeo = new THREE.ExtrudeGeometry(trayShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  trayGeo.rotateX(Math.PI / 2);
  const tray = new THREE.Mesh(trayGeo, mats.titanium);
  tray.position.y = 0.06;
  tray.castShadow = true;
  tray.receiveShadow = true;
  group.add(tray);

  // 2. Four LatheGeometry glass vials with distinct therapeutic serums
  const vialProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.085, 0),
    new THREE.Vector2(0.09, 0.24),
    new THREE.Vector2(0.055, 0.3),
    new THREE.Vector2(0.055, 0.37),
    new THREE.Vector2(0.07, 0.39),
    new THREE.Vector2(0, 0.39),
  ];
  const vialGeo = new THREE.LatheGeometry(vialProfile, 20);
  const serumGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.18, 16);
  const capGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.045, 16);

  const serums = [
    mats.serumEmerald,
    mats.serumCyan,
    mats.serumAmber,
    mats.serumCoral,
  ];
  serums.forEach((serumMat, i) => {
    const vx = -0.45 + i * 0.24;
    const vz = -0.22;

    const vial = new THREE.Mesh(vialGeo, mats.glass);
    vial.position.set(vx, 0.08, vz);
    vial.renderOrder = 3;
    group.add(vial);

    const serum = new THREE.Mesh(serumGeo, serumMat);
    serum.position.set(vx, 0.18, vz);
    group.add(serum);

    const cap = new THREE.Mesh(capGeo, mats.chrome);
    cap.position.set(vx, 0.48, vz);
    group.add(cap);
  });

  // 3. Syringe assembly resting on foreground of tray
  const syringeGroup = new THREE.Group();
  syringeGroup.position.set(0.05, 0.15, 0.24);
  syringeGroup.rotation.z = Math.PI / 2;
  syringeGroup.rotation.y = 0.14;

  const barrelGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.56, 16);
  const barrel = new THREE.Mesh(barrelGeo, mats.glass);
  syringeGroup.add(barrel);

  const plungerGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.42, 12);
  const plunger = new THREE.Mesh(plungerGeo, mats.serumCyan);
  plunger.position.y = -0.22;
  syringeGroup.add(plunger);

  const flangeGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.02, 16);
  const flange = new THREE.Mesh(flangeGeo, mats.chrome);
  flange.position.y = -0.28;
  syringeGroup.add(flange);

  const needleGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.24, 8);
  const needle = new THREE.Mesh(needleGeo, mats.chrome);
  needle.position.y = 0.4;
  syringeGroup.add(needle);

  group.add(syringeGroup);
  return group;
}

export function createCardDeckStack(
  mats: MedicalMaterials,
  backTexture: THREE.CanvasTexture,
): { group: THREE.Group; hitProxy: THREE.Mesh } {
  const group = new THREE.Group();

  const cardBackMat = new THREE.MeshStandardMaterial({
    map: backTexture,
    roughness: 0.45,
    metalness: 0.08,
  });

  const cardShape = createRoundedRectShape(0.95, 1.34, 0.06);
  const cardGeo = new THREE.ExtrudeGeometry(cardShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 1,
  });
  cardGeo.rotateX(-Math.PI / 2);

  // Stack 7 physical beveled cards
  for (let i = 0; i < 7; i++) {
    const card = new THREE.Mesh(cardGeo, [cardBackMat, mats.darkSlate]);
    card.position.y = i * 0.024;
    card.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.02 * (i * 0.3);
    card.castShadow = i === 6;
    card.receiveShadow = true;
    group.add(card);
  }

  // Raycast proxy for clicking deck
  const hitGeo = new THREE.BoxGeometry(1.1, 0.3, 1.48);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitProxy = new THREE.Mesh(hitGeo, hitMat);
  hitProxy.position.y = 0.14;
  hitProxy.userData.interactiveType = 'deck';
  hitProxy.layers.set(1);
  group.add(hitProxy);

  return { group, hitProxy };
}
