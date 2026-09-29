import {
  MAX_SELECTION_CHARS,
  formatSelectionContext,
  formatSelectionLocation,
  toAISDKMessages,
  type Message,
  type MessageSelection,
} from './messages'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

const baseSelection: MessageSelection = {
  type: 'selection',
  text: 'const answer = 42',
  filePath: 'src/index.ts',
  startLine: 3,
  endLine: 5,
}

describe('MAX_SELECTION_CHARS', () => {
  it('is a positive, sensible prompt budget', () => {
    assert.equal(MAX_SELECTION_CHARS, 8000)
  })
})

describe('formatSelectionLocation', () => {
  it('formats a multi-line range', () => {
    assert.equal(formatSelectionLocation(baseSelection), 'lines 3-5')
  })

  it('formats a single line without a range', () => {
    assert.equal(
      formatSelectionLocation({ ...baseSelection, startLine: 4, endLine: 4 }),
      'line 4',
    )
  })

  it('returns an empty string when line information is missing', () => {
    assert.equal(
      formatSelectionLocation({
        ...baseSelection,
        startLine: undefined,
        endLine: undefined,
      }),
      '',
    )
    assert.equal(
      formatSelectionLocation({
        ...baseSelection,
        startLine: 3,
        endLine: undefined,
      }),
      '',
    )
  })
})

describe('formatSelectionContext', () => {
  it('includes the file path, line range and a fenced snippet', () => {
    const result = formatSelectionContext(baseSelection)

    assert.match(result, /`src\/index\.ts` \(lines 3-5\)/)
    assert.match(result, /```typescript\nconst answer = 42\n```/)
  })

  it('renders a single-line selection as "line N"', () => {
    const result = formatSelectionContext({
      ...baseSelection,
      startLine: 7,
      endLine: 7,
    })

    assert.match(result, /`src\/index\.ts` \(line 7\)/)
  })

  it('omits line information when line numbers are missing', () => {
    const result = formatSelectionContext({
      ...baseSelection,
      startLine: undefined,
      endLine: undefined,
    })

    assert.match(result, /`src\/index\.ts` as context/)
    assert.doesNotMatch(result, /lines/)
  })

  it('omits line information when only one bound is present', () => {
    const result = formatSelectionContext({
      ...baseSelection,
      startLine: 3,
      endLine: undefined,
    })

    assert.doesNotMatch(result, /lines/)
  })

  it('infers the fenced language from the file extension', () => {
    assert.match(
      formatSelectionContext({ ...baseSelection, filePath: 'app.py' }),
      /```python\n/,
    )
    assert.match(
      formatSelectionContext({ ...baseSelection, filePath: 'App.TSX' }),
      /```tsx\n/,
    )
  })

  it('does not add a language tag for unknown extensions', () => {
    const result = formatSelectionContext({
      ...baseSelection,
      filePath: 'script',
    })

    assert.match(result, /\n\n```\nconst answer = 42\n```$/)
  })

  it('preserves the snippet exactly, without trimming', () => {
    const text = '  const spaced = 1  \n\n'
    const result = formatSelectionContext({ ...baseSelection, text })

    assert.ok(result.includes(`\n${text}\n`))
  })

  it('grows the fence so selected backticks cannot close the block', () => {
    const text = '```\ninner\n```'
    const result = formatSelectionContext({ ...baseSelection, text })

    // Longest backtick run is 3, so the fence must be at least 4 long.
    assert.match(result, /````typescript\n```\ninner\n```\n````$/)
  })

  it('grows the fence beyond the longest internal run', () => {
    const text = '````'
    const result = formatSelectionContext({ ...baseSelection, text })

    assert.match(result, /`````typescript\n````\n`````$/)
  })
})

describe('toAISDKMessages', () => {
  it('converts a selection part into an explicit text context block', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [baseSelection, { type: 'text', text: 'refactor this' }],
      },
    ]

    const [converted] = toAISDKMessages(messages)

    assert.equal(converted.role, 'user')
    assert.deepEqual(converted.content[0], {
      type: 'text',
      text: formatSelectionContext(baseSelection),
    })
    assert.deepEqual(converted.content[1], {
      type: 'text',
      text: 'refactor this',
    })
  })

  it('keeps existing code parts converted to plain text', () => {
    const messages: Message[] = [
      { role: 'assistant', content: [{ type: 'code', text: 'print(1)' }] },
    ]

    const [converted] = toAISDKMessages(messages)

    assert.deepEqual(converted.content[0], {
      type: 'text',
      text: 'print(1)',
    })
  })

  it('passes image parts through untouched', () => {
    const image = { type: 'image', image: 'data:image/png;base64,abc' } as const
    const messages: Message[] = [
      { role: 'user', content: [{ type: 'text', text: 'look' }, image] },
    ]

    const [converted] = toAISDKMessages(messages)

    assert.deepEqual(converted.content[1], image)
  })

  it('preserves message order and roles', () => {
    const messages: Message[] = [
      { role: 'user', content: [{ type: 'text', text: 'first' }] },
      { role: 'assistant', content: [{ type: 'code', text: 'second' }] },
    ]

    const converted = toAISDKMessages(messages)

    assert.equal(converted.length, 2)
    assert.equal(converted[0].role, 'user')
    assert.equal(converted[1].role, 'assistant')
    assert.deepEqual(converted[1].content[0], {
      type: 'text',
      text: 'second',
    })
  })

  it('does not mutate the original messages', () => {
    const messages: Message[] = [
      {
        role: 'user',
        content: [baseSelection, { type: 'text', text: 'make it async' }],
      },
    ]

    toAISDKMessages(messages)

    assert.equal(messages[0].content[0].type, 'selection')
    assert.equal(messages[0].content[1].type, 'text')
  })
})
