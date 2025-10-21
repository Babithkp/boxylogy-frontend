// ThreeJsStaticOptimized.tsx
import React, { useEffect, useRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type PackedItemData = {
  name: string;
  position: any; // expected to be [x,y,z] in meters or {x,y,z} in meters
  dimensions: {
    length: number; // meters
    width: number;  // meters
    height: number; // meters
  };
};

type ContainerResult = {
  container_name?: string;
  utilization?: string | number;
  container_dimensions?: {
    length: number; // meters
    width: number;
    height: number;
  };
  packed_items_data?: PackedItemData[];
};

type Props = {
  containerDimensions: { length: string; width: string; height: string; unit?: string };
  boxDimensions?: any[]; // fallback if no packedItemsData
  style?: React.CSSProperties;
  className?: string;
  maxInstances?: number;
  showGrid?: boolean;
  packedItemsData?: PackedItemData[]; // legacy single container
  containers?: ContainerResult[]; // optional multi-container results (already in meters)
};

type ExportHandles = {
  exportPNG: () => void;
};

const parsePositionRaw = (pos: any | undefined): [number, number, number] => {
  if (!pos) return [0, 0, 0];
  if (Array.isArray(pos) && pos.length >= 3) return [Number(pos[0]) || 0, Number(pos[1]) || 0, Number(pos[2]) || 0];
  if (typeof pos === "object") {
    return [
      Number((pos as any).x ?? (pos as any)[0] ?? 0) || 0,
      Number((pos as any).y ?? (pos as any)[1] ?? 0) || 0,
      Number((pos as any).z ?? (pos as any)[2] ?? 0) || 0,
    ];
  }
  return [0, 0, 0];
};

const ThreeJsStaticOptimized = React.forwardRef<ExportHandles, Props>(function ThreeJsStaticOptimized(
  {
    containerDimensions,
    boxDimensions = [],
    style,
    className,
    maxInstances = 1200,
    showGrid = false,
    packedItemsData,
  }: Props,
  ref
) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // cleanup previous
    if (rendererRef.current) {
      try {
        rendererRef.current.forceContextLoss();
        const canvas = rendererRef.current.domElement;
        if (mountRef.current.contains(canvas)) mountRef.current.removeChild(canvas);
        rendererRef.current.dispose();
      } catch (e: unknown) {
        console.log(e);
      }
      rendererRef.current = null;
      sceneRef.current = null;
    }
    if (controlsRef.current) {
      try {
        controlsRef.current.dispose();
      } catch (e: unknown) {
        console.log(e);
      }
      controlsRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const mount = mountRef.current!;
    const width = mount.clientWidth || 600;
    const height = mount.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 2000);
    camera.position.set(8, 8, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height);
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 0.9);
    hemi.position.set(0, 50, 0);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(10, 20, 10);
    scene.add(dir);

    // parse container dims from props — these are expected to be meters already
    const contL = Number(containerDimensions.length) || 0;
    const contW = Number(containerDimensions.width) || 0;
    const contH = Number(containerDimensions.height) || 0;

    const containerLength = contL > 0 ? contL : 2;
    const containerWidth = contW > 0 ? contW : 1.5;
    const containerHeight = contH > 0 ? contH : 1.5;

    const maxDim = Math.max(containerLength, containerWidth, containerHeight);
    const targetMax = 8;
    const sceneScale = maxDim > 0 ? targetMax / maxDim : 1;

    // Grid helper
    if (showGrid) {
      const gridSize = Math.max(containerLength, containerWidth) * sceneScale || 5;
      const grid = new THREE.GridHelper(gridSize, 10);
      try {
        ((grid.material as unknown) as { opacity: number }).opacity = 0.1;
        (grid.material as THREE.Material).transparent = true;
      } catch (e) {
        console.log(e);
      }
      grid.position.y = 0.001;
      scene.add(grid);
    }

    // visual pad to avoid z-fighting
    const visualPad = 0.002; // 2 mm
    const colorList = ["#58A6FF", "#6BCB77", "#FFD93D", "#FF6B6B", "#9D5CFF", "#F0A500", "#4D96FF"];

    // build a single container centered
    const containerGroup = new THREE.Group();
    scene.add(containerGroup);

    const contGeometry = new THREE.BoxGeometry(
      containerLength * sceneScale,
      containerHeight * sceneScale,
      containerWidth * sceneScale
    );
    const contMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#63ABF7"),
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const contMesh = new THREE.Mesh(contGeometry, contMaterial);
    contMesh.position.y = (containerHeight * sceneScale) / 2;
    containerGroup.add(contMesh);

    const wire = new THREE.LineSegments(
      new THREE.EdgesGeometry(contGeometry),
      new THREE.LineBasicMaterial({ color: "#B8D5F3", transparent: true, opacity: 0.6 })
    );
    wire.position.copy(contMesh.position);
    containerGroup.add(wire);

    // Place boxes (assuming packedItemsData dims & positions are meters)
    const boxesGroup = new THREE.Group();
    const meshes: THREE.Mesh[] = [];

// After your containerGroup.add(contMesh) and wire
// ------------------ Dimension Markers ------------------

const createDimensionLine = (
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: string = "#FF0000"
) => {
  const points = [start, end];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color });
  return new THREE.Line(geometry, material);
};

const createTextLabel = (text: string, position: THREE.Vector3, color: string = "#000") => {
  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.font = "48px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.5, 0.5, 0.5); // Adjust for sceneScale if needed
  sprite.position.copy(position);
  return sprite;
};

// container corners in local space
const halfL = containerLength * sceneScale / 2;
const halfW = containerWidth * sceneScale / 2;
const halfH = containerHeight * sceneScale / 2;

// Length marker (X axis, red)
const lengthLine = createDimensionLine(
  new THREE.Vector3(-halfL, 0, halfW + 0.1),
  new THREE.Vector3(halfL, 0, halfW + 0.1),
  "#FF0000"
);
containerGroup.add(lengthLine);
containerGroup.add(
  createTextLabel(`${containerLength.toFixed(2)} m`, new THREE.Vector3(0, 0, halfW + 0.15), "#FF0000")
);

// Width marker (Z axis, green)
const widthLine = createDimensionLine(
  new THREE.Vector3(halfL + 0.1, 0, -halfW),
  new THREE.Vector3(halfL + 0.1, 0, halfW),
  "#00FF00"
);
containerGroup.add(widthLine);
containerGroup.add(
  createTextLabel(`${containerWidth.toFixed(2)} m`, new THREE.Vector3(halfL + 0.15, 0, 0), "#00FF00")
);

// Height marker (Y axis, blue)
const heightLine = createDimensionLine(
  new THREE.Vector3(halfL + 0.1, 0, halfW + 0.1),
  new THREE.Vector3(halfL + 0.1, containerHeight * sceneScale, halfW + 0.1),
  "#0000FF"
);
containerGroup.add(heightLine);
containerGroup.add(
  createTextLabel(`${containerHeight.toFixed(2)} m`, new THREE.Vector3(halfL + 0.15, halfH, halfW + 0.15), "#0000FF")
);

    if (packedItemsData && packedItemsData.length > 0) {
      packedItemsData.forEach((item, idx) => {
        const l = Number(item.dimensions.length) || 0.001;
        const w = Number(item.dimensions.width) || 0.001;
        const h = Number(item.dimensions.height) || 0.001;
        const raw = parsePositionRaw(item.position); // raw is interpreted as meters now

        let px = raw[0];
        let py = raw[1];
        let pz = raw[2];

        // clamp using meters
        px = Math.max(0, Math.min(px, containerLength - l));
        py = Math.max(0, Math.min(py, containerHeight - h));
        pz = Math.max(0, Math.min(pz, containerWidth - w));

        const renderL = Math.max(0.0001, l - visualPad);
        const renderW = Math.max(0.0001, w - visualPad);
        const renderH = Math.max(0.0001, h - visualPad);

        const geom = new THREE.BoxGeometry(renderL * sceneScale, renderH * sceneScale, renderW * sceneScale);
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(colorList[idx % colorList.length]),
          roughness: 0.6,
          metalness: 0.05,
        });
        const mesh = new THREE.Mesh(geom, mat);

        const padShift = visualPad / 2;
        mesh.position.set(
          (px + padShift + renderL / 2 - containerLength / 2) * sceneScale,
          (py + padShift + renderH / 2) * sceneScale,
          (pz + padShift + renderW / 2 - containerWidth / 2) * sceneScale
        );

        boxesGroup.add(mesh);
        meshes.push(mesh);
      });

      scene.add(boxesGroup);

      // Quick overlap check using Box3 (warn only)
      try {
        const boxesA = meshes.map(m => new THREE.Box3().setFromObject(m));
        for (let i = 0; i < boxesA.length; i++) {
          for (let j = i + 1; j < boxesA.length; j++) {
            const ia = boxesA[i];
            const ib = boxesA[j];
            if (ia.intersectsBox(ib)) {
              const minX = Math.max(ia.min.x, ib.min.x);
              const maxX = Math.min(ia.max.x, ib.max.x);
              const minY = Math.max(ia.min.y, ib.min.y);
              const maxY = Math.min(ia.max.y, ib.max.y);
              const minZ = Math.max(ia.min.z, ib.min.z);
              const maxZ = Math.min(ia.max.z, ib.max.z);
              // if (maxX > minX && maxY > minY && maxZ > minZ) {
              //   console.warn(`Renderer: Overlap detected between box ${i} and ${j}`);
              // }
            }
          }
        }
      } catch (e) {
        console.warn("Overlap check failed", e);
      }
    } else {
      const instances: { l: number; w: number; h: number; idx: number }[] = [];
      (boxDimensions || []).forEach((b: any, ix: number) => {
        const qty = Math.max(1, Math.floor(Number(b.quantity) || 1));
        for (let i = 0; i < qty; i++) {
          const L = b.unit ? (b.unit === "m" ? Number(b.length || 0) : Number(b.length || 0)) : Number(b.length || 0);
          const W = b.unit ? (b.unit === "m" ? Number(b.width || 0) : Number(b.width || 0)) : Number(b.width || 0);
          const H = b.unit ? (b.unit === "m" ? Number(b.height || 0) : Number(b.height || 0)) : Number(b.height || 0);
          instances.push({ l: Math.max(0.0001, L), w: Math.max(0.0001, W), h: Math.max(0.0001, H), idx: ix });
        }
      });

      let cursorX = 0;
      let cursorZ = 0;
      let layerHeight = 0;
      const padding = 0.01;
      const gg = new THREE.Group();

      for (const it of instances) {
        if (cursorX + it.l > containerLength) {
          cursorX = 0;
          cursorZ += layerHeight + padding;
          layerHeight = 0;
        }
        if (cursorZ + it.w > containerWidth) break;

        const renderL = Math.max(0.0001, it.l - visualPad);
        const renderW = Math.max(0.0001, it.w - visualPad);
        const renderH = Math.max(0.0001, it.h - visualPad);

        const geom = new THREE.BoxGeometry(renderL * sceneScale, renderH * sceneScale, renderW * sceneScale);
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#9DD3FF") });
        const mesh = new THREE.Mesh(geom, mat);

        mesh.position.set(
          (cursorX + renderL / 2 - containerLength / 2) * sceneScale,
          (renderH / 2) * sceneScale,
          (cursorZ + renderW / 2 - containerWidth / 2) * sceneScale
        );

        gg.add(mesh);
        cursorX += it.l + padding;
        layerHeight = Math.max(layerHeight, it.w);
      }

      scene.add(gg);
    }

    // controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 4;
    controls.maxDistance = 50;
    controls.target.set(0, (containerHeight * sceneScale) / 2, 0);
    controls.update();

    // animate
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    rafRef.current = requestAnimationFrame(animate);

    // resize
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      const w2 = mountRef.current.clientWidth || 600;
      const h2 = mountRef.current.clientHeight || 400;
      rendererRef.current.setSize(w2, h2);
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    // cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        controlsRef.current?.dispose();
      } catch (e) {
        console.log(e);
      }
      try {
        renderer.forceContextLoss();
        const canvas = renderer.domElement;
        if (mount.contains(canvas)) mount.removeChild(canvas);
        renderer.dispose();
      } catch (e) {
        console.log(e);
      }
      rendererRef.current = null;
      sceneRef.current = null;
      controlsRef.current = null;
      rafRef.current = null;
    };
  }, [
    containerDimensions.length,
    containerDimensions.width,
    containerDimensions.height,
    containerDimensions.unit,
    JSON.stringify(packedItemsData ?? null),
    JSON.stringify(boxDimensions ?? []),
    maxInstances,
    showGrid,
  ]);

  useImperativeHandle(ref, () => ({
    exportPNG: () => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      if (!renderer || !scene) return;
      const cam = (controlsRef.current?.object as unknown) as THREE.Camera | undefined;
      if (!cam) return;

      const prevColor = renderer.getClearColor(new THREE.Color());
      const prevAlpha = renderer.getClearAlpha();

      renderer.setClearColor(new THREE.Color("#ffffff"), 1);
      renderer.render(scene, cam);
      const dataURL = renderer.domElement.toDataURL("image/png");

      renderer.setClearColor(prevColor, prevAlpha);

      const link = document.createElement("a");
      link.download = `container-${Date.now()}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
  }));

  return (
    <div
      ref={mountRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        position: "relative",
        ...style,
      }}
    />
  );
});

export default ThreeJsStaticOptimized;
