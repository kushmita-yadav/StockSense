import { useState, type FormEvent } from 'react'
import { Bot, Copy, Loader2, Send, Sparkles, UserRound } from 'lucide-react'
import { api } from '../../lib/api'

type Message = { role: 'user' | 'assistant'; text: string }

export function StockSenseAssistant({ isManager }: { isManager: boolean }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)

  const ask = async (text: string) => {
    const cleanQuestion = text.trim()
    if (!cleanQuestion || busy) return
    setQuestion('')
    setError('')
    setMessages((previous) => [...previous, { role: 'user', text: cleanQuestion }])
    setBusy(true)
    try {
      const response = await api.post<{ answer: string }>('/assistant/chat', { question: cleanQuestion, history: messages.slice(-8).map((message) => ({ role: message.role, content: message.text })) })
      setMessages((previous) => [...previous, { role: 'assistant', text: response.answer }])
    } catch (err: any) {
      setError(err.message || 'The workspace assistant is unavailable right now.')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void ask(question)
  }

  const createInvite = async () => {
    setInviteBusy(true)
    setError('')
    try {
      const result = await api.post<{ invite_code: string }>('/auth/workspace-invite')
      setInviteCode(result.invite_code)
    } catch (err: any) {
      setError(err.message || 'Could not create a staff invite.')
    } finally {
      setInviteBusy(false)
    }
  }

  return (
    <section className="glass-panel rounded-2xl border border-brand-200/70 overflow-hidden" aria-labelledby="workspace-assistant-title">
      <div className="px-5 py-4 border-b border-biscuit flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-700"><Sparkles className="w-4 h-4" /></div>
          <div>
            <h2 id="workspace-assistant-title" className="text-sm font-bold text-ink">StockSense workspace assistant</h2>
            <p className="text-[11px] text-muted mt-0.5">Answers from your current workspace and StockSense help only.</p>
          </div>
        </div>
        {isManager && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void createInvite()} disabled={inviteBusy} className="px-3 py-2 rounded-lg text-xs font-semibold bg-biscuit border border-brand-200 text-ink hover:bg-brand-100 disabled:opacity-60">
              {inviteBusy ? 'Creating…' : 'Invite staff to this workspace'}
            </button>
            {inviteCode && <button type="button" onClick={() => void navigator.clipboard?.writeText(inviteCode)} className="px-3 py-2 rounded-lg text-xs font-semibold bg-surface border border-brand-200 text-brand-700 flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" />Copy code</button>}
          </div>
        )}
      </div>

      {inviteCode && <div role="status" className="px-5 py-2 bg-sage-500/10 border-b border-biscuit text-xs text-ink">Share this code with your staff during signup: <code className="ml-1 font-mono font-bold select-all">{inviteCode}</code></div>}

      <div className="p-5 space-y-3">
        <div className="space-y-3 max-h-64 overflow-y-auto" aria-live="polite">
          {messages.length === 0 && <div className="flex items-start gap-2.5 text-xs text-muted"><Bot className="w-4 h-4 text-brand-700 mt-0.5 shrink-0" /><p>Ask about stock levels, reorder alerts, recent movements, or how to use StockSense.</p></div>}
          {messages.map((message, index) => (
            <div key={`${index}-${message.role}`} className={`flex items-start gap-2.5 text-xs ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && <Bot className="w-4 h-4 text-brand-700 mt-1 shrink-0" />}
              <p className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 leading-relaxed ${message.role === 'user' ? 'bg-brand-100 text-ink' : 'bg-surface border border-biscuit text-ink'}`}>{message.text}</p>
              {message.role === 'user' && <UserRound className="w-4 h-4 text-sage-700 mt-1 shrink-0" />}
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-xs text-muted"><Loader2 className="w-4 h-4 animate-spin" />Checking your workspace…</div>}
        </div>

        {error && <p role="alert" className="text-xs text-clay-700 bg-clay-500/10 border border-clay-500/20 rounded-lg px-3 py-2">{error}</p>}

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {['What needs restocking?', 'Summarize recent stock movements'].map((suggestion) => <button key={suggestion} type="button" onClick={() => void ask(suggestion)} disabled={busy} className="px-2.5 py-1.5 rounded-full text-[11px] text-brand-700 bg-brand-50 border border-brand-200 hover:bg-brand-100">{suggestion}</button>)}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <label className="sr-only" htmlFor="workspace-assistant-question">Ask about your workspace</label>
          <input id="workspace-assistant-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1500} placeholder="Ask about your workspace…" className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-surface border border-biscuit text-xs text-ink placeholder:text-muted focus:outline-none focus:border-brand-500" />
          <button type="submit" disabled={busy || !question.trim()} aria-label="Send question" className="p-2.5 rounded-xl bg-brand-500 text-ink hover:bg-brand-600 disabled:opacity-50"><Send className="w-4 h-4" /></button>
        </form>
      </div>
    </section>
  )
}
