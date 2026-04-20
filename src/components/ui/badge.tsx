import { cn } from '@/lib/utils'

interface BadgeProps {
  variant?: 'default' | 'outline' | 'secondary' | 'destructive' | 'ghost'
  className?: string
  children: React.ReactNode
}

export function Badge({ 
  variant = 'default', 
  className = '', 
  children 
}: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
      variant === 'default' ? 'border-transparent bg-primary text-primary-foreground' : '',
      variant === 'outline' ? 'border input bg-background text-primary-foreground' : '',
      variant === 'secondary' ? 'border-transparent bg-secondary text-secondary-foreground' : '',
      variant === 'destructive' ? 'border-transparent bg-destructive text-destructive-foreground' : '',
      variant === 'ghost' ? 'hover:bg-accent hover:text-accent-foreground' : '',
      className
    )}>
      {children}
    </span>
  )
}