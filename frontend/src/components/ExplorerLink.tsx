import type { ReactNode } from "react";
import { WARIS_EXPLORER_URL } from "../warisConfig";

/** Links to the block explorer, or plain text on a local chain without one. */
export function ExplorerLink({
  path,
  children,
  className = "tx-link",
  arrow = true,
}: {
  path: string;
  children: ReactNode;
  className?: string;
  arrow?: boolean;
}) {
  if (!WARIS_EXPLORER_URL) return <span className={className}>{children}</span>;
  return (
    <a className={className} href={`${WARIS_EXPLORER_URL}${path}`} target="_blank" rel="noreferrer">
      {children}{arrow ? " ↗" : ""}
    </a>
  );
}
