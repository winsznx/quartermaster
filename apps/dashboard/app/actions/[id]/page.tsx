'use client'

import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'
import { EmptyState } from '@/components/empty-state'

export default function ActionDetailPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/actions" className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors w-fit">
        <ArrowLeft className="h-4 w-4" /> Back to Actions
      </Link>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[28px] font-medium text-text-primary tracking-tight">Action Detail</h1>
          <p className="text-sm text-text-secondary mt-1">
            Detailed timeline of a single top-up action.
          </p>
        </div>

        <EmptyState 
          icon={Search}
          message="Action details unavailable while daemon is offline."
          cli="zerion qm run"
        />
      </div>
    </div>
  )
}
