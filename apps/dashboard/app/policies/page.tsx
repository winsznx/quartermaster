'use client'

import { Shield } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'

export default function PoliciesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-medium text-text-primary tracking-tight">Policies</h1>
        <p className="text-sm text-text-secondary mt-1">
          Five composable guardrails on every action.
        </p>
      </div>

      <EmptyState 
        icon={Shield}
        message="Daemon offline. Start it to see policy evaluations."
        cli="zerion qm run"
      />
    </div>
  )
}
