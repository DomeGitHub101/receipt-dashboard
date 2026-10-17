import { useMemo } from 'react'
import type * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeftIcon } from 'lucide-react'

import { Brand } from '../../components'
import { Button } from './button'

/**
 * Split auth layout: a welcome panel with drifting ribbon lines on the left (large screens) and the
 * form column on the right. The form is passed in as children.
 */
export function AuthPage({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  return (
    <main className="relative min-h-svh bg-background text-foreground lg:grid lg:grid-cols-2">
      <div className="auth-welcome relative hidden h-svh flex-col overflow-hidden p-10 lg:sticky lg:top-0 lg:flex">
        <div className="absolute inset-0 transform-gpu [contain:strict] will-change-transform">
          <FloatingPaths position={1} color="#ff6ba7" />
          <FloatingPaths position={-1} color="#b79cff" />
        </div>
        <div className="relative">
          <Brand />
        </div>
        <blockquote className="relative mt-auto space-y-2">
          <p className="font-[family-name:var(--font-display)] text-2xl leading-snug font-semibold">
            Small spends. Bigger picture. Snap a slip and see exactly where your month went.
          </p>
          <footer className="text-sm font-semibold text-muted-foreground">Less paper. More peace of mind.</footer>
        </blockquote>
      </div>
      <div className="auth-form-column relative flex min-h-svh flex-col justify-center overflow-hidden px-4 py-20">
        <div className="absolute inset-0 transform-gpu [contain:strict] lg:hidden">
          <FloatingPaths position={1} color="#ff6ba7" faint />
        </div>
        {onBack && (
          <Button type="button" variant="ghost" className="absolute top-7 left-5" onClick={onBack}>
            <ChevronLeftIcon className="me-2 size-4" />
            Back to sign in
          </Button>
        )}
        <div className="auth-form-card relative mx-auto w-full space-y-4 sm:w-sm">
          <div className="lg:hidden">
            <Brand />
          </div>
          {children}
        </div>
      </div>
    </main>
  )
}

// Ribbon-like lines drifting across the welcome panel, in the world's pink and lilac.
const PATH_COUNT = 16

function FloatingPaths({ position, color, faint = false }: { position: number; color: string; faint?: boolean }) {
  const reduceMotion = useReducedMotion()
  // Durations are drawn once so re-renders don't restart the animation.
  const paths = useMemo(
    () =>
      Array.from({ length: PATH_COUNT }, (_, id) => {
        const i = Math.round((id * 35) / (PATH_COUNT - 1))
        return {
          id,
          d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${
            312 - i * 5 * position
          } ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${
            470 - i * 6
          } ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
          width: 0.4 + id * 0.05,
          duration: 16 + Math.random() * 8,
        }
      }),
    [position],
  )

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full" viewBox="0 0 696 316" preserveAspectRatio="none" fill="none" aria-hidden="true">
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke={color}
            strokeWidth={path.width}
            strokeLinecap="round"
            strokeOpacity={(faint ? 0.14 : 0.2) + path.id * (faint ? 0.025 : 0.035)}
            initial={{ pathLength: 0.55, pathOffset: 0 }}
            // Only the dash offset moves, so the lines glide instead of blinking.
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
