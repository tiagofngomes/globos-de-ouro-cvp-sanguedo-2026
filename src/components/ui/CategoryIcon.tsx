import {
  Award,
  Crown,
  Flame,
  HandHeart,
  Heart,
  Lightbulb,
  Medal,
  Rocket,
  ShieldCheck,
  Siren,
  Sparkles,
  Star,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../../lib/cn'

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  award: Award,
  zap: Zap,
  lightbulb: Lightbulb,
  heart: Heart,
  medal: Medal,
  trophy: Trophy,
  star: Star,
  crown: Crown,
  flame: Flame,
  rocket: Rocket,
  users: Users,
  shield: ShieldCheck,
  siren: Siren,
  'hand-heart': HandHeart,
}

export function CategoryIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = CATEGORY_ICONS[icon] ?? Trophy
  return <Icon className={cn('h-6 w-6', className)} strokeWidth={1.6} />
}

/** Medalhão dourado com o ícone da categoria. */
export function CategoryMedallion({ icon, size = 'md', className }: { icon: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const dims = { sm: 'h-10 w-10', md: 'h-14 w-14', lg: 'h-20 w-20', xl: 'h-28 w-28' }[size]
  const iconDims = { sm: 'h-5 w-5', md: 'h-7 w-7', lg: 'h-10 w-10', xl: 'h-14 w-14' }[size]
  return (
    <div
      className={cn('relative grid shrink-0 place-items-center rounded-full', dims, className)}
      style={{
        background: 'radial-gradient(circle at 30% 25%, #fdf8e8, #ecc95a 35%, #b07f1f 70%, #5f4314)',
        boxShadow: '0 0 0 3px rgba(11,9,7,.9), 0 0 0 4px rgba(236,201,90,.55), 0 12px 30px -8px rgba(227,181,58,.6)',
      }}
    >
      <CategoryIcon icon={icon} className={cn('text-gala-900', iconDims)} />
    </div>
  )
}
