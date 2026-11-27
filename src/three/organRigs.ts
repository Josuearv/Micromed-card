import * as THREE from 'three';
import { DuelTelemetry, OrganId } from '../types/game';
import { MedicalMaterials } from './models';

export interface OrganRigHandle {
  organId: OrganId;
  root: THREE.Group;
  pivot: THREE.Group;
  outerRing: THREE.Mesh;
  innerRing: THREE.Mesh;
  hitProxy: THREE.Mesh;
  update(
    dt: number,
    elapsed: number,
    tel: DuelTelemetry,
    highlightPulse: number,
  ): void;
  dispose(): void;
}

function buildEmitterPedestal(mats: MedicalMaterials, accentHex: number): {
  root: THREE.Group;
  outerRing: THREE.Mesh;
  innerRing: THREE.Mesh;
  hitProxy: THREE.Mesh;
  ownedGeos: THREE.BufferGeometry[];
  ownedMats: THREE.Material[];
} {
  const root = new THREE.Group();
  const ownedGeos: THREE.BufferGeometry[] = [];
  const ownedMats: THREE.Material[] = [];

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
  ownedGeos.push(pedGeo);
  const pedestal = new THREE.Mesh(pedGeo, mats.darkSlate);
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  root.add(pedestal);

  const collarGeo = new THREE.TorusGeometry(0.84, 0.045, 16, 48);
  collarGeo.rotateX(Math.PI / 2);
  ownedGeos.push(collarGeo);
  const collar = new THREE.Mesh(collarGeo, mats.titanium);
  collar.position.y = 0.15;
  root.add(collar);

  const glowRingGeo = new THREE.TorusGeometry(0.64, 0.025, 12, 48);
  glowRingGeo.rotateX(Math.PI / 2);
  ownedGeos.push(glowRingGeo);
  const innerRing = new THREE.Mesh(glowRingGeo, mats.glowRing);
  innerRing.position.y = 0.25;
  root.add(innerRing);

  const glassCylGeo = new THREE.CylinderGeometry(0.72, 0.78, 0.22, 36, 1, true);
  ownedGeos.push(glassCylGeo);
  const glassCollar = new THREE.Mesh(glassCylGeo, mats.glass);
  glassCollar.position.y = 0.34;
  glassCollar.renderOrder = 4;
  root.add(glassCollar);

  const outerRingGeo = new THREE.TorusGeometry(0.95, 0.022, 12, 64);
  const outerRingMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.45,
    metalness: 0.25,
    roughness: 0.3,
  });
  ownedGeos.push(outerRingGeo);
  ownedMats.push(outerRingMat);
  const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
  outerRing.position.y = 1.15;
  outerRing.rotation.x = Math.PI / 3;
  root.add(outerRing);

  const hitGeo = new THREE.CylinderGeometry(0.85, 0.85, 1.9, 12);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  ownedGeos.push(hitGeo);
  ownedMats.push(hitMat);
  const hitProxy = new THREE.Mesh(hitGeo, hitMat);
  hitProxy.position.y = 1.0;
  hitProxy.userData.interactiveType = 'organ';
  hitProxy.layers.set(1);
  root.add(hitProxy);

  return { root, outerRing, innerRing, hitProxy, ownedGeos, ownedMats };
}

export function createOrganRig(
  organId: OrganId,
  mats: MedicalMaterials,
  isSoftwareGl: boolean,
): OrganRigHandle {
  const accentMap: Record<OrganId, number> = {
    corazon: 0x38bdf8,
    pulmon: 0x38bdf8,
    higado: 0xf59e0b,
    cerebro: 0xa855f7,
    epitelio: 0x10b981,
  };

  const base = buildEmitterPedestal(mats, accentMap[organId]);
  const { root, outerRing, innerRing, hitProxy, ownedGeos, ownedMats } = base;
  const pivot = new THREE.Group();
  pivot.position.y = 1.15;
  root.add(pivot);

  let beatPhase = 0;

  // Helpers to register organ-owned geometries/materials cleanly
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    ownedGeos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    ownedMats.push(m);
    return m;
  };

  // Extra animated handles per organ
  let leftLung: THREE.Group | null = null;
  let rightLung: THREE.Group | null = null;
  let synapseNodes: THREE.Mesh[] = [];
  let ciliaMeshes: THREE.Mesh[] = [];

  if (organId === 'corazon') {
    const heartProfile = [
      new THREE.Vector2(0.01, -0.46),
      new THREE.Vector2(0.18, -0.34),
      new THREE.Vector2(0.38, -0.1),
      new THREE.Vector2(0.44, 0.16),
      new THREE.Vector2(0.32, 0.36),
      new THREE.Vector2(0.01, 0.42),
    ];
    const leftVentricle = new THREE.Mesh(
      trackGeo(new THREE.LatheGeometry(heartProfile, 32)),
      mats.heartTissue,
    );
    leftVentricle.scale.set(1.05, 1.0, 0.88);
    leftVentricle.rotation.z = 0.22;
    leftVentricle.castShadow = true;
    pivot.add(leftVentricle);

    const rightAtrium = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.24, 24, 24)),
      mats.heartTissue,
    );
    rightAtrium.position.set(-0.26, 0.2, 0.06);
    rightAtrium.scale.set(0.95, 1.15, 0.9);
    rightAtrium.castShadow = true;
    pivot.add(rightAtrium);

    const aortaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.02, 0.25, 0),
      new THREE.Vector3(0.06, 0.56, 0.04),
      new THREE.Vector3(-0.18, 0.66, -0.04),
      new THREE.Vector3(-0.28, 0.38, -0.14),
    ]);
    const aorta = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(aortaCurve, 28, 0.095, 14, false)),
      mats.arteryRed,
    );
    aorta.castShadow = true;
    pivot.add(aorta);

    const venaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.28, 0.16, 0.08),
      new THREE.Vector3(-0.34, 0.54, 0.1),
    ]);
    pivot.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(venaCurve, 16, 0.075, 12, false)),
        mats.veinBlue,
      ),
    );

    const pulmCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.12, 0.22, 0.14),
      new THREE.Vector3(0.22, 0.44, 0.05),
      new THREE.Vector3(0.42, 0.42, -0.06),
    ]);
    pivot.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(pulmCurve, 18, 0.07, 12, false)),
        mats.veinBlue,
      ),
    );

    const coreMesh = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.14, 18, 18)),
      mats.glowRing,
    );
    coreMesh.position.set(0.08, 0.04, 0.28);
    pivot.add(coreMesh);
  } else if (organId === 'pulmon') {
    const lungMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xf472b6,
        emissive: 0x3b0764,
        emissiveIntensity: 0.28,
        roughness: 0.34,
        metalness: 0.04,
        clearcoat: 0.55,
        transparent: !isSoftwareGl,
        opacity: isSoftwareGl ? 1 : 0.88,
      }),
    );
    const tracheaMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        emissive: 0x0c4a6e,
        emissiveIntensity: 0.25,
        roughness: 0.4,
        metalness: 0.2,
      }),
    );

    // Trachea & cartilage rings
    const trachea = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.075, 0.085, 0.52, 18)),
      tracheaMat,
    );
    trachea.position.set(0, 0.36, 0);
    trachea.castShadow = true;
    pivot.add(trachea);

    const ringGeo = trackGeo(new THREE.TorusGeometry(0.086, 0.016, 8, 22));
    ringGeo.rotateX(Math.PI / 2);
    for (let r = 0; r < 5; r++) {
      const ring = new THREE.Mesh(ringGeo, mats.chrome);
      ring.position.set(0, 0.18 + r * 0.085, 0);
      pivot.add(ring);
    }

    // Bronchial bifurcation
    const leftBronchusCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.12, 0),
      new THREE.Vector3(-0.16, 0.02, 0),
      new THREE.Vector3(-0.32, -0.06, 0.02),
    ]);
    const rightBronchusCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.12, 0),
      new THREE.Vector3(0.16, 0.02, 0),
      new THREE.Vector3(0.32, -0.06, 0.02),
    ]);
    pivot.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(leftBronchusCurve, 14, 0.045, 10, false)),
        tracheaMat,
      ),
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(rightBronchusCurve, 14, 0.045, 10, false)),
        tracheaMat,
      ),
    );

    // Left & Right Lung Lobes
    leftLung = new THREE.Group();
    leftLung.position.set(-0.31, -0.05, 0);
    const lUpper = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.24, 22, 22)), lungMat);
    lUpper.scale.set(0.85, 1.35, 0.9);
    lUpper.position.set(0, 0.06, 0);
    lUpper.castShadow = true;
    const lLower = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.23, 20, 20)), lungMat);
    lLower.scale.set(0.95, 1.0, 0.95);
    lLower.position.set(-0.04, -0.18, 0);
    leftLung.add(lUpper, lLower);
    pivot.add(leftLung);

    rightLung = new THREE.Group();
    rightLung.position.set(0.31, -0.05, 0);
    const rUpper = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.25, 22, 22)), lungMat);
    rUpper.scale.set(0.88, 1.4, 0.92);
    rUpper.position.set(0, 0.06, 0);
    rUpper.castShadow = true;
    const rLower = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.24, 20, 20)), lungMat);
    rLower.scale.set(0.95, 1.0, 0.95);
    rLower.position.set(0.04, -0.18, 0);
    rightLung.add(rUpper, rLower);
    pivot.add(rightLung);

    // Alveolar Oxygen Core
    const o2Core = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.09, 14, 14)),
      mats.glowRing,
    );
    o2Core.position.set(0, 0.05, 0.14);
    pivot.add(o2Core);
  } else if (organId === 'higado') {
    const liverMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x991b1b,
        emissive: 0x450a0a,
        emissiveIntensity: 0.45,
        roughness: 0.28,
        metalness: 0.08,
        clearcoat: 0.72,
      }),
    );
    const bileMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x064e3b,
        emissiveIntensity: 0.55,
        roughness: 0.25,
      }),
    );

    // Large Right Lobe
    const rightLobe = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.38, 26, 24)),
      liverMat,
    );
    rightLobe.position.set(0.18, 0.02, 0);
    rightLobe.scale.set(1.25, 0.9, 0.85);
    rightLobe.rotation.z = -0.18;
    rightLobe.castShadow = true;
    pivot.add(rightLobe);

    // Tapered Left Lobe
    const leftLobe = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.28, 24, 22)),
      liverMat,
    );
    leftLobe.position.set(-0.24, 0.08, 0.04);
    leftLobe.scale.set(1.3, 0.65, 0.75);
    leftLobe.rotation.z = 0.28;
    leftLobe.castShadow = true;
    pivot.add(leftLobe);

    // Falciform ligament crest
    const ligCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.04, 0.34, 0.16),
      new THREE.Vector3(-0.04, 0.04, 0.26),
      new THREE.Vector3(-0.04, -0.22, 0.12),
    ]);
    pivot.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(ligCurve, 16, 0.026, 10, false)),
        mats.chrome,
      ),
    );

    // Gallbladder sac tucked underneath
    const gallbladder = new THREE.Mesh(
      trackGeo(new THREE.CapsuleGeometry(0.08, 0.16, 8, 16)),
      bileMat,
    );
    gallbladder.position.set(0.12, -0.24, 0.14);
    gallbladder.rotation.z = -0.5;
    pivot.add(gallbladder);

    // Portal triad vessels
    const portalCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.02, -0.45, -0.08),
      new THREE.Vector3(0.04, -0.12, -0.06),
      new THREE.Vector3(0.18, 0.04, -0.04),
    ]);
    pivot.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(portalCurve, 18, 0.055, 12, false)),
        mats.veinBlue,
      ),
    );
  } else if (organId === 'cerebro') {
    const cortexMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xe2c7d9,
        emissive: 0x3b0764,
        emissiveIntensity: 0.25,
        roughness: 0.42,
        metalness: 0.04,
        clearcoat: 0.5,
      }),
    );
    const synapseMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0xa855f7,
        emissiveIntensity: 1.1,
        roughness: 0.2,
      }),
    );

    // Left & Right Hemispheres
    const hemiGeo = trackGeo(new THREE.SphereGeometry(0.28, 24, 22));
    const hemiL = new THREE.Mesh(hemiGeo, cortexMat);
    hemiL.position.set(-0.17, 0.14, 0);
    hemiL.scale.set(0.88, 1.05, 1.32);
    hemiL.castShadow = true;

    const hemiR = new THREE.Mesh(hemiGeo, cortexMat);
    hemiR.position.set(0.17, 0.14, 0);
    hemiR.scale.set(0.88, 1.05, 1.32);
    hemiR.castShadow = true;
    pivot.add(hemiL, hemiR);

    // Cortical gyri ridge loops
    const gyriGeo = trackGeo(new THREE.TorusGeometry(0.18, 0.032, 10, 28));
    [-0.18, 0.18].forEach((x) => {
      const g1 = new THREE.Mesh(gyriGeo, cortexMat);
      g1.position.set(x, 0.22, 0.05);
      g1.rotation.set(0.4, Math.PI / 2, 0.2);
      const g2 = new THREE.Mesh(gyriGeo, cortexMat);
      g2.position.set(x, 0.12, -0.08);
      g2.rotation.set(-0.3, Math.PI / 2, -0.15);
      pivot.add(g1, g2);
    });

    // Cerebellum beneath posterior pole
    const cerebellum = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.21, 18, 16)),
      cortexMat,
    );
    cerebellum.position.set(0, -0.14, -0.2);
    cerebellum.scale.set(1.45, 0.72, 0.85);
    pivot.add(cerebellum);

    // Brainstem
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.05, -0.04),
      new THREE.Vector3(0, -0.38, -0.08),
    ]);
    pivot.add(
      new THREE.Mesh(
        trackGeo(new THREE.TubeGeometry(stemCurve, 12, 0.08, 12, false)),
        cortexMat,
      ),
    );

    // Glowing synaptic nodes
    const nodeGeo = trackGeo(new THREE.SphereGeometry(0.042, 10, 10));
    const nodeCoords: [number, number, number][] = [
      [-0.24, 0.28, 0.15],
      [0.24, 0.28, 0.15],
      [-0.22, 0.22, -0.18],
      [0.22, 0.22, -0.18],
      [0, 0.34, 0.02],
    ];
    synapseNodes = nodeCoords.map(([x, y, z]) => {
      const n = new THREE.Mesh(nodeGeo, synapseMat);
      n.position.set(x, y, z);
      pivot.add(n);
      return n;
    });
  } else {
    // Tejido Epitelial: Stratified columnar epithelium on basal lamina with apical cilia
    const cellMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x34d399,
        emissive: 0x064e3b,
        emissiveIntensity: 0.35,
        roughness: 0.25,
        clearcoat: 0.65,
        transparent: !isSoftwareGl,
        opacity: isSoftwareGl ? 1 : 0.86,
      }),
    );
    const laminaMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0f766e,
        emissive: 0x042f2e,
        emissiveIntensity: 0.4,
        roughness: 0.55,
      }),
    );
    const nucleusMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.65,
        roughness: 0.25,
      }),
    );

    // Basal Lamina Matrix Slab
    const lamina = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.92, 0.1, 0.72)),
      laminaMat,
    );
    lamina.position.set(0, -0.26, 0);
    lamina.castShadow = true;
    pivot.add(lamina);

    // 3x3 Columnar Epithelial Cells + Nuclei + Apical Microvilli Cilia
    const cellGeo = trackGeo(new THREE.CapsuleGeometry(0.11, 0.26, 8, 14));
    const nucGeo = trackGeo(new THREE.SphereGeometry(0.055, 10, 10));
    const ciliumGeo = trackGeo(new THREE.CylinderGeometry(0.012, 0.018, 0.16, 8));
    ciliaMeshes = [];

    for (let gx = -1; gx <= 1; gx++) {
      for (let gz = -1; gz <= 1; gz++) {
        const cx = gx * 0.27;
        const cz = gz * 0.21;
        const cell = new THREE.Mesh(cellGeo, cellMat);
        cell.position.set(cx, 0.02, cz);
        cell.castShadow = true;
        pivot.add(cell);

        const nuc = new THREE.Mesh(nucGeo, nucleusMat);
        nuc.position.set(cx, -0.05, cz);
        pivot.add(nuc);

        const cilium = new THREE.Mesh(ciliumGeo, mats.glowRing);
        cilium.position.set(cx, 0.31, cz);
        pivot.add(cilium);
        ciliaMeshes.push(cilium);
      }
    }
  }

  return {
    organId,
    root,
    pivot,
    outerRing,
    innerRing,
    hitProxy,
    update(dt, elapsed, tel, highlightPulse) {
      if (organId === 'corazon') {
        const bpmFreq = Math.max(1.0, tel.bpm / 60);
        beatPhase = (beatPhase + dt * bpmFreq) % 1;
        const systole =
          Math.exp(-Math.pow((beatPhase - 0.18) / 0.07, 2)) * 0.12 +
          Math.exp(-Math.pow((beatPhase - 0.34) / 0.08, 2)) * 0.06;
        pivot.scale.setScalar(1.0 + systole + highlightPulse * 0.06);
      } else if (organId === 'pulmon') {
        const breath = Math.sin(elapsed * 1.9);
        const expand = 1.0 + breath * 0.08 + highlightPulse * 0.05;
        if (leftLung) leftLung.scale.set(expand, 1.0 + breath * 0.04, expand);
        if (rightLung) rightLung.scale.set(expand, 1.0 + breath * 0.04, expand);
        pivot.scale.setScalar(1.0 + highlightPulse * 0.04);
      } else if (organId === 'cerebro') {
        pivot.scale.setScalar(1.0 + highlightPulse * 0.05);
        synapseNodes.forEach((node, i) => {
          const s = 0.8 + 0.45 * Math.sin(elapsed * 4.5 + i * 1.3);
          node.scale.setScalar(s);
        });
      } else if (organId === 'epitelio') {
        pivot.scale.setScalar(1.0 + highlightPulse * 0.05);
        ciliaMeshes.forEach((cil, i) => {
          cil.rotation.z = Math.sin(elapsed * 3.4 + i * 0.7) * 0.24;
          cil.rotation.x = Math.cos(elapsed * 2.8 + i * 0.5) * 0.14;
        });
      } else {
        // higado gentle metabolic pulse
        const met = Math.sin(elapsed * 2.2) * 0.035;
        pivot.scale.setScalar(1.0 + met + highlightPulse * 0.05);
      }

      pivot.rotation.y += dt * (organId === 'epitelio' ? 0.28 : 0.42);
      pivot.position.y = 1.15 + Math.sin(elapsed * 1.8) * 0.035;
      outerRing.rotation.z += dt * 0.55;
      outerRing.rotation.y -= dt * 0.3;
    },
    dispose() {
      ownedGeos.forEach((g) => g.dispose());
      ownedMats.forEach((m) => m.dispose());
    },
  };
}
