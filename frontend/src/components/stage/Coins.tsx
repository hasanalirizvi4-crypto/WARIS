import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Group, MathUtils } from "three";
import { makeCoinFaceDrawer, useCanvasTexture, DISPLAY_FONT } from "./textures";
import type { StageCoin } from "./stageTypes";

const COIN_R = 0.2;
const COIN_H = 0.045;

/** How many coins to stack for a value in ETH (log scale, 1 to 12). */
function coinCount(valueEth: number) {
  if (!(valueEth > 0)) return 1;
  return Math.max(1, Math.min(12, Math.round(3 + Math.log10(valueEth) * 2.4)));
}

function CoinStack({ coin, index, total, visible, reducedMotion, showLabel }: {
  coin: StageCoin;
  index: number;
  total: number;
  visible: boolean;
  reducedMotion: boolean;
  showLabel: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const drawer = useMemo(() => makeCoinFaceDrawer(coin.color, coin.symbol), [coin.color, coin.symbol]);
  const face = useCanvasTexture(256, 256, drawer, [`800 48px ${DISPLAY_FONT}`]);
  const count = coinCount(coin.valueEth);
  const spacing = 0.48;
  const x = (index - (total - 1) / 2) * spacing;

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const target = visible ? 1 : 0.001;
    const s = reducedMotion ? target : MathUtils.damp(group.scale.x, target, 6 - index * 0.6, delta);
    group.scale.setScalar(s);
    if (!reducedMotion) {
      group.rotation.y = Math.sin(state.clock.elapsedTime * 0.6 + index) * 0.35;
      group.position.y = -0.62 + Math.sin(state.clock.elapsedTime * 1.2 + index * 0.8) * 0.025;
    }
  });

  return (
    <group ref={groupRef} position={[x, -0.62, 0.32]} scale={0.001}>
      {Array.from({ length: count }, (_, level) => (
        <group key={level} position={[Math.sin(level * 1.7) * 0.012, level * (COIN_H + 0.004), Math.cos(level * 1.3) * 0.012]}>
          <mesh castShadow>
            <cylinderGeometry args={[COIN_R, COIN_R, COIN_H, 48]} />
            <meshStandardMaterial color={coin.color} metalness={0.55} roughness={0.32} envMapIntensity={0.6} />
          </mesh>
          {level === count - 1 && (
            <mesh position={[0, COIN_H / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[COIN_R * 0.98, 48]} />
              <meshStandardMaterial map={face} metalness={0.35} roughness={0.35} envMapIntensity={0.5} />
            </mesh>
          )}
        </group>
      ))}
      {visible && showLabel && (
        <Html
          position={[0.42, count * (COIN_H + 0.004) * 0.5, 0]}
          distanceFactor={4.2}
          className="stage-label stage-label--coin"
          zIndexRange={[20, 0]}
        >
          <strong>{coin.amountLabel}</strong>
          <span>{coin.caption}</span>
        </Html>
      )}
    </group>
  );
}

/** Asset coins inside the open vault, biggest value first. */
export function Coins({ coins, visible, reducedMotion, showLabels }: {
  coins: StageCoin[];
  visible: boolean;
  reducedMotion: boolean;
  showLabels: boolean;
}) {
  const sorted = useMemo(() => [...coins].sort((a, b) => b.valueEth - a.valueEth).slice(0, 4), [coins]);
  return (
    <group position={[0, -0.12, 0]}>
      {sorted.map((coin, index) => (
        <CoinStack
          key={coin.id}
          coin={coin}
          index={index}
          total={sorted.length}
          visible={visible}
          reducedMotion={reducedMotion}
          showLabel={showLabels}
        />
      ))}
    </group>
  );
}
