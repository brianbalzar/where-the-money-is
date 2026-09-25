import type { KeyboardEvent as RKeyboardEvent } from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { MetroMeta } from '../lib/types'
import { searchMetros } from '../lib/search'

interface Props {
  metros: MetroMeta[]
  current: MetroMeta
  onSelect: (id: string) => void
  onStep: (d: 1 | -1) => void
  compact?: boolean
}

const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2 4 L6 8 L10 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
)

export default function MetroSelector({ metros, current, onSelect, onStep, compact }: Props) {
  const [open, setOpen] = useState(false)
  const [browse, setBrowse] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const results = useMemo(() => searchMetros(metros, q), [metros, q])

  // With no query, open on the current metro; typing jumps to the best match.
  useEffect(() => {
    setActive(q ? 0 : Math.max(0, results.findIndex((m) => m.id === current.id)))
  }, [q, open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const choose = (id: string) => { onSelect(id); setOpen(false); setBrowse(false); setQ('') }

  const onKey = (e: RKeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active].id) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  useEffect(() => {
    document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, listId])

  return (
    <div className={`metro-sel${compact ? ' compact' : ''}`} ref={boxRef}>
      <div className="metro-row">
        <button type="button" className="metro-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="metro-name">{compact ? current.shortName : current.name}</span><Chevron />
        </button>
        <button type="button" className="step" aria-label="Previous metro" onClick={() => onStep(-1)}>‹</button>
        <button type="button" className="step" aria-label="Next metro" onClick={() => onStep(1)}>›</button>
      </div>
      {open && (
        <div className="metro-pop">
          <input
            ref={inputRef} className="metro-input" role="combobox" aria-expanded="true" aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-opt-${active}` : undefined}
            placeholder="Search metro, city or state" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
          />
          <ul id={listId} role="listbox" className="metro-list">
            {results.map((m, i) => (
              <li
                key={m.id} id={`${listId}-opt-${i}`} role="option" aria-selected={i === active}
                className={i === active ? 'active' : ''} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(m.id) }}
              >
                <span className="r">{m.rank}</span><span className="n">{m.shortName}</span><span className="s">{m.states.join('-')}</span>
              </li>
            ))}
            {!results.length && <li className="empty">No metro matches “{q}”.</li>}
          </ul>
          <div className="metro-foot">
            <span>↑↓ move · Enter open · [ ] prev/next metro</span>
            <button type="button" className="linklike" onClick={() => { setBrowse(true); setOpen(false) }}>Browse all {metros.length}</button>
          </div>
        </div>
      )}
      {browse && (
        <div className="browse-scrim" onClick={() => setBrowse(false)}>
          <div className="browse" role="dialog" aria-label="All metros" onClick={(e) => e.stopPropagation()}>
            <div className="browse-head"><span className="eyebrow">All {metros.length} metros by population</span>
              <button type="button" className="linklike" onClick={() => setBrowse(false)}>Close</button></div>
            <div className="browse-grid">
              {[...metros].sort((a, b) => a.rank - b.rank).map((m) => (
                <button type="button" key={m.id} className={m.id === current.id ? 'cur' : ''} onClick={() => choose(m.id)}>
                  <span className="r">{m.rank}</span> {m.shortName}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
