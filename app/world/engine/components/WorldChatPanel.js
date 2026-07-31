import { rememberParallelDialogue } from '../../../lib/echo-memory.ts'
import {
  repairEchoOutput,
  sanitizeEchoChatPayload,
} from '../../../../lib/echo-runtime.ts'

const RESPONSE_IDS_KEY = 'echo.chat.responseIds'
const MESSAGE_KEY_PREFIX = 'echo.chat.messages.'
const MAX_MESSAGE_LENGTH = 1000

export class WorldChatPanel {
  constructor({ mount, character, onOpen, onClose }) {
    this.mount = mount
    this.character = character
    this.onOpen = onOpen
    this.onClose = onClose

    this.isOpen = false
    this.input = ''
    this.isStreaming = false
    this.error = ''
    this.previousResponseId = ''
    this.activeCharacterId = character.id
    this.abortController = null
    this.abortReason = ''
    this.hasStartedConversation = false
    this.restartRequired = false
    this.isPinnedToBottom = true
    this.worldContext = null
    this.responseIds = readSessionJson(RESPONSE_IDS_KEY, {})
    this.previousResponseId = this.responseIds[this.activeCharacterId] || ''
    this.messages = this.readMessages()

    this.createInterface()
    this.render()
  }

  createInterface() {
    this.element = document.createElement('section')
    this.element.className = 'world-chat'
    this.element.hidden = true
    this.element.setAttribute('role', 'dialog')
    this.element.setAttribute('aria-modal', 'true')
    this.element.setAttribute('aria-label', this.character.displayName)
    this.element.innerHTML = `
      <header class="world-chat__header">
        <div>
          <h2>${escapeHtml(this.character.displayName)}</h2>
          <p data-chat-status>她正在听。</p>
        </div>
        <button
          class="world-chat__close"
          type="button"
          data-chat-action="close"
          aria-label="关闭对话"
        >×</button>
      </header>
      <div class="world-chat__messages" data-chat-messages aria-live="polite"></div>
      <div class="world-chat__restart-row" data-chat-restart-row hidden>
        <button type="button" data-chat-action="restart">重新开始这段对话</button>
      </div>
      <form class="world-chat__composer" data-chat-form>
        <label class="sr-only" for="echo-world-chat-input">对她说点什么</label>
        <textarea
          id="echo-world-chat-input"
          data-chat-input
          maxlength="${MAX_MESSAGE_LENGTH}"
          rows="3"
          placeholder="对她说点什么……"
        ></textarea>
        <p class="world-chat__error" data-chat-error hidden></p>
        <div class="world-chat__composer-foot">
          <span data-chat-count>0 / ${MAX_MESSAGE_LENGTH}</span>
          <div>
            <button
              class="world-chat__stop"
              type="button"
              data-chat-action="stop"
              hidden
            >停止</button>
            <button class="world-chat__send" type="submit">发送</button>
          </div>
        </div>
      </form>
    `

    this.messagesElement = this.element.querySelector('[data-chat-messages]')
    this.statusElement = this.element.querySelector('[data-chat-status]')
    this.restartRow = this.element.querySelector('[data-chat-restart-row]')
    this.form = this.element.querySelector('[data-chat-form]')
    this.textarea = this.element.querySelector('[data-chat-input]')
    this.errorElement = this.element.querySelector('[data-chat-error]')
    this.countElement = this.element.querySelector('[data-chat-count]')
    this.stopButton = this.element.querySelector('[data-chat-action="stop"]')
    this.sendButton = this.element.querySelector('.world-chat__send')

    this.handleClick = (event) => {
      const action = event.target.closest('[data-chat-action]')?.dataset.chatAction
      if (action === 'close') this.close()
      if (action === 'stop') this.stopGeneration('user')
      if (action === 'restart') this.restartConversation()
    }
    this.handleSubmit = (event) => {
      event.preventDefault()
      this.send()
    }
    this.handleInput = () => {
      this.input = this.textarea.value
      this.countElement.textContent =
        `${this.input.length} / ${MAX_MESSAGE_LENGTH}`
      this.error = ''
      this.renderError()
    }
    this.handleInputKeyDown = (event) => {
      if (
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.isComposing
      ) {
        event.preventDefault()
        this.send()
      }
    }
    this.handleMessagesScroll = () => {
      const distanceFromBottom =
        this.messagesElement.scrollHeight -
        this.messagesElement.scrollTop -
        this.messagesElement.clientHeight
      this.isPinnedToBottom = distanceFromBottom < 72
    }

    this.element.addEventListener('click', this.handleClick)
    this.form.addEventListener('submit', this.handleSubmit)
    this.textarea.addEventListener('input', this.handleInput)
    this.textarea.addEventListener('keydown', this.handleInputKeyDown)
    this.messagesElement.addEventListener('scroll', this.handleMessagesScroll)
    this.mount.append(this.element)
  }

  open(worldContext) {
    if (this.isOpen) return
    this.isOpen = true
    this.worldContext = cloneWorldContext(worldContext)
    this.element.hidden = false
    this.render()
    this.onOpen?.()
    requestAnimationFrame(() => {
      this.scrollToBottom(true)
      this.textarea.focus({ preventScroll: true })
    })
  }

  close() {
    if (!this.isOpen) return
    if (this.isStreaming) this.stopGeneration('close')
    this.isOpen = false
    this.element.hidden = true
    this.textarea.blur()
    this.onClose?.()
  }

  async send() {
    const content = this.textarea.value.trim()
    if (!content || this.isStreaming) return
    if (content.length > MAX_MESSAGE_LENGTH) {
      this.error = `每次最多输入 ${MAX_MESSAGE_LENGTH} 个字符。`
      this.renderError()
      return
    }

    this.input = ''
    this.error = ''
    this.restartRequired = false
    this.hasStartedConversation = true
    this.textarea.value = ''
    this.countElement.textContent = `0 / ${MAX_MESSAGE_LENGTH}`
    this.isPinnedToBottom = true
    const conversationHistory = this.messages
      .filter(
        (message) =>
          ['user', 'assistant'].includes(message.role) &&
          message.status === 'complete' &&
          message.content,
      )
      .slice(-20)

    const assistantMessage = {
      id: createId('assistant'),
      role: 'assistant',
      content: '',
      createdAt: Date.now() + 1,
      status: 'streaming',
    }
    this.messages.push(
      {
        id: createId('user'),
        role: 'user',
        content,
        createdAt: Date.now(),
        status: 'complete',
      },
      assistantMessage,
    )
    this.isStreaming = true
    this.persistMessages()
    this.render()

    const controller = new AbortController()
    this.abortController = controller
    this.abortReason = ''
    let completed = false

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          message: content,
          previousResponseId: this.previousResponseId || undefined,
          characterId: this.activeCharacterId,
          worldContext: this.worldContext,
          conversationHistory,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        if ([404, 405, 502, 503].includes(response.status)) {
          await waitFor(620)
          assistantMessage.content = createSnapshotReply(
            content,
            this.worldContext,
          )
          assistantMessage.status = 'complete'
          completed = true
          return
        }
        const payload = await readJsonSafely(response)
        throw new ChatRequestError(
          payload?.error || '这句话没有抵达她那里。再试一次。',
          payload?.code || 'request_failed',
          payload?.restartRequired,
        )
      }
      if (!response.body) {
        throw new ChatRequestError(
          '她的声音暂时没有抵达这里。',
          'missing_stream',
        )
      }

      await readSseStream(response.body, (event, data) => {
        if (event === 'delta' && typeof data.text === 'string') {
          assistantMessage.content += data.text
          this.persistMessages()
          this.renderMessages()
          return
        }

        if (event === 'completed') {
          completed = true
          assistantMessage.status = 'complete'
          if (typeof data.responseId === 'string' && data.responseId) {
            this.setPreviousResponseId(data.responseId)
          }
          return
        }

        if (event === 'error') {
          throw new ChatRequestError(
            data.message || '她的声音暂时没有抵达这里。',
            data.code || 'generation_failed',
            data.restartRequired,
          )
        }
      })

      if (!completed) {
        throw new ChatRequestError(
          '她的声音暂时没有抵达这里。',
          'stream_incomplete',
        )
      }
    } catch (error) {
      const wasAborted =
        controller.signal.aborted || error?.name === 'AbortError'
      if (wasAborted) {
        assistantMessage.status = assistantMessage.content
          ? 'complete'
          : 'error'
        this.addNarratorMessage('她停在了这句话中间。')
      } else if (!(error instanceof ChatRequestError)) {
        assistantMessage.content = createSnapshotReply(
          content,
          this.worldContext,
        )
        assistantMessage.status = 'complete'
        completed = true
      } else {
        assistantMessage.status = 'error'
        this.restartRequired =
          error instanceof ChatRequestError && error.restartRequired
        this.error = userFacingError(error)
      }
    } finally {
      if (this.abortController === controller) {
        this.abortController = null
        this.abortReason = ''
        this.isStreaming = false
      }
      if (assistantMessage.status === 'streaming') {
        assistantMessage.status = completed ? 'complete' : 'error'
      }
      if (completed && assistantMessage.content) {
        rememberParallelDialogue(content, assistantMessage.content)
      }
      this.persistMessages()
      this.render()
    }
  }

  stopGeneration(reason = 'user') {
    if (!this.abortController || this.abortController.signal.aborted) return
    this.abortReason = reason
    this.abortController.abort()
  }

  restartConversation() {
    this.stopGeneration('restart')
    this.previousResponseId = ''
    delete this.responseIds[this.activeCharacterId]
    writeSessionJson(RESPONSE_IDS_KEY, this.responseIds)
    sessionStorage.removeItem(this.messageStorageKey)
    this.messages = this.createOpeningMessages()
    this.hasStartedConversation = false
    this.restartRequired = false
    this.error = ''
    this.isPinnedToBottom = true
    this.persistMessages()
    this.render()
  }

  addNarratorMessage(content) {
    const previous = this.messages.at(-1)
    if (previous?.role === 'narrator' && previous.content === content) return
    this.messages.push({
      id: createId('narrator'),
      role: 'narrator',
      content,
      createdAt: Date.now(),
      status: 'complete',
    })
  }

  setPreviousResponseId(responseId) {
    this.previousResponseId = responseId
    this.responseIds[this.activeCharacterId] = responseId
    writeSessionJson(RESPONSE_IDS_KEY, this.responseIds)
  }

  readMessages() {
    const stored = readSessionJson(this.messageStorageKey, null)
    if (!Array.isArray(stored) || !stored.length) {
      const opening = this.createOpeningMessages()
      writeSessionJson(this.messageStorageKey, opening)
      return opening
    }

    const messages = stored
      .filter(isStoredMessage)
      .map((message) => ({
        ...message,
        status:
          message.status === 'streaming' ? 'error' : message.status,
      }))
    return messages.length ? messages : this.createOpeningMessages()
  }

  createOpeningMessages() {
    return [
      {
        id: 'opening-narration',
        role: 'narrator',
        content: this.character.openingNarration,
        createdAt: Date.now(),
        status: 'complete',
      },
      {
        id: 'opening-line',
        role: 'assistant',
        content: this.character.openingLine,
        createdAt: Date.now() + 1,
        status: 'complete',
      },
    ]
  }

  get messageStorageKey() {
    return `${MESSAGE_KEY_PREFIX}${this.activeCharacterId}`
  }

  persistMessages() {
    writeSessionJson(this.messageStorageKey, this.messages)
  }

  render() {
    this.statusElement.textContent = this.isStreaming
      ? '她在想起什么……'
      : '她正在听。'
    this.stopButton.hidden = !this.isStreaming
    this.sendButton.disabled = this.isStreaming
    this.textarea.disabled = this.isStreaming
    this.restartRow.hidden =
      !this.restartRequired && !(import.meta.env.DEV && !this.isStreaming)
    this.renderMessages()
    this.renderError()
  }

  renderMessages() {
    const previousScrollTop = this.messagesElement.scrollTop
    const shouldFollow = this.isPinnedToBottom
    this.messagesElement.innerHTML = this.messages
      .map((message) => {
        const streaming =
          message.status === 'streaming'
            ? '<span class="world-chat__stream-cursor" aria-hidden="true"></span>'
            : ''
        return `
          <article
            class="world-chat__message world-chat__message--${message.role}
              ${message.status === 'error' ? 'is-error' : ''}"
          >
            <p>${formatMessage(message.content)}${streaming}</p>
          </article>
        `
      })
      .join('')

    if (shouldFollow) {
      this.scrollToBottom()
    } else {
      this.messagesElement.scrollTop = previousScrollTop
    }
  }

  renderError() {
    this.errorElement.hidden = !this.error
    this.errorElement.textContent = this.error
  }

  scrollToBottom(force = false) {
    if (!force && !this.isPinnedToBottom) return
    this.messagesElement.scrollTop = this.messagesElement.scrollHeight
    this.isPinnedToBottom = true
  }

  destroy() {
    this.stopGeneration('destroy')
    this.element.removeEventListener('click', this.handleClick)
    this.form.removeEventListener('submit', this.handleSubmit)
    this.textarea.removeEventListener('input', this.handleInput)
    this.textarea.removeEventListener('keydown', this.handleInputKeyDown)
    this.messagesElement.removeEventListener('scroll', this.handleMessagesScroll)
    this.element.remove()
  }
}

class ChatRequestError extends Error {
  constructor(message, code, restartRequired = false) {
    super(message)
    this.name = 'ChatRequestError'
    this.code = code
    this.restartRequired = Boolean(restartRequired)
  }
}

async function readSseStream(stream, handleEvent) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), {
        stream: !done,
      })
      buffer = drainSseBuffer(buffer, handleEvent, done)
      if (done) break
    }
  } finally {
    reader.releaseLock()
  }
}

function drainSseBuffer(buffer, handleEvent, flush = false) {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const blocks = normalized.split('\n\n')
  const remainder = flush ? '' : blocks.pop() || ''

  for (const block of blocks) {
    if (!block.trim()) continue
    let eventName = 'message'
    const dataLines = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
    }
    if (!dataLines.length) continue
    let data
    try {
      data = JSON.parse(dataLines.join('\n'))
    } catch {
      throw new ChatRequestError(
        '她的声音暂时没有抵达这里。',
        'invalid_stream',
      )
    }
    handleEvent(eventName, data)
  }

  if (flush && remainder.trim()) {
    return drainSseBuffer(`${remainder}\n\n`, handleEvent, true)
  }
  return remainder
}

function userFacingError(error) {
  if (error instanceof ChatRequestError) {
    if (error.code === 'server_not_configured') {
      return '房间仍然亮着，但她暂时听不见你。'
    }
    if (error.code === 'conversation_expired') {
      return '这段回声已经散了，请重新开始这段对话。'
    }
    return error.message || '这句话没有抵达她那里。再试一次。'
  }
  if (error instanceof TypeError) {
    return '房间仍然亮着，但她暂时听不见你。'
  }
  return '这句话没有抵达她那里。再试一次。'
}

function createSnapshotReply(message, worldContext) {
  const request = sanitizeEchoChatPayload({
    message,
    characterId: 'parallel-self',
    worldContext,
    conversationHistory: [],
  })
  if (!request) {
    return '这件事我现在没有足够的经历能说准。我不想为了给你一个完整答案，补出没有发生过的生活。'
  }
  return repairEchoOutput(
    null,
    request.message,
    request.evidence,
  ).reply.text
}

function waitFor(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function cloneWorldContext(value) {
  return JSON.parse(JSON.stringify(value))
}

function formatMessage(value) {
  return escapeHtml(value).replace(/\n/g, '<br>')
}

function escapeHtml(value) {
  const element = document.createElement('div')
  element.textContent = value
  return element.innerHTML
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isStoredMessage(value) {
  return (
    value &&
    typeof value.id === 'string' &&
    ['user', 'assistant', 'narrator'].includes(value.role) &&
    typeof value.content === 'string' &&
    value.content.length <= 20_000 &&
    Number.isFinite(value.createdAt) &&
    ['streaming', 'complete', 'error'].includes(value.status)
  )
}

function readSessionJson(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeSessionJson(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn('[Echo] 对话状态未能写入 sessionStorage', error)
  }
}

async function readJsonSafely(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export {
  ChatRequestError,
  drainSseBuffer,
  readSseStream,
}
