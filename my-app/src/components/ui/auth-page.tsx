import { useMemo } from 'react'
import type * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeftIcon } from 'lucide-react'

import { Button } from './button'

/**
 * Split auth layout: an animated "floating paths" panel on the left (large screens) and the
 * form column on the right. Adapted from the 21st.dev auth-page; the form is passed in as children.
 */
export function AuthPage({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  return (
    <main className="relative min-h-svh bg-background text-foreground lg:grid lg:grid-cols-2">
      <div className="relative hidden h-svh flex-col overflow-hidden border-r border-border bg-muted/60 p-10 lg:sticky lg:top-0 lg:flex">
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-background to-transparent" />
        <div className="z-10 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-xl leading-relaxed">
              &ldquo;Small spends. Bigger picture. Snap a slip and see exactly where your month
              went.&rdquo;
            </p>
            <footer className="font-mono text-sm font-semibold text-muted-foreground">
              ~ Less paper. More peace of mind.
            </footer>
          </blockquote>
        </div>
        <div className="absolute inset-0 transform-gpu [contain:strict] will-change-transform">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>
      </div>
      <div className="relative flex min-h-svh flex-col justify-center overflow-hidden px-4 py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_85%_0%,--theme(--color-foreground/.05)_0,transparent_70%)]"
        />
        {onBack && (
          <Button type="button" variant="ghost" className="absolute top-7 left-5" onClick={onBack}>
            <ChevronLeftIcon className="me-2 size-4" />
            Back to sign in
          </Button>
        )}
        <div className="relative mx-auto w-full space-y-4 sm:w-sm">{children}</div>
      </div>
    </main>
  )
}

// Fewer, slightly bolder lines keep the look while cutting the per-frame paint work.
const PATH_COUNT = 20

function FloatingPaths({ position }: { position: number }) {
  const reduceMotion = useReducedMotion()
  // Durations are drawn once so re-renders don't restart the animation.
  const paths = useMemo(
    () =>
      Array.from({ length: PATH_COUNT }, (_, id) => {
        // Spread the fewer lines over the same fan the original 36 covered.
        const i = Math.round((id * 35) / (PATH_COUNT - 1))
        return {
          id,
          d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${
            312 - i * 5 * position
          } ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${
            470 - i * 6
          } ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
          width: 0.5 + id * 0.05,
          duration: 14 + Math.random() * 7,
        }
      }),
    [position],
  )

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        className="h-full w-full text-primary"
        viewBox="0 0 696 316"
        fill="none"
        aria-hidden="true"
      >
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.12 + path.id * 0.04}
            initial={{ pathLength: 0.6, pathOffset: 0 }}
            // Only the dash offset moves: no opacity pulsing, so the lines glide instead of blinking.
            animate={reduceMotion ? { pathLength: 1 } : { pathOffset: [0, 1] }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: path.duration, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }
            }
          />
        ))}
      </svg>
    </div>
  )
}

export function AuthSeparator({ label = 'OR' }: { label?: string }) {
  return (
    <div className="flex w-full items-center justify-center">
      <div className="h-px w-full bg-border" />
      <span className="px-2 text-xs whitespace-nowrap text-muted-foreground">{label}</span>
      <div className="h-px w-full bg-border" />
    </div>
  )
}

export default AuthPage
