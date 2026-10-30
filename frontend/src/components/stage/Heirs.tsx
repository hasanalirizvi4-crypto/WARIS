import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  CatmullRomCurve3,
  Color,
  Group,
  MathUtils,
  MeshBasicMaterial,
  TubeGeometry,
  Vector3,
} from "three";
import {
  CORAL,
  DISPLAY_FONT,
  PAPER,
  drawStripes,
  makeMedallionDrawer,
  useCanvasTexture,
} from "./textures";
import type { StageHeir } from "./stageTypes";

const ORBIT_R = 2.18;
const CORAL_GLOW = new Color(CORAL).multiplyScalar(2.1);

/** Clockwise angle from 12 o'clock for heir i of n, kept clear of the plaque at the top. */
function heirAngle(index: number, total: number) {
  if (total === 1) return Math.PI / 2;
  const start = (60 * Math.PI) / 180;
  const end = (300 * Math.PI) / 180;
  return start + ((end - start) * index) / (total - 1);
}

function Heir({ heir, index, total, stripes, reducedMotion, showLabel }: {
  heir: StageHeir;
  index: number;
  total: number;
  stripes: ReturnType<typeof useCanvasTexture>;
  reducedMotion: boolean;
  showLabel: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const ribbonMaterial = useRef<MeshBasicMaterial>(null);
  const drawer = useMemo(() => makeMedallionDrawer(heir.share), [heir.share]);
  const face = useCanvasTexture(256, 256, drawer, [`800 96px ${DISPLAY_FONT}`]);

  const angle = heirAngle(index, total);
  const scale = total > 8 ? 0.7 : total > 4 ? 0.85 : 1;
  const position = useMemo(
    () => new Vector3(Math.sin(angle) * ORBIT_R, Math.cos(angle) * ORBIT_R * 0.86 - 0.12, 0.35),
    [angle]
  );

  // A ribbon of light from the door rim to the medallion, thicker for a bigger share.
  const ribbon = useMemo(() => {
    const start = new Vector3(Math.sin(angle) * 1.18, Math.cos(angle) * 1.18 - 0.12, 0.08);
    // Stop at the medallion's rim (facing the vault) so the ribbon never covers the share.
    const toVault = start.clone().sub(position).setZ(0).normalize().multiplyScalar(0.3);
    const end = position.clone().add(toVault);
    const mid = start.clone().lerp(end, 0.5).add(new Vector3(0, 0, 0.55));
    const curve = new CatmullRomCurve3([start, mid, end]);
    return new TubeGeometry(curve, 64, 0.006 + heir.share * 0.00045, 10, false);
  }, [angle, position, heir.share]);
  useEffect(() => () => ribbon.dispose(), [ribbon]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      const s = reducedMotion ? scale : MathUtils.damp(groupRef.current.scale.x, scale, 5, delta);
      groupRef.current.scale.setScalar(s);
      if (!reducedMotion) {
        groupRef.current.position.y = position.y + Math.sin(state.clock.elapsedTime * 0.9 + index) * 0.04;
      }
    }
    const map = ribbonMaterial.current?.alphaMap;
    if (map && !reducedMotion) map.offset.x -= delta * 0.45;
  });

  return (
    <>
      <mesh geometry={ribbon}>
        <meshBasicMaterial
          ref={ribbonMaterial}
          color={CORAL_GLOW}
          alphaMap={stripes}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <group ref={groupRef} position={position} scale={0.001}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.27, 0.27, 0.06, 64]} />
          <meshStandardMaterial color={PAPER} metalness={0.25} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0, 0.031]}>
          <circleGeometry args={[0.26, 64]} />
          <meshStandardMaterial map={face} roughness={0.5} />
        </mesh>
        {showLabel && (
          <Html position={[0, -0.42, 0]} center distanceFactor={7} className="stage-label stage-label--heir" zIndexRange={[20, 0]}>
            {heir.label}
          </Html>
        )}
      </group>
    </>
  );
}

/** Heirs as medallions around the vault, each fed by a ribbon of light. */
export function Heirs({ heirs, reducedMotion, showLabels }: {
  heirs: StageHeir[];
  reducedMotion: boolean;
  showLabels: boolean;
}) {
  const stripes = useCanvasTexture(128, 8, drawStripes, [], { repeat: true, srgb: false });
  const visible = heirs.slice(0, 20);
  return (
    <group>
      {visible.map((heir, index) => (
        <Heir
          key={heir.id}
          heir={heir}
          index={index}
          total={visible.length}
          stripes={stripes}
          reducedMotion={reducedMotion}
          showLabel={showLabels}
        />
      ))}
    </group>
  );
}
