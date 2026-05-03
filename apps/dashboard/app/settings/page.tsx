'use client'

import { Settings } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-medium text-text-primary tracking-tight">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">
          Read-only configuration. Edit via CLI.
        </p>
      </div>

      <EmptyState 
        icon={Settings}
        message="Daemon offline. Start it to load configuration."
        cli="zerion qm run"
      />
    </div>
  )
}
