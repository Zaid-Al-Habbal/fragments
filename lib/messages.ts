import type { FragmentSchema } from './schema'
import type { ExecutionResult } from './types'
import type { DeepPartial } from 'ai'

// Maximum number of characters allowed in a single attached code selection.
export const MAX_SELECTION_CHARS = 8000

export type MessageText = {
  type: 'text'
  text: string
}

export type MessageCode = {
  type: 'code'
  text: string
}

export type MessageImage = {
  type: 'image'
  image: string
}

export type MessageSelection = {
  type: 'selection'
  text: string
  filePath: string
  startLine?: number
  endLine?: number
}

export type Message = {
  role: 'assistant' | 'user'
  content: Array<MessageText | MessageCode | MessageImage | MessageSelection>
  object?: DeepPartial<FragmentSchema>
  result?: ExecutionResult
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  py: 'python',
  vue: 'vue',
  json: 'json',
  html: 'html',
  css: 'css',
  md: 'markdown',
  sh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
}

function getSelectionLanguage(filePath: string) {
  const extension = filePath.split('.').pop()?.toLowerCase() ?? ''
  return LANGUAGE_BY_EXTENSION[extension] ?? ''
}

// Build a markdown code fence that is longer than any run of backticks inside
// the snippet, so the selected code can never accidentally close the fence.
function getSelectionFence(text: string) {
  const longestRun = (text.match(/`+/g) ?? []).reduce(
    (longest, run) => Math.max(longest, run.length),
    0,
  )
  return '`'.repeat(Math.max(3, longestRun + 1))
}

export function formatSelectionContext(selection: MessageSelection) {
  const lineInfo =
    selection.startLine && selection.endLine
      ? ` (lines ${selection.startLine}-${selection.endLine})`
      : ''
  const language = getSelectionLanguage(selection.filePath)
  const fence = getSelectionFence(selection.text)

  return `The user selected the following code from \`${selection.filePath}\`${lineInfo} as context:\n\n${fence}${language}\n${selection.text}\n${fence}`
}

export function toAISDKMessages(messages: Message[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content.map((content) => {
      if (content.type === 'code') {
        return {
          type: 'text',
          text: content.text,
        }
      }

      if (content.type === 'selection') {
        return {
          type: 'text',
          text: formatSelectionContext(content),
        }
      }

      return content
    }),
  }))
}

export async function toMessageImage(files: File[]) {
  if (files.length === 0) {
    return []
  }

  return Promise.all(
    files.map(async (file) => {
      const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
      return `data:${file.type};base64,${base64}`
    }),
  )
}
