# Feature: Code Selection → Chat Context Injection

This document explains the **Code Selection → Chat Context Injection** feature: what it does, why it was built this way, how to demo it, and its known limitations.

---

## 1. What it does

The app generates code in the **Code** panel and a live preview in the **Preview** panel. This feature lets a user:

1. Highlight a range of code in the Code panel.
2. Attach that snippet as **explicit context** for their next request.
3. See exactly what will be sent (an "Selection attached" chip) and remove it before sending.

It makes "Change/refactor/fix **this exact part**" trivial, without copy-pasting code into the chat box.

---

## 2. Why it was built this way

- **Iteration speed.** The most common follow-up is to tweak a small piece of generated code. Selecting it directly removes the copy/paste step and eliminates ambiguity about what "this" refers to.
- **Reuse of existing seams.** `app/page.tsx` already owns the send flow, and `lib/messages.ts` already converts internal message content into provider-ready messages. Injection is therefore a small, type-safe addition rather than a new subsystem.
- **Provider-agnostic.** The snippet travels inside the normal `messages` array, so it works identically for both generation (`/api/chat`) and Morph edits (`/api/morph-chat`) and for every LLM provider — no server changes needed.
- **Explicit, auditable context.** The snippet is wrapped in a clearly delimited, language-tagged code fence with its file path and line range, so the model can distinguish context from the instruction and the user can see what was sent.

---

## 3. How it works

```
CodeView (user highlights text)
    │  floating "Attach as context" button
    ▼
FragmentCode → Preview → app/page.tsx
    │  setSelection(MessageSelection)
    ▼
ChatInput  ── shows "Selection attached" chip (file · lines · preview) + ✕ to clear
    │
    ▼
handleSubmitAuth
    │  content = [ selection, { text: "your instruction" }, ...images ]
    ▼
toAISDKMessages  ── selection → delimited text context block
    │
    ▼
/api/chat  or  /api/morph-chat  ── unchanged
```

### Files touched

| File | Responsibility |
| --- | --- |
| `lib/messages.ts` | `MessageSelection` type, `MAX_SELECTION_CHARS`, `formatSelectionLocation`, `formatSelectionContext`, and `toAISDKMessages` conversion. |
| `components/code-view.tsx` | Captures the selection, computes line numbers, renders the floating attach button, enforces the size cap. |
| `components/fragment-code.tsx` | Threads `filePath` and `onAttachSelection` to `CodeView`. |
| `components/preview.tsx` | Threads `onAttachSelection` from the page to `FragmentCode`. |
| `app/page.tsx` | Holds the `selection` state, injects it into the outgoing message, clears it after send / on clear / on undo. |
| `components/chat-input.tsx` | Renders the visible "Selection attached" chip with a clear button. |
| `components/chat.tsx` | Renders the sent context in the transcript for transparency. |
| `lib/messages.test.ts` | Unit tests for the formatting and conversion logic. |

### The message shape

A selection is stored as a first-class content part:

```ts
export type MessageSelection = {
  type: 'selection'
  text: string
  filePath: string
  startLine?: number
  endLine?: number
}
```

When sent, it becomes a delimited text block, placed **before** the user's instruction:

```
The user selected the following code from `app.py` (lines 12-18) as context:

```python
<the selected code>
```


---

## 4. How to demo

**Setup**

```bash
npm install
cp .env.template .env.local
# Set at least: E2B_API_KEY and one LLM provider key (e.g. ANTHROPIC_API_KEY)
npm run dev
# open http://localhost:3000
```

**Demo script**

1. In the chat box, ask for a small app, e.g. *"a Next.js page with a counter button"*, and send.
2. Wait for generation, then confirm the **Code** tab in the right panel shows the source.
3. **Highlight a few lines** in the code.
4. A floating **"Attach as context"** button appears next to the selection. Click it.
5. Point out the chip above the input: **"Selection attached"** with the file name, line range, and a short preview.
6. Optionally click the **✕** on the chip to show it can be removed, then re-attach.
7. Type an instruction such as *"refactor the selected lines to use a helper function"* and send.
8. Observe that:
   - the assistant's updated code reflects the change,
   - the transcript shows the context card that was sent,
   - the chip has cleared automatically after sending.

**Bonus:** highlight a very large block (> 8000 characters) and click attach — a destructive toast rejects it.

---

## 5. Known limitations

- **Single selection.** Only one snippet can be attached at a time; attaching a new selection replaces the previous one.
- **Maximum size: 8000 characters.** Oversized selections are rejected with a toast (not truncated). The constant lives in `MAX_SELECTION_CHARS` (`lib/messages.ts`) and is easy to tune.
- **Plain-text context.** Syntax highlighting is stripped; the model receives the raw text. The fenced language is inferred from the file extension.
- **Code-panel only.** Selections elsewhere in the UI are ignored — the detector checks that the range is inside the code element.
- **Line numbers are a best-effort estimate** computed from the rendered code at selection time. They match the currently displayed file, which is correct for the single-file fragments the app produces.
- **Client-side size enforcement only.** The 8000-character cap is enforced in the browser; the API routes do not independently re-validate it.
- **Not persisted.** The attachment lives in React state for the session only. It is not saved to `localStorage` (unlike the chat input text) and is lost on reload.
- **No multi-file support yet.** `FragmentCode` currently renders one file, so selections are single-file.
- **Keyboard selection** works after focusing the code block, but mouse selection is the primary interaction. The floating button hides when the selection collapses or leaves the code block.

---

## 6. Tests

The pure formatting/conversion logic is covered by unit tests:

```bash
npm test
```

The suite uses Node's built-in test runner via `tsx` (no extra test dependencies) and covers:

- line-label formatting (`lines 12-18`, `line 4`, omitted when unknown),
- language inference by extension,
- fence auto-growing for embedded backticks,
- exact snippet preservation,
- conversion of a selection into an explicit context block,
- ordering, pass-through of images, and non-mutation of the original messages.
