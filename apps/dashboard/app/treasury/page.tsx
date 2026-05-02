'use client'

export default function TreasuryPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 500, marginBottom: 8 }}>
        Treasury
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32 }}>
        Manage your yield sources for automated top-ups.
      </p>
      <div style={{
        border: '1px dashed var(--color-border-subtle)',
        borderRadius: 6,
        padding: 48,
        textAlign: 'center',
        color: 'var(--color-text-muted)',
        fontFamily: 'var(--font-jetbrains-mono)'
      }}>
        No yield sources registered. Add one with:<br/>
        <span style={{ color: 'var(--color-accent)', marginTop: 12, display: 'block' }}>
          zerion treasury add &lt;id&gt; &lt;address&gt; &lt;symbol&gt; &lt;chain&gt;
        </span>
      </div>
    </div>
  )
}
