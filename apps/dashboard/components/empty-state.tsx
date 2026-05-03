'use client'

import { LucideIcon } from 'lucide-react'
import { CopyButton } from '@/components/address-utils'

interface EmptyStateProps {
  icon: LucideIcon
  message: string
  cli?: string
}

export function EmptyState({ icon: Icon, message, cli }: EmptyStateProps) {
  return (
    <div className="bg-surface-1 border border-dashed border-border-subtle rounded-[6px] p-12 flex flex-col items-center justify-center text-center">
      <Icon className="h-10 w-10 text-text-muted mb-4" strokeWidth={1.5} />
      <p className="text-sm text-text-muted mb-4 font-sans">{message}</p>
      
      {cli && (
        <div className="flex items-center gap-2 bg-surface-2 px-3 py-1.5 rounded-[4px] border border-border-subtle group">
          <code className="text-[13px] font-mono text-accent">
            {cli}
          </code>
          <CopyButton value={cli} />
        </div>
      )}
    </div>
  )
}
