import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points } from "three";
import { PAPER } from "./textures";

/** Deterministic pseudo-random numbers, so every visit looks the same. */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

/** Slow-drifting specks of light around the vault. */
export function Dust({ count = 260, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const pointsRef = useRef<Points>(null);
  const geometry = useMemo(() => {
    const random = seeded(42);
    const positions: number[] = [];
    for (let i = 0; i < count; i++) {
      positions.push((random() - 0.5) * 13, (random() - 0.5) * 8, -4.5 + random() * 5.5);
    }
    const created = new BufferGeometry();
    created.setAttribute("position", new Float32BufferAttribute(positions, 3));
    return created;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points || reducedMotion) return;
    const attribute = points.geometry.attributes.position;
    for (let i = 0; i < attribute.count; i++) {
      let y = attribute.getY(i) + delta * (0.05 + (i % 7) * 0.012);
      if (y > 4) y = -4;
      attribute.setY(i, y);
    }
    attribute.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color={PAPER}
        size={0.022}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
