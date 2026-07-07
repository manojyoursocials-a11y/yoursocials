import { useRef, useEffect, useState } from 'react';

const TOOLBAR = [
  { cmd:'bold',          icon:'B',      title:'Bold',           style:{fontWeight:900} },
  { cmd:'italic',        icon:'I',      title:'Italic',         style:{fontStyle:'italic'} },
  { cmd:'underline',     icon:'U',      title:'Underline',      style:{textDecoration:'underline'} },
  { cmd:'strikeThrough', icon:'S̶',      title:'Strikethrough',  style:{textDecoration:'line-through'} },
  { sep:true },
  { cmd:'insertUnorderedList', icon:'• —', title:'Bullet list' },
  { cmd:'insertOrderedList',   icon:'1.',  title:'Numbered list' },
  { sep:true },
  { cmd:'justifyLeft',   icon:'≡',      title:'Align left' },
  { cmd:'justifyCenter', icon:'≡',      title:'Centre' },
  { sep:true },
  { cmd:'indent',        icon:'→',      title:'Indent' },
  { cmd:'outdent',       icon:'←',      title:'Outdent' },
];

export default function RichEditor({ value, onChange, placeholder = 'Write here…', minHeight = 120 }) {
  const ref    = useRef(null);
  const skipRef= useRef(false); // avoid cursor jump on external value set

  // On mount: set initial HTML
  useEffect(() => {
    if (ref.current && value !== undefined) {
      ref.current.innerHTML = value || '';
    }
    // eslint-disable-next-line
  }, []);

  function exec(cmd) {
    ref.current?.focus();
    document.execCommand(cmd, false, null);
    emit();
  }

  function emit() {
    if (!ref.current) return;
    skipRef.current = true;
    onChange?.(ref.current.innerHTML);
  }

  function handleKeyDown(e) {
    // Tab → indent
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
      emit();
    }
  }

  const btnStyle = (active) => ({
    padding:'4px 9px', borderRadius:6, border:'none',
    background: active ? 'rgba(124,92,252,.25)' : 'transparent',
    color: active ? 'var(--purple2)' : 'var(--muted2)',
    cursor:'pointer', fontSize:'.8rem', fontFamily:'Inter,sans-serif',
    fontWeight:600, transition:'all .12s', lineHeight:1,
  });

  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:'.73rem', fontWeight:600, color:'var(--muted2)', marginBottom:5, letterSpacing:'.04em' }}>DESCRIPTION</div>

      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:2, flexWrap:'wrap', padding:'6px 8px', background:'var(--surface3)', border:'1px solid var(--border2)', borderRadius:'10px 10px 0 0', borderBottom:'none' }}>
        {TOOLBAR.map((t, i) => {
          if (t.sep) return <div key={i} style={{ width:1, height:16, background:'var(--border2)', margin:'0 4px' }}/>;
          return (
            <button key={t.cmd} type="button" title={t.title}
              onMouseDown={e => { e.preventDefault(); exec(t.cmd); }}
              style={{ ...btnStyle(false), ...t.style }}>
              {t.icon}
            </button>
          );
        })}
      </div>

      {/* Editable area */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        style={{
          minHeight, padding:'10px 12px',
          background:'var(--surface3)',
          border:'1px solid var(--border2)',
          borderRadius:'0 0 10px 10px',
          fontSize:'.83rem', color:'var(--text)',
          lineHeight:1.7,
          outline:'none',
          fontFamily:'Inter,sans-serif',
          overflowY:'auto',
          wordBreak:'break-word',
        }}
        onFocus={e => e.currentTarget.style.borderColor='var(--purple)'}
        onBlur={e => e.currentTarget.style.borderColor='rgba(255,255,255,.13)'}
      />

      {/* Placeholder style */}
      <style>{`
        [data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: var(--muted);
          pointer-events: none;
          font-style: italic;
        }
        [contenteditable] ul { padding-left: 1.4em; list-style: disc; }
        [contenteditable] ol { padding-left: 1.4em; list-style: decimal; }
        [contenteditable] li { margin-bottom: 3px; }
        [contenteditable] p  { margin: 0 0 6px; }
      `}</style>
    </div>
  );
}

// Read-only renderer for task detail view
export function RichContent({ html, style }) {
  if (!html || html === '<br>') return null;
  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      style={{ fontSize:'.83rem', color:'var(--muted2)', lineHeight:1.7, marginBottom:14, wordBreak:'break-word', ...style }}
    />
  );
}
