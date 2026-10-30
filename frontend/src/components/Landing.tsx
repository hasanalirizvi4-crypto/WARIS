import { useEffect, useRef } from "react";

export type LandingAct = 0 | 1 | 2 | 3;

const ACTS: { act: LandingAct; title: string; body: string; hint: string }[] = [
  {
    act: 1,
    title: "Set your heartbeat",
    body: "Choose how long WARIS waits between check-ins: 30, 60, 90 or 180 days, or any number up to ten years. The contract stores it in seconds.",
    hint: "Drag the dial on the vault to try it.",
  },
  {
    act: 2,
    title: "Name your heirs",
    body: "Add up to 20 wallet addresses and give each one a share of your estate. WARIS won't let the shares add up past 100%.",
    hint: "Each ribbon carries an heir's share.",
  },
  {
    act: 3,
    title: "Check in to stay in control",
    body: "Every check-in is a transaction you sign, and it resets the clock. If the deadline passes, the contract shows the estate as inactive, for anyone to verify.",
    hint: "The ring drains as the deadline gets closer.",
  },
];

/** The story for visitors who haven't connected yet. Scrolling drives the vault. */
export function Landing({ onConnect, onActChange, busy }: {
  onConnect: () => void;
  onActChange: (act: LandingAct) => void;
  busy: boolean;
}) {
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const act = Number((visible.target as HTMLElement).dataset.act) as LandingAct;
        onActChange(act);
      },
      { threshold: [0.35, 0.6], rootMargin: "-20% 0px -30% 0px" }
    );
    sectionRefs.current.forEach((section) => section && observer.observe(section));
    return () => observer.disconnect();
  }, [onActChange]);

  return (
    <main className="landing" id="top">
      <section
        className="landing-hero"
        data-act={0}
        ref={(node) => {
          sectionRefs.current[0] = node;
        }}
      >
        <h1 className="landing-title">Your crypto shouldn’t die with your keys.</h1>
        <p className="landing-lede">
          WARIS is an estate vault on Ethereum. Name your heirs, choose how long it waits
          for you, and check in now and then. The record lives on-chain, under your control.
        </p>
        <div className="landing-actions">
          <button className="btn btn--coral btn--large" type="button" onClick={onConnect} disabled={busy}>
            Connect wallet
          </button>
          <a className="link-button link-button--paper" href="#act-1">See how it works</a>
        </div>
        <p className="landing-small">Runs on Ethereum Sepolia, a test network. Nothing here costs real money.</p>
      </section>

      {ACTS.map((item) => (
        <section
          key={item.act}
          id={`act-${item.act}`}
          className="landing-act"
          data-act={item.act}
          ref={(node) => {
            sectionRefs.current[item.act] = node;
          }}
        >
          <span className="landing-act-number" aria-hidden="true">{item.act}</span>
          <h2>{item.title}</h2>
          <p>{item.body}</p>
          <p className="landing-hint">{item.hint}</p>
        </section>
      ))}

      <section className="landing-close">
        <h2>Ready when you are.</h2>
        <p>Connecting only shares your public address. Every change after that is a transaction you approve.</p>
        <button className="btn btn--coral btn--large" type="button" onClick={onConnect} disabled={busy}>
          Open your vault
        </button>
        <p className="landing-notice">
          Prototype on Ethereum Sepolia: test ETH has no real-world value. Today the contract
          records your plan and your check-ins. Locking assets and letting heirs claim them
          is the next upgrade.
        </p>
      </section>
    </main>
  );
}
