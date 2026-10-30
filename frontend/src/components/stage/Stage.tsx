import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import type { StageState } from "./stageTypes";

const VaultScene = lazy(() => import("./VaultScene"));

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** If the 3D scene ever fails, keep the page working and show the still poster instead. */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** The 3D vault, or a still poster when WebGL is unavailable or while it loads. */
export function Stage({ state, caption }: { state: StageState; caption?: string }) {
  const [webgl] = useState(hasWebGL);
  const [ready, setReady] = useState(false);
  const poster = <div className="stage-poster" aria-hidden="true"><span /></div>;

  return (
    <div className={ready ? "stage is-ready" : "stage"}>
      {!ready && poster}
      {webgl && (
        <SceneBoundary fallback={poster}>
          <Suspense fallback={null}>
            <VaultScene state={state} onReady={() => setReady(true)} />
          </Suspense>
        </SceneBoundary>
      )}
      {caption && <p className="stage-caption">{caption}</p>}
    </div>
  );
}
