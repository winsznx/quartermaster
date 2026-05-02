'use client'

import Link from "next/link";

export default function PolicyDetailPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 500, marginBottom: 8 }}>
        Policy Detail
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32 }}>
        Configuration and evaluation history for a single policy.
      </p>
      <div style={{
        border: '1px dashed var(--color-border-subtle)',
        borderRadius: 6,
        padding: 48,
        textAlign: 'center',
        color: 'var(--color-text-muted)'
      }}>
        <Link href="/policies" style={{ color: 'var(--color-accent)' }}>
          ← Back to Policies
        </Link>
      </div>
    </div>
  )
}
