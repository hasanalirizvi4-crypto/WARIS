import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Plane,
  TorusGeometry,
  Vector3,
} from "three";
import {
  CORAL,
  DISPLAY_FONT,
  LIME,
  NASTALIQ_FONT,
  PAPER,
  UI_FONT,
  drawDialFace,
  drawPlaque,
  drawSealFace,
  drawTunnel,
  useCanvasTexture,
} from "./textures";
import { DIAL_PRESETS, type StageState } from "./stageTypes";

// Layout (vault units). The front face of the body sits at z = 0.
const BODY = { w: 2.8, h: 3.0, d: 1.3 };
const DOOR_Y = -0.12;
const DOOR_R = 0.95;
const DOOR_T = 0.2;
const RING_R = 1.14;
const BOLT_COUNT = 8;
const DOOR_OPEN_ANGLE = -1.95;

const PAPER_COLOR = new Color(PAPER);
const CORAL_COLOR = new Color(CORAL);
const LIME_COLOR = new Color(LIME);

/** Clockwise angle (radians, from 12 o'clock) for a number of days on the dial. */
function daysToDialAngle(days: number) {
  const stops = DIAL_PRESETS.map((preset, index) => ({ days: preset, angle: (index * Math.PI) / 2 }));
  if (!Number.isFinite(days) || days <= stops[0].days) {
    const t = Math.max(0, Math.min(1, (Number.isFinite(days) ? days : 30) / 30));
    return -Math.PI / 4 + (Math.PI / 4) * t;
  }
  for (let i = 1; i < stops.length; i++) {
    if (days <= stops[i].days) {
      const t = (days - stops[i - 1].days) / (stops[i].days - stops[i - 1].days);
      return stops[i - 1].angle + (stops[i].angle - stops[i - 1].angle) * t;
    }
  }
  const t = Math.min(1, Math.log10(days / 180) / Math.log10(3650 / 180));
  return (3 * Math.PI) / 2 + (Math.PI / 3) * t;
}

/** Nearest preset to a clockwise dial angle. */
function angleToPreset(angle: number) {
  const turn = Math.PI * 2;
  const normalised = ((angle % turn) + turn) % turn;
  const index = Math.round(normalised / (Math.PI / 2)) % DIAL_PRESETS.length;
  return DIAL_PRESETS[index];
}

/** Rosette curves like the security engraving on banknotes and share certificates. */
function buildGuillocheCurves() {
  const curves: number[][] = [];
  const add = (radius: number, amplitude: number, lobes: number, copies: number, wobble = 0) => {
    for (let copy = 0; copy < copies; copy++) {
      const phase = (copy / copies) * ((Math.PI * 2) / lobes);
      const points: number[] = [];
      const steps = 720;
      for (let s = 0; s <= steps; s++) {
        const theta = (s / steps) * Math.PI * 2;
        const r = radius +
          amplitude * Math.sin(lobes * theta + phase * lobes) +
          wobble * Math.sin(3 * lobes * theta);
        points.push(Math.sin(theta) * r, Math.cos(theta) * r, 0);
      }
      curves.push(points);
    }
  };
  add(0.66, 0.17, 12, 7, 0.012);
  add(0.49, 0.045, 30, 3);
  add(0.855, 0.03, 44, 3);
  return curves;
}

/** Wax seal geometry: a short cylinder with an irregular, poured-looking rim. */
function buildSealGeometry() {
  const geometry = new CylinderGeometry(0.2, 0.22, 0.07, 56, 1);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const radius = Math.hypot(x, z);
    if (radius < 0.15) continue;
    const theta = Math.atan2(z, x);
    const k = 1 + 0.07 * Math.sin(5 * theta + 0.6) + 0.045 * Math.sin(11 * theta + 1.7) + 0.03 * Math.sin(17 * theta);
    positions.setX(i, x * k);
    positions.setZ(i, z * k);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A rounded rectangle outline (as a closed line). */
function buildInlayGeometry(width: number, height: number, radius: number) {
  const points: number[] = [];
  const hw = width / 2 - radius;
  const hh = height / 2 - radius;
  const corners = [
    [hw, hh, 0],
    [-hw, hh, Math.PI / 2],
    [-hw, -hh, Math.PI],
    [hw, -hh, (3 * Math.PI) / 2],
  ];
  corners.forEach(([cx, cy, start]) => {
    for (let i = 0; i <= 12; i++) {
      const angle = start + (i / 12) * (Math.PI / 2);
      points.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius, 0);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
  return geometry;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

interface VaultProps {
  state: StageState;
}

export function Vault({ state }: VaultProps) {
  const { reducedMotion } = state;

  const introStart = useRef<number | null>(null);
  const rootRef = useRef<Group>(null);
  const hingeRef = useRef<Group>(null);
  const dialRef = useRef<Group>(null);
  const handleRef = useRef<Group>(null);
  const boltRefs = useRef<(Mesh | null)[]>([]);
  const engravingRef = useRef<Group>(null);
  const engravingLines = useRef<Line[]>([]);
  const engravingMaterial = useRef<LineBasicMaterial | null>(null);
  const interiorLight = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);
  const ringMaterial = useRef<MeshBasicMaterial>(null);
  const waveRef = useRef<Mesh>(null);
  const waveMaterial = useRef<MeshBasicMaterial>(null);
  const sealRef = useRef<Group>(null);

  // Animated values, kept in a ref so they persist between frames.
  const anim = useRef({
    door: 0,
    bolts: 1,
    dial: 0,
    dialTarget: 0,
    dragging: false,
    dragStartPointer: 0,
    dragStartDial: 0,
    waveStart: -10,
    lastPulseKey: state.pulseKey,
    sealStart: -10,
    lastSealKey: state.sealKey,
    nextAutoPulse: 2,
  });

  const dialTexture = useCanvasTexture(512, 512, drawDialFace, [`700 64px ${DISPLAY_FONT}`, `600 24px ${UI_FONT}`]);
  const plaqueTexture = useCanvasTexture(768, 256, drawPlaque, [`700 96px ${NASTALIQ_FONT}`]);
  const sealTexture = useCanvasTexture(256, 256, drawSealFace, [`800 96px ${DISPLAY_FONT}`]);
  const tunnelTexture = useCanvasTexture(512, 512, drawTunnel);
  const sealGeometry = useMemo(() => buildSealGeometry(), []);
  const inlayGeometry = useMemo(() => buildInlayGeometry(BODY.w - 0.24, BODY.h - 0.24, 0.12), []);
  useEffect(() => () => inlayGeometry.dispose(), [inlayGeometry]);
  useEffect(() => () => sealGeometry.dispose(), [sealGeometry]);

  // The heartbeat arc is rebuilt when the remaining time changes (rarely).
  const ringGeometry = useMemo(() => {
    const fraction = Math.max(0.002, Math.min(1, state.heartbeat.fraction));
    return new TorusGeometry(RING_R, 0.024, 12, 220, fraction * Math.PI * 2);
  }, [state.heartbeat.fraction]);
  useEffect(() => () => ringGeometry.dispose(), [ringGeometry]);

  // Engraving lines are plain three.js objects: they are drawn on progressively.
  useEffect(() => {
    const group = engravingRef.current;
    if (!group) return;
    const material = new LineBasicMaterial({
      color: PAPER_COLOR.clone().multiplyScalar(1.5),
      transparent: true,
      opacity: 0.5,
      toneMapped: false,
    });
    engravingMaterial.current = material;
    const lines = buildGuillocheCurves().map((points) => {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
      geometry.setDrawRange(0, reducedMotion ? points.length / 3 : 0);
      const line = new Line(geometry, material);
      group.add(line);
      return line;
    });
    engravingLines.current = lines;
    return () => {
      lines.forEach((line) => {
        group.remove(line);
        line.geometry.dispose();
      });
      material.dispose();
      engravingLines.current = [];
    };
  }, [reducedMotion]);

  useFrame((frameState, delta) => {
    const a = anim.current;
    const t = frameState.clock.elapsedTime;
    if (introStart.current === null) introStart.current = t;
    const intro = reducedMotion ? 1 : Math.min(1, (t - introStart.current) / 2.6);

    // Entrance: the vault rises into place and the engraving draws itself.
    if (rootRef.current) {
      const rise = easeOutCubic(Math.min(1, intro * 1.6));
      rootRef.current.position.y = (1 - rise) * -0.5;
      rootRef.current.scale.setScalar(0.88 + 0.12 * rise);
    }
    engravingLines.current.forEach((line, index) => {
      const total = line.geometry.attributes.position.count;
      const local = Math.max(0, Math.min(1, intro * 1.25 - index * 0.025));
      line.geometry.setDrawRange(0, Math.floor(total * easeOutCubic(local)));
    });
    if (engravingMaterial.current) {
      const target = state.warning || state.spinning ? CORAL_COLOR : PAPER_COLOR;
      engravingMaterial.current.color.lerp(target.clone().multiplyScalar(1.5), Math.min(1, delta * 3));
      engravingMaterial.current.opacity = state.spinning ? 0.45 + 0.25 * Math.sin(t * 6) : 0.5;
    }

    // Door and bolts: unlocking retracts the bolts first, then the door swings.
    const wantOpen = state.doorOpen;
    const boltTarget = wantOpen ? 0 : Math.abs(a.door) < 0.05 ? 1 : 0;
    const doorTarget = wantOpen && a.bolts < 0.2 ? DOOR_OPEN_ANGLE : 0;
    a.bolts = reducedMotion ? boltTarget : MathUtils.damp(a.bolts, boltTarget, 7, delta);
    a.door = reducedMotion ? doorTarget : MathUtils.damp(a.door, doorTarget, 3.2, delta);
    if (hingeRef.current) hingeRef.current.rotation.y = a.door;
    boltRefs.current.forEach((bolt, index) => {
      if (!bolt) return;
      const angle = (index / BOLT_COUNT) * Math.PI * 2;
      const radius = DOOR_R - 0.06 + a.bolts * 0.16;
      bolt.position.set(Math.sin(angle) * radius, Math.cos(angle) * radius, 0.1);
    });
    if (interiorLight.current) {
      const material = interiorLight.current.material as MeshBasicMaterial;
      material.opacity = Math.min(1, Math.abs(a.door) / 1.2) * 0.7;
    }

    // Dial: follows the chosen days, spins while waiting, turns once on entrance.
    if (!a.dragging) {
      a.dialTarget = daysToDialAngle(state.dialDays);
      if (state.spinning && !reducedMotion) {
        a.dial += delta * 2.4;
      } else {
        const introSpin = reducedMotion ? 0 : (1 - easeOutCubic(intro)) * Math.PI * 2;
        const target = a.dialTarget + introSpin;
        // Take the short way round.
        let diff = target - a.dial;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        a.dial = reducedMotion ? target : a.dial + diff * Math.min(1, delta * 6);
      }
    }
    if (dialRef.current) dialRef.current.rotation.z = a.dial;
    if (handleRef.current) handleRef.current.rotation.z = a.dial * 0.35;

    // Heartbeat ring: a double beat, faster when overdue.
    if (ringMaterial.current) {
      const period = state.heartbeat.overdue ? 0.7 : 1.15;
      const phase = (t % period) / period;
      const beat = reducedMotion
        ? 0
        : Math.exp(-Math.pow((phase - 0.08) * 18, 2)) + 0.6 * Math.exp(-Math.pow((phase - 0.26) * 18, 2));
      const base = state.heartbeat.overdue ? CORAL_COLOR : LIME_COLOR;
      ringMaterial.current.color.copy(base).multiplyScalar(1.3 + beat * 1.6);
      ringMaterial.current.opacity = state.heartbeat.visible ? 1 : 0;
    }
    if (ringRef.current) {
      const target = state.heartbeat.visible ? 1 : 0.001;
      const s = reducedMotion ? target : MathUtils.damp(ringRef.current.scale.y, target, 5, delta);
      // Mirror on x so the arc runs clockwise from the top.
      ringRef.current.scale.set(-s, s, s);
    }

    // Pulse wave: on every confirmed check-in, and every few seconds in the landing story.
    if (state.pulseKey !== a.lastPulseKey) {
      a.lastPulseKey = state.pulseKey;
      a.waveStart = t;
    }
    if (state.autoPulse && !reducedMotion && t > a.nextAutoPulse) {
      a.waveStart = t;
      a.nextAutoPulse = t + 2.6;
    }
    if (waveRef.current && waveMaterial.current) {
      const age = t - a.waveStart;
      const progress = Math.min(1, age / 0.9);
      waveRef.current.visible = age < 0.9 && !reducedMotion;
      waveRef.current.scale.setScalar(1 + easeOutCubic(progress) * 0.9);
      waveMaterial.current.opacity = Math.pow(1 - progress, 2.2);
    }

    // Wax seal: stamps in when a new estate is confirmed.
    if (state.sealKey !== a.lastSealKey) {
      a.lastSealKey = state.sealKey;
      a.sealStart = t;
    }
    if (sealRef.current) {
      const age = t - a.sealStart;
      const stamping = age < 0.9 && !reducedMotion;
      const p = Math.min(1, age / 0.9);
      const drop = stamping ? Math.max(0, 1 - p * 1.5) : 0;
      const squash = stamping && p > 0.62 ? Math.sin((p - 0.62) / 0.38 * Math.PI) * 0.35 : 0;
      const visible = state.sealed ? 1 : 0;
      const current = sealRef.current.scale.x;
      const target = visible * (1 + squash * 0.4);
      const scale = reducedMotion ? target : MathUtils.damp(current, target, stamping ? 20 : 8, delta);
      sealRef.current.scale.set(scale, Math.max(0.001, scale * (1 - squash)), scale);
      sealRef.current.position.z = 0.27 + drop * 2.2;
    }
  });

  // Turning the dial with the mouse or a finger.
  const dragPlane = useMemo(() => new Plane(), []);
  const hit = useMemo(() => new Vector3(), []);
  const pointerAngle = (event: ThreeEvent<PointerEvent>) => {
    const dial = dialRef.current;
    if (!dial) return null;
    const center = new Vector3();
    dial.getWorldPosition(center);
    const normal = new Vector3(0, 0, 1).transformDirection(dial.matrixWorld);
    dragPlane.setFromNormalAndCoplanarPoint(normal, center);
    if (!event.ray.intersectPlane(dragPlane, hit)) return null;
    const local = dial.parent ? dial.parent.worldToLocal(hit.clone()) : hit.clone();
    // Clockwise from 12 o'clock.
    return Math.atan2(local.x, local.y);
  };

  const onDialDown = (event: ThreeEvent<PointerEvent>) => {
    if (!state.dialInteractive) return;
    event.stopPropagation();
    const angle = pointerAngle(event);
    if (angle === null) return;
    const target = event.target as unknown as { setPointerCapture?: (id: number) => void };
    target.setPointerCapture?.(event.pointerId);
    anim.current.dragging = true;
    anim.current.dragStartPointer = angle;
    anim.current.dragStartDial = anim.current.dial;
    document.body.style.cursor = "grabbing";
  };
  const onDialMove = (event: ThreeEvent<PointerEvent>) => {
    if (!anim.current.dragging) return;
    event.stopPropagation();
    const angle = pointerAngle(event);
    if (angle === null) return;
    // Turning the pointer clockwise turns the dial clockwise (negative z rotation).
    anim.current.dial = anim.current.dragStartDial - (angle - anim.current.dragStartPointer);
  };
  const onDialUp = (event: ThreeEvent<PointerEvent>) => {
    if (!anim.current.dragging) return;
    event.stopPropagation();
    anim.current.dragging = false;
    document.body.style.cursor = state.dialInteractive ? "grab" : "";
    const target = event.target as unknown as { releasePointerCapture?: (id: number) => void };
    target.releasePointerCapture?.(event.pointerId);
    state.onDialChange?.(angleToPreset(anim.current.dial));
  };

  const steel = (
    <meshPhysicalMaterial
      color="#1C3350"
      metalness={0.82}
      roughness={0.3}
      clearcoat={0.7}
      clearcoatRoughness={0.22}
    />
  );

  return (
    <group ref={rootRef}>
      {/* Body */}
      <RoundedBox args={[BODY.w, BODY.h, BODY.d]} radius={0.2} smoothness={5} position={[0, 0, -BODY.d / 2]} castShadow>
        {steel}
      </RoundedBox>

      {/* Thin paper inlay just inside the edge of the front face */}
      <lineLoop geometry={inlayGeometry} position={[0, 0, 0.004]}>
        <lineBasicMaterial color={PAPER_COLOR.clone().multiplyScalar(0.7)} transparent opacity={0.35} />
      </lineLoop>

      {/* Plaque with وارث */}
      <mesh position={[0, 1.27, 0.006]}>
        <planeGeometry args={[0.96, 0.32]} />
        <meshBasicMaterial map={plaqueTexture} transparent toneMapped={false} color={PAPER_COLOR.clone().multiplyScalar(1.25)} />
      </mesh>

      <group position={[0, DOOR_Y, 0]}>
        {/* The opening behind the door: a deep tunnel with a faint lime rim */}
        <mesh position={[0, 0, 0.003]}>
          <circleGeometry args={[DOOR_R, 96]} />
          <meshBasicMaterial map={tunnelTexture} />
        </mesh>
        <mesh ref={interiorLight} position={[0, 0, 0.006]}>
          <ringGeometry args={[DOOR_R - 0.035, DOOR_R, 128]} />
          <meshBasicMaterial color={LIME_COLOR.clone().multiplyScalar(1.4)} transparent opacity={0} blending={AdditiveBlending} toneMapped={false} />
        </mesh>

        {/* Door frame */}
        <mesh position={[0, 0, 0.03]}>
          <torusGeometry args={[DOOR_R + 0.05, 0.05, 20, 128]} />
          <meshStandardMaterial color="#C9C2AF" metalness={0.9} roughness={0.28} />
        </mesh>

        {/* Heartbeat track and live arc */}
        <mesh position={[0, 0, 0.02]}>
          <torusGeometry args={[RING_R, 0.012, 8, 220]} />
          <meshBasicMaterial color="#2B4262" transparent opacity={state.heartbeat.visible ? 0.9 : 0.35} />
        </mesh>
        <mesh ref={ringRef} geometry={ringGeometry} position={[0, 0, 0.03]} rotation={[0, 0, -Math.PI / 2]}>
          <meshBasicMaterial ref={ringMaterial} toneMapped={false} transparent />
        </mesh>
        <mesh ref={waveRef} position={[0, 0, 0.05]} visible={false}>
          <ringGeometry args={[RING_R - 0.006, RING_R + 0.012, 160]} />
          <meshBasicMaterial ref={waveMaterial} color={LIME_COLOR.clone().multiplyScalar(3)} transparent toneMapped={false} blending={AdditiveBlending} depthWrite={false} />
        </mesh>

        {/* Hinge on the left edge; the door swings toward the viewer */}
        <group ref={hingeRef} position={[-DOOR_R, 0, 0]}>
          <group position={[DOOR_R, 0, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, DOOR_T / 2]} castShadow>
              <cylinderGeometry args={[DOOR_R, DOOR_R, DOOR_T, 128]} />
              {steel}
            </mesh>

            {/* Engraved guilloché rosette on the door face */}
            <group ref={engravingRef} position={[0, 0, DOOR_T + 0.003]} />

            {/* Locking bolts */}
            {Array.from({ length: BOLT_COUNT }, (_, index) => {
              const angle = (index / BOLT_COUNT) * Math.PI * 2;
              return (
                <mesh
                  key={index}
                  ref={(node) => {
                    boltRefs.current[index] = node;
                  }}
                  rotation={[0, 0, -angle]}
                >
                  <cylinderGeometry args={[0.045, 0.045, 0.24, 20]} />
                  <meshStandardMaterial color="#D9D2BE" metalness={0.95} roughness={0.2} />
                </mesh>
              );
            })}

            {/* Handle spokes */}
            <group ref={handleRef} position={[0, 0, DOOR_T + 0.08]}>
              {[0, 1, 2].map((index) => (
                <mesh key={index} rotation={[0, 0, (index * Math.PI * 2) / 3]} position={[0, 0, 0]}>
                  <boxGeometry args={[0.035, 1.25, 0.035]} />
                  <meshStandardMaterial color="#D9D2BE" metalness={0.95} roughness={0.22} />
                </mesh>
              ))}
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const angle = (index * Math.PI) / 3;
                return (
                  <mesh key={index} position={[Math.sin(angle) * 0.625, Math.cos(angle) * 0.625, 0]}>
                    <sphereGeometry args={[0.05, 20, 20]} />
                    <meshStandardMaterial color={CORAL} metalness={0.3} roughness={0.35} />
                  </mesh>
                );
              })}
            </group>

            {/* Combination dial */}
            <group position={[0, 0, DOOR_T + 0.13]}>
              {/* Pointer at 12 o'clock */}
              <mesh position={[0, 0.43, 0.02]} rotation={[0, 0, Math.PI]}>
                <coneGeometry args={[0.045, 0.09, 3]} />
                <meshBasicMaterial color={CORAL_COLOR.clone().multiplyScalar(1.4)} toneMapped={false} />
              </mesh>
              <group ref={dialRef}>
                <mesh
                  rotation={[Math.PI / 2, 0, 0]}
                  onPointerDown={onDialDown}
                  onPointerMove={onDialMove}
                  onPointerUp={onDialUp}
                  onPointerCancel={onDialUp}
                  onPointerOver={() => {
                    if (state.dialInteractive) document.body.style.cursor = "grab";
                  }}
                  onPointerOut={() => {
                    if (!anim.current.dragging) document.body.style.cursor = "";
                  }}
                >
                  <cylinderGeometry args={[0.38, 0.4, 0.1, 96]} />
                  <meshStandardMaterial color="#D9D2BE" metalness={0.85} roughness={0.25} />
                </mesh>
                <mesh position={[0, 0, 0.052]}>
                  <circleGeometry args={[0.36, 96]} />
                  <meshStandardMaterial map={dialTexture} roughness={0.5} metalness={0.05} />
                </mesh>
                <mesh position={[0, 0, 0.09]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.08, 0.1, 0.08, 40]} />
                  <meshStandardMaterial color={CORAL} metalness={0.4} roughness={0.3} />
                </mesh>
              </group>
            </group>
          </group>
        </group>

        {/* Wax seal across the door seam */}
        <group ref={sealRef} position={[DOOR_R - 0.02, -0.08, 0.27]} scale={0.001}>
          <mesh geometry={sealGeometry} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <meshPhysicalMaterial color={CORAL} roughness={0.42} clearcoat={0.6} clearcoatRoughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0.037]}>
            <circleGeometry args={[0.17, 64]} />
            <meshStandardMaterial map={sealTexture} roughness={0.45} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
