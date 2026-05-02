'use client'

export default function SettingsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 500, marginBottom: 8 }}>
        Settings
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32 }}>
        Read-only configuration view.
      </p>
      <div style={{
        border: '1px dashed var(--color-border-subtle)',
        borderRadius: 6,
        padding: 48,
        textAlign: 'center',
        color: 'var(--color-text-muted)',
        fontFamily: 'var(--font-jetbrains-mono)'
      }}>
        Modify settings via CLI:<br/>
        <span style={{ color: 'var(--color-accent)', marginTop: 12, display: 'block' }}>
          zerion qm policy set &lt;name&gt; &lt;param&gt;=&lt;value&gt;
        </span>
      </div>
    </div>
  )
}
