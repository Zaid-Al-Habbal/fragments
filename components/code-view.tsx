'use client'

// import "prismjs/plugins/line-numbers/prism-line-numbers.js";
// import "prismjs/plugins/line-numbers/prism-line-numbers.css";
import './code-theme.css'
import { useToast } from '@/components/ui/use-toast'
import { MAX_SELECTION_CHARS, type MessageSelection } from '@/lib/messages'
import { MessageSquarePlus } from 'lucide-react'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-typescript'
import { useEffect, useRef, useState } from 'react'

type PendingSelection = {
  text: string
  top: number
  left: number
  startLine: number
  endLine: number
}

const BUTTON_HEIGHT = 32
const BUTTON_WIDTH = 160

// Counts the 1-based line number of a position inside the code element by
// measuring the text between the start of the block and that position.
function getLineNumber(node: Node, offset: number, container: HTMLElement) {
  const range = document.createRange()
  range.setStart(container, 0)
  range.setEnd(node, offset)
  return range.toString().split('\n').length
}

export function CodeView({
  code,
  lang,
  filePath,
  onAttachSelection,
}: {
  code: string
  lang: string
  filePath?: string
  onAttachSelection?: (selection: MessageSelection) => void
}) {
  const [pending, setPending] = useState<PendingSelection | null>(null)
  const codeRef = useRef<HTMLElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    Prism.highlightAll()
  }, [code, lang])

  // Hide the floating button when the user clears the selection or clicks away.
  useEffect(() => {
    function handleSelectionChange() {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) {
        setPending(null)
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    return () =>
      document.removeEventListener('selectionchange', handleSelectionChange)
  }, [])

  function captureSelection() {
    if (!onAttachSelection) {
      return
    }

    const element = codeRef.current
    const selection = window.getSelection()

    if (!element || !selection || selection.isCollapsed) {
      setPending(null)
      return
    }

    const range = selection.getRangeAt(0)
    if (!element.contains(range.commonAncestorContainer)) {
      setPending(null)
      return
    }

    const text = selection.toString()
    if (!text.trim()) {
      setPending(null)
      return
    }

    const rect = range.getBoundingClientRect()
    const fitsBelow = rect.bottom + BUTTON_HEIGHT + 8 <= window.innerHeight

    setPending({
      text,
      top: fitsBelow ? rect.bottom + 8 : rect.top - BUTTON_HEIGHT - 8,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - BUTTON_WIDTH)),
      startLine: getLineNumber(
        range.startContainer,
        range.startOffset,
        element,
      ),
      endLine: getLineNumber(range.endContainer, range.endOffset, element),
    })
  }

  function handleAttach() {
    if (!pending || !onAttachSelection) {
      return
    }

    if (pending.text.length > MAX_SELECTION_CHARS) {
      toast({
        variant: 'destructive',
        title: 'Selection too large',
        description: `Select fewer than ${MAX_SELECTION_CHARS.toLocaleString()} characters (currently ${pending.text.length.toLocaleString()}).`,
      })
      setPending(null)
      return
    }

    onAttachSelection({
      type: 'selection',
      text: pending.text,
      filePath: filePath ?? '',
      startLine: pending.startLine,
      endLine: pending.endLine,
    })

    window.getSelection()?.removeAllRanges()
    setPending(null)
  }

  return (
    <>
      <pre
        tabIndex={0}
        className="p-4 pt-2 outline-none focus-visible:ring-1 focus-visible:ring-ring"
        style={{
          fontSize: 12,
          backgroundColor: 'transparent',
          borderRadius: 0,
          margin: 0,
        }}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
      >
        <code ref={codeRef} className={`language-${lang}`}>
          {code}
        </code>
      </pre>
      {pending && onAttachSelection && (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleAttach}
          style={{ position: 'fixed', top: pending.top, left: pending.left }}
          className="z-50 flex items-center gap-1.5 rounded-md border bg-popover px-2 py-1.5 text-xs font-medium text-popover-foreground shadow-md transition-colors hover:bg-accent"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Attach as context
        </button>
      )}
    </>
  )
}
