/*
 * Jest only: a named import through a barrel, with an alias, and a class
 * constant (harvest.test.tsx).
 */
import React from "react"
import { Widget as W } from "."

const HEADER = { className: "px-[20] pt-[10]" }

export const SiteB = () => <W title="Named" className={HEADER.className} />
