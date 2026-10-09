"use client"

import { useSyncExternalStore } from "react"

const QUERY = "(any-pointer: coarse)"

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

/**
 * True on devices that can be touched, whatever else they claim. Not the
 * inverse of useHoverCapable: iPadOS reports a fine hovering pointer while a
 * finger is the only input, so gate the touch path of an interaction on this
 * and leave hover-only polish on useHoverCapable. iPadOS disguises its pointer
 * media queries but reports maxTouchPoints honestly.
 */
export function useTouchCapable() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches || navigator.maxTouchPoints > 0,
    () => false
  )
}
