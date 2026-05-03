'use client'

import { Bot } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'

export default function FleetPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-medium text-text-primary tracking-tight">Fleet</h1>
        <p className="text-sm text-text-secondary mt-1">
          Subordinate agent wallets and their runway.
        </p>
      </div>

      <EmptyState 
        icon={Bot}
        message="No wallets registered."
        cli="zerion fleet add <wallet-id> <address>"
      />
    </div>
  )
}
