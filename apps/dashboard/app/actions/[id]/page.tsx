'use client'

import Link from "next/link";

export default function ActionDetailPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 500, marginBottom: 8 }}>
        Action Detail
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32 }}>
        Detailed timeline of a single top-up action.
      </p>
      <div style={{
        border: '1px dashed var(--color-border-subtle)',
        borderRadius: 6,
        padding: 48,
        textAlign: 'center',
        color: 'var(--color-text-muted)'
      }}>
        <Link href="/actions" style={{ color: 'var(--color-accent)' }}>
          ← Back to Actions
        </Link>
      </div>
    </div>
  )
}
