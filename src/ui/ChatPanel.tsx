import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { ROOMS } from '../data/catalog';
import { sendChat, setChatFocus, unreadDms, useChat, usePresence } from '../data/social';
import { useGame } from '../data/store';
import type { ChatMessage, Employee } from '../data/types';
import { AvatarImg, Panel, toast } from './common';
import { Icon } from './icons';
import { L, intlLocale } from '../i18n';

const QUICK = ['👋', '😄', '👍', '🎉', '☕', '💪', '🔥', '❤️', '🙌', '🤝'];

const timeFmt = new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayFmt = new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'short' });

function Face({ e }: { e: Employee | undefined }) {
  return <span className="chat-face">{e && <AvatarImg avatar={e.avatar} size={1.4} />}</span>;
}

function Messages({ list, meId }: { list: ChatMessage[]; meId: string }) {
  const employees = useGame((s) => s.employees);
  const end = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Con llaves: en navegadores nuevos scrollIntoView devuelve una promesa y React exige no devolver nada.
    end.current?.scrollIntoView({ block: 'end' });
  }, [list.length]);
  let lastDay = '';
  return (
    <div className="chat-log">
      {list.length === 0 && <p className="hint chat-empty">{L('Todavía no hay mensajes. ¡Rompe el hielo! 👋', 'No messages yet. Break the ice! 👋')}</p>}
      {list.map((m, i) => {
        const e = employees[m.from];
        const mine = m.from === meId;
        const day = dayFmt.format(m.ts);
        const showDay = day !== lastDay;
        lastDay = day;
        const grouped = !showDay && i > 0 && list[i - 1].from === m.from && m.ts - list[i - 1].ts < 3 * 60_000;
        return (
          <div key={m.id}>
            {showDay && <div className="chat-day">{day}</div>}
            <div className={`chat-msg ${mine ? 'chat-mine' : ''} ${grouped ? 'chat-grouped' : ''}`}>
              {!mine && (grouped ? <span className="chat-face chat-face-ghost" /> : <Face e={e} />)}
              <div className="chat-bubble">
                {!mine && !grouped && <b style={{ color: e ? ROOMS[e.dept].color : undefined }}>{e?.name.split(' ')[0] ?? L('Ex colaborador', 'Former team member')}</b>}
                <span>{m.text}</span>
                <small>{timeFmt.format(m.ts)}</small>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

function Composer({ to, placeholder }: { to?: string; placeholder: string }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const send = async (value: string) => {
    if (!value.trim() || busy) return;
    setBusy(true);
    const r = await sendChat(value, to);
    setBusy(false);
    if (r.ok) setText('');
    else toast(r.message, false);
    input.current?.focus();
  };
  return (
    <form
      className="chat-compose"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void send(text);
      }}
    >
      <div className="chat-quick">
        {QUICK.map((q) => (
          <button key={q} type="button" onClick={() => void send(q)} aria-label={L(`Enviar ${q}`, `Send ${q}`)}>
            {q}
          </button>
        ))}
      </div>
      <div className="chat-input-row">
        <input ref={input} className="input" maxLength={300} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        <button className="btn btn-primary" disabled={busy || !text.trim()} aria-label={L('Enviar', 'Send')}>
          <Icon name="send" size={18} />
        </button>
      </div>
    </form>
  );
}

export function ChatPanel({ onClose, initialWith }: { onClose: () => void; initialWith?: string }) {
  const chat = useChat();
  const online = usePresence();
  const meId = useGame((s) => s.currentUserId) ?? '';
  const employees = useGame((s) => s.employees);
  const [tab, setTab] = useState<'general' | 'private'>(initialWith ? 'private' : 'general');
  const [peer, setPeer] = useState<string | null>(initialWith ?? null);

  // Lo que se está mirando no cuenta como "sin leer".
  useEffect(() => {
    setChatFocus(tab === 'general' ? 'general' : peer);
    return () => setChatFocus(null);
  }, [tab, peer]);

  const dmUnread = unreadDms(chat);
  const contacts = Object.values(employees)
    .filter((e) => e.id !== meId)
    .sort((a, b) => {
      const la = chat.summary[a.id]?.last ?? 0;
      const lb = chat.summary[b.id]?.last ?? 0;
      if (la !== lb) return lb - la;
      return Number(online.includes(b.id)) - Number(online.includes(a.id)) || a.name.localeCompare(b.name);
    });
  const other = peer ? employees[peer] : undefined;

  return (
    <Panel title="Chat" onClose={onClose}>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'general'} className={`tab ${tab === 'general' ? 'tab-on' : ''}`} onClick={() => setTab('general')}>
          💬 {L('General', 'General')} {chat.generalUnread > 0 && tab !== 'general' && <span className="tab-count">{chat.generalUnread}</span>}
        </button>
        <button role="tab" aria-selected={tab === 'private'} className={`tab ${tab === 'private' ? 'tab-on' : ''}`} onClick={() => setTab('private')}>
          ✉️ {L('Privados', 'Private')} {dmUnread > 0 && <span className="tab-count">{dmUnread}</span>}
        </button>
      </div>

      {tab === 'general' && (
        <div className="chat-box">
          <p className="hint">
            {L(
              'Lo lee todo el equipo, y tu mensaje aparece en un globo sobre tu personaje.',
              'The whole team reads it, and your message pops up in a bubble over your character.',
            )}
          </p>
          <Messages list={chat.general} meId={meId} />
          <Composer placeholder={L('Escribe al equipo…', 'Write to the team…')} />
        </div>
      )}

      {tab === 'private' && peer === null && (
        <ul className="contact-list">
          {contacts.map((e) => {
            const s = chat.summary[e.id];
            const isOn = online.includes(e.id);
            return (
              <li key={e.id}>
                <button onClick={() => setPeer(e.id)}>
                  <span className="contact-face">
                    <Face e={e} />
                    <i className={`presence ${isOn ? 'presence-on' : ''}`} />
                  </span>
                  <span className="contact-info">
                    <b>{e.name}</b>
                    <small>{isOn ? L('Conectado', 'Online') : e.title}</small>
                  </span>
                  {(s?.unread ?? 0) > 0 && <span className="count-badge static">{s!.unread}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {tab === 'private' && peer !== null && (
        <div className="chat-box">
          <div className="chat-peer">
            <button className="btn btn-small" onClick={() => setPeer(null)}>
              ← {L('Contactos', 'Contacts')}
            </button>
            <Face e={other} />
            <span>
              <b>{other?.name ?? L('Colaborador', 'Team member')}</b>
              <small>{online.includes(peer) ? L(' · conectado', ' · online') : ''}</small>
            </span>
          </div>
          <Messages list={chat.dms[peer] ?? []} meId={meId} />
          <Composer to={peer} placeholder={L(`Mensaje privado para ${other?.name.split(' ')[0] ?? ''}…`, `Private message to ${other?.name.split(' ')[0] ?? ''}…`)} />
        </div>
      )}
    </Panel>
  );
}
