'use client'

export default function FleetPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 500, marginBottom: 8 }}>
        Fleet
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32 }}>
        Monitor your subordinate agent wallets and their runway.
      </p>
      <div style={{
        border: '1px dashed var(--color-border-subtle)',
        borderRadius: 6,
        padding: 48,
        textAlign: 'center',
        color: 'var(--color-text-muted)',
        fontFamily: 'var(--font-jetbrains-mono)'
      }}>
        No wallets registered. Add one with:<br/>
        <span style={{ color: 'var(--color-accent)', marginTop: 12, display: 'block' }}>
          zerion fleet add &lt;wallet-id&gt; &lt;address&gt;
        </span>
      </div>
    </div>
  )
}
