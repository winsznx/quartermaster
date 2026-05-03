'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-text-muted hover:text-text-primary"
      onClick={copy}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}

export function TruncatedAddress({ address }: { address: string }) {
  if (!address) return null
  const truncated = `${address.slice(0, 8)}...${address.slice(-6)}`
  
  return (
    <div className="flex items-center gap-2 font-mono text-[12px]">
      <span>{truncated}</span>
      <CopyButton value={address} />
    </div>
  )
}
