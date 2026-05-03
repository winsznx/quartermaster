'use client'

import { ArrowLeftRight } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'

export default function ActionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-medium text-text-primary tracking-tight">Actions</h1>
        <p className="text-sm text-text-secondary mt-1">
          Top-up ledger. Every action logged.
        </p>
      </div>

      <EmptyState 
        icon={ArrowLeftRight}
        message="No actions recorded yet."
      />
    </div>
  )
}
