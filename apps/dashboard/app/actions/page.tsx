'use client'

export default function ActionsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 500, marginBottom: 8 }}>
        Actions
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32 }}>
        Full top-up ledger from the daemon.
      </p>
      <div style={{
        border: '1px dashed var(--color-border-subtle)',
        borderRadius: 6,
        padding: 48,
        textAlign: 'center',
        color: 'var(--color-text-muted)'
      }}>
        No recent actions to display.
      </div>
    </div>
  )
}
