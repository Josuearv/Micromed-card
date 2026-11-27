import * as THREE from 'three';
import { EntityVisualArchetype } from '../types/game';

export interface Entity3DHandle {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  opsonizedRing: THREE.Mesh;
  biofilmShell: THREE.Mesh;
  stunRing: THREE.Mesh;
  archetype: EntityVisualArchetype;
  lungeX: number;
  lungeZ: number;
  pulseBoost: number;
}

const ARCHETYPE_COLORS: Record<EntityVisualArchetype, number> = {
  macrofago: 0x10b981,
  linfocito: 0x34d399,
  anticuerpo: 0x38bdf8,
  celula_madre: 0x2dd4bf,
  unidad_qx: 0xf59e0b,
  virus: 0xf43f5e,
  bacteria: 0xfb7185,
  trombo: 0xb91c1c,
};

export function createBioEntityMesh(
  archetype: EntityVisualArchetype,
): Entity3DHandle {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.42;
  root.add(bodyGroup);

  const colorHex = ARCHETYPE_COLORS[archetype];
  const primaryMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: archetype === 'unidad_qx' ? 0.72 : 0.12,
    clearcoat: 0.6,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: colorHex,
    emissiveIntensity: 0.2,
    roughness: 0.25,
    metalness: 0.65,
  });

  if (archetype === 'macrofago') {
    // Lobulated amoeboid cell + pseudopods + nucleus
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 20), primaryMat);
    core.scale.set(1.15, 0.85, 1.1);
    core.castShadow = true;
    bodyGroup.add(core);

    const lobeGeo = new THREE.SphereGeometry(0.12, 14, 14);
    const offsets: [number, number, number][] = [
      [0.2, 0.04, 0.12],
      [-0.22, -0.02, 0.1],
      [0.08, 0.08, -0.2],
      [-0.12, 0.05, -0.18],
      [0, -0.08, 0.22],
    ];
    offsets.forEach(([x, y, z]) => {
      const lobe = new THREE.Mesh(lobeGeo, primaryMat);
      lobe.position.set(x, y, z);
      bodyGroup.add(lobe);
    });

    const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 14), accentMat);
    nucleus.position.set(0, 0.04, 0);
    bodyGroup.add(nucleus);
  } else if (archetype === 'linfocito') {
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 22, 22), primaryMat);
    core.castShadow = true;
    bodyGroup.add(core);

    const receptorGeo = new THREE.CylinderGeometry(0.018, 0.025, 0.16, 8);
    const tipGeo = new THREE.SphereGeometry(0.036, 10, 10);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const arm = new THREE.Group();
      arm.rotation.y = angle;
      arm.rotation.z = 0.65;
      const stalk = new THREE.Mesh(receptorGeo, accentMat);
      stalk.position.y = 0.24;
      const tip = new THREE.Mesh(tipGeo, accentMat);
      tip.position.y = 0.32;
      arm.add(stalk, tip);
      bodyGroup.add(arm);
    }
  } else if (archetype === 'anticuerpo') {
    // Y-shaped Immunoglobulin IgG
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.05, 0.28, 12),
      primaryMat,
    );
    stem.position.y = -0.1;
    bodyGroup.add(stem);

    const armGeo = new THREE.CylinderGeometry(0.036, 0.04, 0.24, 12);
    const leftArm = new THREE.Mesh(armGeo, primaryMat);
    leftArm.position.set(-0.11, 0.1, 0);
    leftArm.rotation.z = 0.68;
    const rightArm = new THREE.Mesh(armGeo, primaryMat);
    rightArm.position.set(0.11, 0.1, 0);
    rightArm.rotation.z = -0.68;
    bodyGroup.add(leftArm, rightArm);

    const capGeo = new THREE.SphereGeometry(0.055, 12, 12);
    const capL = new THREE.Mesh(capGeo, accentMat);
    capL.position.set(-0.2, 0.19, 0);
    const capR = new THREE.Mesh(capGeo, accentMat);
    capR.position.set(0.2, 0.19, 0);
    bodyGroup.add(capL, capR);
  } else if (archetype === 'celula_madre') {
    const outer = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 22, 22),
      new THREE.MeshPhysicalMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.55,
        roughness: 0.15,
        metalness: 0.05,
        depthWrite: false,
      }),
    );
    const n1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 14), primaryMat);
    n1.position.set(-0.07, 0.02, 0);
    const n2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 14), accentMat);
    n2.position.set(0.07, -0.02, 0);
    bodyGroup.add(outer, n1, n2);
  } else if (archetype === 'unidad_qx') {
    // Articulated medical defibrillator / surgical bot
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.24), primaryMat);
    chassis.castShadow = true;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.26), accentMat);
    visor.position.y = 0.03;
    const paddleGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 14);
    const padL = new THREE.Mesh(paddleGeo, accentMat);
    padL.position.set(-0.22, 0.04, 0.06);
    padL.rotation.z = Math.PI / 2;
    const padR = new THREE.Mesh(paddleGeo, accentMat);
    padR.position.set(0.22, 0.04, 0.06);
    padR.rotation.z = Math.PI / 2;
    bodyGroup.add(chassis, visor, padL, padR);
  } else if (archetype === 'virus') {
    // Icosahedral capsid + glycoprotein spikes
    const capsid = new THREE.Mesh(new THREE.IcosahedronGeometry(0.21, 0), primaryMat);
    capsid.castShadow = true;
    bodyGroup.add(capsid);

    const spikeGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8);
    const headGeo = new THREE.SphereGeometry(0.038, 10, 10);
    const dirs: [number, number, number][] = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1], [0.7, 0.7, 0], [-0.7, 0.7, 0],
      [0.7, -0.7, 0], [-0.7, -0.7, 0],
    ];
    dirs.forEach(([dx, dy, dz]) => {
      const spGrp = new THREE.Group();
      const v = new THREE.Vector3(dx, dy, dz).normalize();
      spGrp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
      const stalk = new THREE.Mesh(spikeGeo, accentMat);
      stalk.position.y = 0.24;
      const head = new THREE.Mesh(headGeo, primaryMat);
      head.position.y = 0.31;
      spGrp.add(stalk, head);
      bodyGroup.add(spGrp);
    });
  } else if (archetype === 'bacteria') {
    // Bacillus capsule + flagellum tail
    const capsule = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.14, 0.24, 8, 16),
      primaryMat,
    );
    capsule.rotation.z = Math.PI / 2;
    capsule.castShadow = true;
    bodyGroup.add(capsule);

    const flagellumCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.24, 0, 0),
      new THREE.Vector3(-0.36, 0.06, 0.05),
      new THREE.Vector3(-0.46, -0.05, -0.04),
      new THREE.Vector3(-0.56, 0.04, 0.02),
    ]);
    const flagellum = new THREE.Mesh(
      new THREE.TubeGeometry(flagellumCurve, 14, 0.016, 8, false),
      accentMat,
    );
    bodyGroup.add(flagellum);
  } else {
    // Vascular Thrombus: fibrin-platelet aggregate
    const mainClot = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.23, 1),
      primaryMat,
    );
    mainClot.scale.set(1.2, 0.85, 1.0);
    mainClot.castShadow = true;
    const strand = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.025, 8, 24),
      accentMat,
    );
    strand.rotation.x = 0.6;
    const strand2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.02, 8, 24),
      accentMat,
    );
    strand2.rotation.y = 0.8;
    bodyGroup.add(mainClot, strand, strand2);
  }

  // Base pedestal ring on slot floor
  const baseRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.022, 10, 32),
    new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.75,
      roughness: 0.25,
    }),
  );
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.02;
  root.add(baseRing);

  // Status Indicator 1: Opsonized Cyan Target Ring
  const opsonizedRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.02, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
  );
  opsonizedRing.position.y = 0.42;
  opsonizedRing.visible = false;
  root.add(opsonizedRing);

  // Status Indicator 2: Biofilm Protective Dome
  const biofilmShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 18, 14),
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.24,
      roughness: 0.2,
      depthWrite: false,
    }),
  );
  biofilmShell.position.y = 0.42;
  biofilmShell.visible = false;
  root.add(biofilmShell);

  // Status Indicator 3: Stunned Electric Halo
  const stunRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.018, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
  );
  stunRing.rotation.x = Math.PI / 2;
  stunRing.position.y = 0.85;
  stunRing.visible = false;
  root.add(stunRing);

  return {
    root,
    bodyGroup,
    opsonizedRing,
    biofilmShell,
    stunRing,
    archetype,
    lungeX: 0,
    lungeZ: 0,
    pulseBoost: 0,
  };
}

export interface BloodstreamHandle {
  mesh: THREE.InstancedMesh;
  phases: Float32Array;
  lanes: Float32Array;
  speeds: Float32Array;
}

export function createBloodstreamErythrocytes(): BloodstreamHandle {
  const count = 36;
  // Biconcave erythrocyte profile via LatheGeometry
  const profile = [
    new THREE.Vector2(0, 0.012),
    new THREE.Vector2(0.035, 0.016),
    new THREE.Vector2(0.065, 0.028),
    new THREE.Vector2(0.082, 0.012),
    new THREE.Vector2(0.082, -0.012),
    new THREE.Vector2(0.065, -0.028),
    new THREE.Vector2(0.035, -0.016),
    new THREE.Vector2(0, -0.012),
  ];
  const geo = new THREE.LatheGeometry(profile, 14);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    emissive: 0x450a0a,
    emissiveIntensity: 0.35,
    roughness: 0.45,
    metalness: 0.05,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;

  const phases = new Float32Array(count);
  const lanes = new Float32Array(count);
  const speeds = new Float32Array(count);
  const laneX = [-2.1, 0, 2.1];

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    phases[i] = Math.random();
    lanes[i] = laneX[i % 3] + (Math.random() - 0.5) * 0.55;
    speeds[i] = 0.09 + Math.random() * 0.06;

    dummy.position.set(lanes[i], 0.08, -2.3 + phases[i] * 4.6);
    dummy.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
    const s = 0.75 + Math.random() * 0.45;
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();

  return { mesh, phases, lanes, speeds };
}
