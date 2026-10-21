/*
 * Jest only: a site forwarding its caller's class, which only a rewrite can
 * settle (harvest.test.tsx).
 */
import React from "react"
import Widget from "../callsites/Widget"

export const SiteC = ({ className }: { className?: string }) => (
  <Widget title="Forward" className={className} />
)
