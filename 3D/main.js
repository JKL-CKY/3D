const canvasWrap = document.querySelector("#canvasWrap");
const infoTitle = document.querySelector("#nodeTitle");
const infoDesc = document.querySelector("#nodeDesc");
const densityRange = document.querySelector("#densityRange");
const rotateToggle = document.querySelector("#rotateToggle");
const metricSignal = document.querySelector("#metricSignal");
const metricTemp = document.querySelector("#metricTemp");
const metricNodes = document.querySelector("#metricNodes");
const latencyValue = document.querySelector("#latencyValue");
const driftValue = document.querySelector("#driftValue");
const focusValue = document.querySelector("#focusValue");
const viewButtons = [...document.querySelectorAll(".view-button")];

const sizes = {
  width: canvasWrap.clientWidth,
  height: canvasWrap.clientHeight,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05101d);
scene.fog = new THREE.Fog(0x05101d, 18, 34);

const camera = new THREE.PerspectiveCamera(48, sizes.width / sizes.height, 0.1, 100);
camera.position.set(11, 8, 12);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(sizes.width, sizes.height);
renderer.outputEncoding = THREE.sRGBEncoding;
canvasWrap.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 5;
controls.maxDistance = 20;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.55;

const ambientLight = new THREE.AmbientLight(0x8fc9ff, 1.2);
scene.add(ambientLight);

const rimLight = new THREE.PointLight(0x73c3ff, 45, 40, 2);
rimLight.position.set(5, 9, 6);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0x714eff, 28, 38, 2);
fillLight.position.set(-7, -2, -6);
scene.add(fillLight);

const coreGroup = new THREE.Group();
scene.add(coreGroup);

const coreMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x6ee7ff,
  emissive: 0x2e78ff,
  emissiveIntensity: 0.7,
  roughness: 0.18,
  metalness: 0.72,
  clearcoat: 0.65,
});

const coreMesh = new THREE.Mesh(new THREE.TorusKnotGeometry(1.25, 0.33, 220, 28), coreMaterial);
coreGroup.add(coreMesh);

const shellRing = new THREE.Mesh(
  new THREE.TorusGeometry(2.55, 0.03, 16, 180),
  new THREE.MeshBasicMaterial({ color: 0x78d7ff, transparent: true, opacity: 0.8 })
);
shellRing.rotation.x = Math.PI / 2.15;
coreGroup.add(shellRing);

const shellRingB = shellRing.clone();
shellRingB.rotation.set(Math.PI / 4.2, Math.PI / 3.4, 0);
coreGroup.add(shellRingB);

const starsGeometry = new THREE.BufferGeometry();
const starCount = 1400;
const starPositions = new Float32Array(starCount * 3);

for (let i = 0; i < starCount * 3; i += 3) {
  starPositions[i] = (Math.random() - 0.5) * 44;
  starPositions[i + 1] = (Math.random() - 0.5) * 30;
  starPositions[i + 2] = (Math.random() - 0.5) * 42;
}

starsGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starsGeometry,
  new THREE.PointsMaterial({
    color: 0xcde7ff,
    size: 0.035,
    transparent: true,
    opacity: 0.9,
  })
);
scene.add(stars);

const orbitGroup = new THREE.Group();
scene.add(orbitGroup);

const pickables = [];
let orbitNodes = [];
let selectedNode = null;
let hoveredNode = null;

const presets = {
  overview: {
    position: new THREE.Vector3(11, 8, 12),
    target: new THREE.Vector3(0, 0, 0),
  },
  cluster: {
    position: new THREE.Vector3(6.5, 3.6, 7.8),
    target: new THREE.Vector3(0.8, 0.4, 0),
  },
  orbit: {
    position: new THREE.Vector3(-8.2, 6.2, 8.8),
    target: new THREE.Vector3(-0.5, 0.7, 0),
  },
};

const activePreset = {
  position: presets.overview.position.clone(),
  target: presets.overview.target.clone(),
};

let isAutoRotating = true;

function createOrbitGuide(radius, tilt) {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius * 0.68, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(180).map((point) => new THREE.Vector3(point.x, 0, point.y));
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.LineLoop(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0x1f93ff,
      transparent: true,
      opacity: 0.25,
    })
  );
  line.rotation.x = tilt;
  return line;
}

for (let i = 0; i < 4; i += 1) {
  orbitGroup.add(createOrbitGuide(3.4 + i * 1.2, Math.PI / (4.8 - i * 0.45)));
}

function buildNodes(count) {
  while (orbitGroup.children.length > 4) {
    const child = orbitGroup.children[orbitGroup.children.length - 1];
    orbitGroup.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  }

  for (let i = pickables.length - 1; i >= 0; i--) {
    if (pickables[i].userData.id && pickables[i].userData.id.startsWith("NODE-")) {
      pickables.splice(i, 1);
    }
  }

  orbitNodes = [];
  selectedNode = null;
  hoveredNode = null;

  for (let i = 0; i < count; i += 1) {
    const radius = 3.8 + (i % 5) * 1.15;
    const speed = 0.18 + (i % 7) * 0.025;
    const angle = (i / count) * Math.PI * 2;
    const lift = (i % 3) * 0.28 - 0.35;

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18 + (i % 3) * 0.04, 24, 24),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.53 + (i % 5) * 0.05, 0.85, 0.62),
        emissive: 0x245dff,
        emissiveIntensity: 0.9,
        metalness: 0.35,
        roughness: 0.22,
      })
    );

    mesh.userData = {
      id: `NODE-${String(i + 1).padStart(2, "0")}`,
      title: `Relay ${i + 1}`,
      desc: `Throughput ${72 + i}% | Orbit band ${1 + (i % 4)} | Drift window ${(0.1 + i * 0.03).toFixed(2)}`,
      radius,
      speed,
      angle,
      lift,
    };

    pickables.push(mesh);
    orbitNodes.push(mesh);
    orbitGroup.add(mesh);
  }

  metricNodes.textContent = String(count);
}

buildNodes(Number(densityRange.value));

function setInfo(node) {
  if (!node) {
    infoTitle.textContent = "Core Relay";
    infoDesc.textContent = "Hover a node to inspect data throughput and orbit status.";
    focusValue.textContent = selectedNode ? selectedNode.userData.id : "IDLE";
    return;
  }

  infoTitle.textContent = `${node.userData.id} / ${node.userData.title}`;
  infoDesc.textContent = node.userData.desc;
  focusValue.textContent = selectedNode ? selectedNode.userData.id : "HOVER";
}

const pointer = new THREE.Vector2(999, 999);
const raycaster = new THREE.Raycaster();
const focusPoint = new THREE.Vector3();
const clock = new THREE.Clock();

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

window.addEventListener("pointermove", updatePointer);

renderer.domElement.addEventListener("click", () => {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(pickables, false)[0];

  if (!hit) {
    selectedNode = null;
    setInfo(hoveredNode);
    return;
  }

  selectedNode = hit.object;
  setInfo(selectedNode);
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    viewButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const preset = presets[button.dataset.view];
    activePreset.position.copy(preset.position);
    activePreset.target.copy(preset.target);
  });
});

rotateToggle.addEventListener("click", () => {
  isAutoRotating = !isAutoRotating;
  controls.autoRotate = isAutoRotating;
  rotateToggle.textContent = isAutoRotating ? "开启" : "关闭";
});

densityRange.addEventListener("input", (event) => {
  buildNodes(Number(event.target.value));
});

function updateMetrics(elapsed) {
  metricSignal.textContent = `${Math.round(68 + Math.sin(elapsed * 1.4) * 18)}%`;
  metricTemp.textContent = `${Math.round(29 + Math.cos(elapsed * 0.9) * 5)} C`;
  latencyValue.textContent = `${Math.round(11 + Math.abs(Math.sin(elapsed * 2.6)) * 18)} ms`;
  driftValue.textContent = (0.12 + Math.abs(Math.sin(elapsed * 1.7)) * 0.36).toFixed(2);
}

function resizeRenderer() {
  sizes.width = canvasWrap.clientWidth;
  sizes.height = canvasWrap.clientHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
}

window.addEventListener("resize", resizeRenderer);

function tick() {
  const elapsed = clock.getElapsedTime();

  if (isAutoRotating) {
    coreMesh.rotation.x = elapsed * 0.25;
    coreMesh.rotation.y = elapsed * 0.46;
    shellRing.rotation.z = elapsed * 0.18;
    shellRingB.rotation.y = elapsed * 0.22;
    stars.rotation.y = elapsed * 0.015;

    orbitNodes.forEach((node, index) => {
      const { radius, speed, angle, lift } = node.userData;
      const orbitAngle = elapsed * speed + angle;
      node.position.set(
        Math.cos(orbitAngle) * radius,
        Math.sin(orbitAngle * 1.7 + index) * 0.42 + lift,
        Math.sin(orbitAngle) * radius * 0.68
      );

      node.scale.setScalar(1 + Math.sin(elapsed * 4 + index) * 0.08);
    });
  }

  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(pickables, false)[0];
  hoveredNode = hit?.object ?? null;

  if (!selectedNode) {
    setInfo(hoveredNode);
  }

  if (hoveredNode) {
    document.body.style.cursor = "pointer";
  } else {
    document.body.style.cursor = "default";
  }

  const desiredTarget = selectedNode ? focusPoint.copy(selectedNode.position) : activePreset.target;
  const wobbleTarget = new THREE.Vector3(Math.sin(elapsed * 0.22) * 0.65, Math.cos(elapsed * 0.18) * 0.22, 0);
  const desiredPosition = activePreset.position.lerp(wobbleTarget, 0.012);

  camera.position.lerp(desiredPosition, 0.045);
  controls.target.lerp(desiredTarget, 0.08);
  controls.update();

  updateMetrics(elapsed);
  renderer.render(scene, camera);
  window.requestAnimationFrame(tick);
}

tick();
