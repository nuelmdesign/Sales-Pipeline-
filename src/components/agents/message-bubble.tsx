"use client"

import { ChevronDown } from "lucide-react"
import { type HTMLMotionProps, motion, useReducedMotion } from "motion/react"
import {
  type ComponentPropsWithRef,
  type ElementType,
  createContext,
  type ReactElement,
  type ReactNode,
  type Ref,
  useCallback,
  useContext,
  useId,
  useState,
} from "react"
import { ease, spring } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { MessageSideContext } from "@/components/agents/message-context"

export type MessageBubbleVariant =
  "solid" | "soft" | "tint" | "outline" | "ghost" | "danger"
export type MessageBubbleAlign = "start" | "end"

interface MessageBubbleContextValue {
  align?: MessageBubbleAlign
  animateIn: boolean
  variant: MessageBubbleVariant
}

const MessageBubbleContext = createContext<MessageBubbleContextValue>({
  animateIn: true,
  variant: "soft",
})
const MessageBubbleLayoutContext = createContext<() => void>(() => {})

export interface MessageBubbleProps extends Omit<
  HTMLMotionProps<"div">,
  "children"
> {
  variant?: MessageBubbleVariant
  /** Defaults to the surrounding Message alignment when omitted. */
  align?: MessageBubbleAlign
  /** Plays the bubble entrance once when this component mounts. */
  animateIn?: boolean
  children?: ReactNode
}

export interface MessageBubbleContentProps extends ComponentPropsWithRef<"div"> {
  /** Replaces the content element while preserving bubble styling. */
  render?: ReactElement
}

export interface MessageBubbleGroupProps extends ComponentPropsWithRef<"div"> {
  spacing?: "compact" | "default"
}

export interface MessageBubbleCollapsibleProps extends ComponentPropsWithRef<"div"> {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  collapsedLines?: 2 | 3 | 4 | 5 | 6
  moreLabel?: ReactNode
  lessLabel?: ReactNode
  contentClassName?: string
  triggerClassName?: string
  children?: ReactNode
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value)
  else if (ref) (ref as { current: T | null }).current = value
}

const BUBBLE_CONTENT_REVEAL = {
  duration: 0.12,
  ease: ease.out,
  delay: 0.04,
} as const

export function MessageBubble({
  variant = "soft",
  align,
  animateIn = false,
  className,
  children,
  initial,
  animate,
  exit,
  transition,
  layout,
  ...props
}: MessageBubbleProps) {
  const reduce = useReducedMotion() ?? false
  const messageSide = useContext(MessageSideContext)
  const resolvedAlign = align ?? messageSide ?? "start"

  return (
    <MessageBubbleContext.Provider
      value={{ align: resolvedAlign, animateIn, variant }}
    >
      <motion.div
        data-slot="message-bubble"
        data-align={resolvedAlign}
        data-variant={variant}
        layout={layout}
        initial={initial ?? false}
        animate={animate}
        exit={
          exit ?? (reduce ? { opacity: 0 } : { opacity: 0, y: -3, scale: 0.99 })
        }
        transition={transition ?? (reduce ? { duration: 0.12 } : spring.smooth)}
        className={cn(
          "group/bubble flex w-full flex-col",
          resolvedAlign === "end" ? "items-end" : "items-start",
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    </MessageBubbleContext.Provider>
  )
}

function bubbleContentClass(
  variant: MessageBubbleVariant,
  interactive: boolean
) {
  return cn(
    "relative z-0 max-w-[82%] min-w-9 rounded-2xl px-3.5 py-2.5 text-sm leading-6 text-foreground",
    "[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-background/60 [&_pre]:p-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
    variant === "solid" && "text-primary-foreground",
    variant === "ghost" && "w-full max-w-none rounded-none px-0 py-0",
    variant === "danger" && "text-destructive",
    interactive &&
      "cursor-pointer text-left transition-[background-color,color,transform] duration-150 outline-none hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
  )
}

function bubbleSurfaceClass(
  variant: MessageBubbleVariant,
  align: MessageBubbleAlign
) {
  return cn(
    "pointer-events-none absolute inset-0 -z-10 rounded-[inherit]",
    align === "end" ? "origin-bottom-right" : "origin-bottom-left",
    variant === "solid" && "bg-primary",
    variant === "soft" && "bg-muted",
    variant === "tint" && "bg-primary/10",
    variant === "outline" && "border border-border/70 bg-background",
    variant === "danger" && "bg-destructive/10"
  )
}

export function MessageBubbleContent({
  render,
  className,
  children,
  ref,
  ...props
}: MessageBubbleContentProps) {
  const reduce = useReducedMotion() ?? false
  const {
    align = "start",
    animateIn,
    variant,
  } = useContext(MessageBubbleContext)
  const [layoutVersion, setLayoutVersion] = useState(0)
  const notifyLayout = useCallback(
    () => setLayoutVersion((version) => version + 1),
    []
  )
  const interactive = render?.type === "button" || render?.type === "a"
  const renderRef = (render?.props as { ref?: Ref<HTMLElement> } | undefined)
    ?.ref
  const mergedRef = useCallback(
    (node: HTMLElement | null) => {
      assignRef(renderRef, node)
      assignRef(ref as Ref<HTMLElement> | undefined, node)
    },
    [renderRef, ref]
  )
  const classes = cn(bubbleContentClass(variant, interactive), className)
  const composedChildren = (
    <>
      {variant !== "ghost" ? (
        <motion.span
          aria-hidden="true"
          layout={reduce ? false : "size"}
          layoutDependency={layoutVersion}
          initial={
            animateIn && !reduce
              ? {
                  opacity: 0,
                  scale: 0.92,
                }
              : false
          }
          animate={{ opacity: 1, scale: 1 }}
          transition={
            reduce
              ? { duration: 0 }
              : {
                  opacity: { duration: 0.12, ease: ease.out },
                  scale: spring.pop,
                  layout: spring.smooth,
                }
          }
          className={bubbleSurfaceClass(variant, align)}
        />
      ) : null}
      <MessageBubbleLayoutContext.Provider value={notifyLayout}>
        <motion.div
          initial={
            animateIn ? (reduce ? { opacity: 0 } : { opacity: 0 }) : false
          }
          animate={{ opacity: 1 }}
          transition={
            reduce ? { duration: 0.12, ease: ease.out } : BUBBLE_CONTENT_REVEAL
          }
          className="relative"
        >
          {children}
        </motion.div>
      </MessageBubbleLayoutContext.Provider>
    </>
  )

  if (render) {
    const child = render as ReactElement<
      Record<string, unknown> & { className?: string }
    >
    const Element = child.type as ElementType

    return (
      <Element
        {...child.props}
        {...props}
        ref={mergedRef}
        className={cn(classes, child.props.className)}
        data-slot="message-bubble-content"
      >
        {composedChildren}
      </Element>
    )
  }

  return (
    <div
      ref={ref}
      data-slot="message-bubble-content"
      className={classes}
      {...props}
    >
      {composedChildren}
    </div>
  )
}

export function MessageBubbleGroup({
  spacing = "compact",
  className,
  ...props
}: MessageBubbleGroupProps) {
  return (
    <div
      data-slot="message-bubble-group"
      className={cn(
        "flex w-full flex-col",
        spacing === "compact" ? "gap-1.5" : "gap-3",
        className
      )}
      {...props}
    />
  )
}

const LINE_CLAMP_CLASS = {
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
  5: "line-clamp-5",
  6: "line-clamp-6",
} as const

export function MessageBubbleCollapsible({
  open,
  defaultOpen = false,
  onOpenChange,
  collapsedLines = 4,
  moreLabel = "Show more",
  lessLabel = "Show less",
  contentClassName,
  triggerClassName,
  className,
  children,
  ...props
}: MessageBubbleCollapsibleProps) {
  const reduce = useReducedMotion() ?? false
  const contentId = useId()
  const notifyLayout = useContext(MessageBubbleLayoutContext)
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const currentOpen = open ?? internalOpen

  const setOpen = useCallback(
    (next: boolean) => {
      notifyLayout()
      if (open === undefined) setInternalOpen(next)
      onOpenChange?.(next)
    },
    [notifyLayout, onOpenChange, open]
  )

  return (
    <div
      data-slot="message-bubble-collapsible"
      data-state={currentOpen ? "open" : "closed"}
      className={cn("w-full", className)}
      {...props}
    >
      <div
        id={contentId}
        className={cn(
          "transition-[mask-image] duration-200",
          !currentOpen && LINE_CLAMP_CLASS[collapsedLines],
          !currentOpen &&
            "[mask-image:linear-gradient(to_bottom,#000_68%,transparent_100%)]",
          contentClassName
        )}
      >
        {children}
      </div>
      <button
        type="button"
        aria-expanded={currentOpen}
        aria-controls={contentId}
        onClick={() => setOpen(!currentOpen)}
        className={cn(
          "mt-2 inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          triggerClassName
        )}
      >
        <span>{currentOpen ? lessLabel : moreLabel}</span>
        <motion.span
          aria-hidden="true"
          animate={{ rotate: currentOpen ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : spring.snappy}
        >
          <ChevronDown className="size-3.5" />
        </motion.span>
      </button>
    </div>
  )
}
