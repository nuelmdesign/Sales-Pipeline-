"use client"

import * as React from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"
import { ease, stagger as staggerTokens } from "@/lib/motion"

type BlurTextProps = {
  text: string
  /** Animate per word (default) or per character. */
  by?: "word" | "char"
  as?: "h1" | "h2" | "h3" | "p" | "span"
  stagger?: number
  delay?: number
  /** Wait until the text scrolls into view. */
  inView?: boolean
  className?: string
}

function BlurText({
  text,
  by = "word",
  as = "p",
  stagger = by === "word" ? staggerTokens.base : staggerTokens.tight,
  delay = 0,
  inView = false,
  className,
}: BlurTextProps) {
  const Comp = motion[as]
  const parts = by === "word" ? text.split(" ") : Array.from(text)

  const trigger = inView
    ? { whileInView: "visible", viewport: { once: true, margin: "-40px" } }
    : { animate: "visible" }

  return (
    <Comp
      data-slot="blur-text"
      aria-label={text}
      initial="hidden"
      {...trigger}
      transition={{ staggerChildren: stagger, delayChildren: delay }}
      className={cn(className)}
    >
      {parts.map((part, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="inline-block whitespace-pre"
          variants={{
            hidden: { opacity: 0, filter: "blur(10px)", y: 8 },
            visible: {
              opacity: 1,
              filter: "blur(0px)",
              y: 0,
              transition: { duration: 0.5, ease: ease.out },
            },
          }}
        >
          {part}
          {by === "word" && i < parts.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </Comp>
  )
}

export { BlurText }
