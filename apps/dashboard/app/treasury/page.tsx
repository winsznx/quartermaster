'use client'

import { Landmark } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'

export default function TreasuryPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-medium text-text-primary tracking-tight">Treasury</h1>
        <p className="text-sm text-text-secondary mt-1">
          Yield-bearing positions that fund top-ups.
        </p>
      </div>

      <EmptyState 
        icon={Landmark}
        message="No sources registered."
        cli="zerion treasury add <id> <address> <symbol> <chain>"
      />
    </div>
  )
}
