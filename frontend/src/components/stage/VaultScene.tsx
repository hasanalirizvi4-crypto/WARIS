import { useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Float,
  Lightformer,
  MeshReflectorMaterial,
  PerformanceMonitor,
  PresentationControls,
} from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { MathUtils } from "three";
import { Vault } from "./Vault";
import { Coins } from "./Coins";
import { Heirs } from "./Heirs";
import { Dust } from "./Dust";
import { CORAL, LIME, NIGHT, PAPER } from "./textures";
import type { StageState } from "./stageTypes";

/** Keeps the whole vault (and its heirs) in frame on any screen, with a gentle pointer parallax. */
function CameraRig({ hasHeirs, compact, reducedMotion }: {
  hasHeirs: boolean;
  compact: boolean;
  reducedMotion: boolean;
}) {
  useFrame((frame, delta) => {
    const { camera, size, pointer } = frame;
    const aspect = size.width / Math.max(1, size.height);
    // How much of the scene must fit: wider when heirs orbit the vault.
    const needWidth = hasHeirs ? 6.1 : 4.2;
    const needHeight = hasHeirs ? 6.1 : 4.2;
    const fov = MathUtils.degToRad(30);
    const distanceForHeight = needHeight / 2 / Math.tan(fov / 2);
    const distanceForWidth = needWidth / 2 / Math.tan(fov / 2) / aspect;
    const distance = Math.max(distanceForHeight, distanceForWidth) * (compact ? 1.04 : 1);
    const px = reducedMotion ? 0 : pointer.x * 0.45;
    const py = reducedMotion ? 0 : pointer.y * 0.25;
    camera.position.x = MathUtils.damp(camera.position.x, px, 2.5, delta);
    camera.position.y = MathUtils.damp(camera.position.y, 0.25 + py, 2.5, delta);
    camera.position.z = MathUtils.damp(camera.position.z, distance, 3, delta);
    camera.lookAt(0, hasHeirs ? -0.22 : -0.05, 0);
  });
  return null;
}

function Scene({ state, highQuality }: { state: StageState; highQuality: boolean }) {
  const { reducedMotion, compact } = state;
  const hasHeirs = state.heirs.length > 0;

  return (
    <>
      <color attach="background" args={[NIGHT]} />
      <fog attach="fog" args={[NIGHT, 11, 22]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 6]} intensity={1.5} color={PAPER} />
      <directionalLight position={[-6, 2, -4]} intensity={1.4} color={CORAL} />
      <pointLight position={[3.5, -1.5, 2.5]} intensity={6} distance={9} color={LIME} />

      {/* Studio reflections for the metal, generated on the spot (no downloads). */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.4} position={[0, 4, 5]} scale={[10, 2.5, 1]} color={PAPER} />
        <Lightformer form="rect" intensity={1.6} position={[-5, 0, 2]} rotation-y={Math.PI / 2} scale={[6, 3, 1]} color={CORAL} />
        <Lightformer form="ring" intensity={1.4} position={[4, 1, 3]} scale={1.6} color={LIME} />
        <Lightformer form="rect" intensity={0.8} position={[0, -3, 3]} scale={[8, 1, 1]} color="#4965ED" />
      </Environment>

      <CameraRig hasHeirs={hasHeirs} compact={compact} reducedMotion={reducedMotion} />

      <PresentationControls
        global={false}
        cursor={false}
        snap
        speed={1.4}
        zoom={1}
        rotation={[0, 0, 0]}
        polar={[-0.25, 0.3]}
        azimuth={[-0.7, 0.7]}
      >
        <Float
          enabled={!reducedMotion}
          speed={1.3}
          rotationIntensity={0.12}
          floatIntensity={0.35}
          floatingRange={[-0.05, 0.05]}
        >
          <group position={[0, 0.1, 0]}>
            <Vault state={state} />
            <Coins coins={state.coins} visible={state.doorOpen} reducedMotion={reducedMotion} showLabels={!compact} />
            <Heirs heirs={state.heirs} reducedMotion={reducedMotion} showLabels={!compact} />
          </group>
        </Float>
      </PresentationControls>

      <Dust count={compact ? 140 : 260} reducedMotion={reducedMotion} />

      {highQuality ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.95, 0]}>
          <planeGeometry args={[30, 30]} />
          <MeshReflectorMaterial
            resolution={512}
            blur={[320, 80]}
            mixBlur={1}
            mixStrength={2.4}
            mixContrast={1}
            roughness={0.9}
            depthScale={1.1}
            minDepthThreshold={0.4}
            maxDepthThreshold={1.4}
            color="#0A1524"
            metalness={0.55}
            mirror={0.6}
          />
        </mesh>
      ) : (
        <ContactShadows position={[0, -1.94, 0]} opacity={0.55} scale={10} blur={2.6} far={4} color="#000000" />
      )}

      <EffectComposer multisampling={highQuality ? 4 : 0}>
        <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.2} intensity={0.85} radius={0.7} />
        <Vignette offset={0.28} darkness={0.62} />
      </EffectComposer>
    </>
  );
}

/** The WebGL canvas. Loaded on its own so the page appears before the 3D is ready. */
export default function VaultScene({ state, onReady }: { state: StageState; onReady?: () => void }) {
  const [highQuality, setHighQuality] = useState(!state.compact);

  return (
    <Canvas
      className="stage-canvas"
      dpr={highQuality ? [1, 1.75] : [1, 1.25]}
      camera={{ position: [0, 0.25, 11], fov: 30, near: 0.1, far: 60 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={() => onReady?.()}
      aria-hidden="true"
    >
      <PerformanceMonitor onDecline={() => setHighQuality(false)} flipflops={2} />
      <Scene state={state} highQuality={highQuality && !state.compact} />
    </Canvas>
  );
}
