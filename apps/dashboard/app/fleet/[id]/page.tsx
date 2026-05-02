'use client'

import Link from "next/link";

export default function WalletDetailPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 500, marginBottom: 8 }}>
        Wallet Detail
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32 }}>
        Details for a single subordinate wallet.
      </p>
      <div style={{
        border: '1px dashed var(--color-border-subtle)',
        borderRadius: 6,
        padding: 48,
        textAlign: 'center',
        color: 'var(--color-text-muted)'
      }}>
        <Link href="/fleet" style={{ color: 'var(--color-accent)' }}>
          ← Back to Fleet
        </Link>
      </div>
    </div>
  )
}
