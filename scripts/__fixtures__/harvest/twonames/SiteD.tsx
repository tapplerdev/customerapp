/*
 * Jest only: one file importing the component more than once, under names
 * of its own, as FilterScreen imports FilterItem (harvest.test.tsx pins each
 * line).
 */
/* eslint-disable import/no-duplicates */
import React from "react"
import Widget from "../callsites/Widget"
import Card from "../callsites/Widget"
import { Widget as Named } from "../callsites/Widget"

export const SiteD = () => (
  <>
    <Widget title="As Widget" className="mt-[4]" />
    <Card title="As Card" />
    <Named title="As Named" />
  </>
)
