'use client'

// ─── Upload Contract Trigger ──────────────────────────────────────────────────
//
// A button that wires external "Upload Contract" CTAs to the hidden file input
// inside ContractUploadSection.
//
// How it works:
//   1. Scrolls the ContractUploadSection (id="contract-upload") into view so
//      the user sees what is about to happen.
//   2. Dispatches CONTRACT_PICKER_EVENT on window so ContractUploadSection's
//      event listener calls inputRef.current.click(), opening the native file
//      picker dialog.
//
// ContractUploadSection imports CONTRACT_PICKER_EVENT and registers the
// listener on mount via useEffect.

import React from 'react'

export const CONTRACT_PICKER_EVENT = 'contract:open-picker'

interface UploadContractTriggerProps {
  className?: string
  children: React.ReactNode
}

export function UploadContractTrigger({ className, children }: UploadContractTriggerProps) {
  const handleClick = () => {
    // Scroll the upload section into view first (cosmetic — lets the user see it)
    const section = document.getElementById('contract-upload')
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    // Dispatch event — ContractUploadSection listener calls input.click()
    window.dispatchEvent(new CustomEvent(CONTRACT_PICKER_EVENT))
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  )
}
