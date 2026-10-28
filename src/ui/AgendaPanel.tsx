import { useState } from 'react';
import { bridge } from '../bridge';
import { DEPTS, ROOMS } from '../data/catalog';
import { TIME_ZONE } from '../data/schedule';
import {
  announce,
  cancelMeeting,
  canSchedule,
  deleteAnnouncement,
  endMeeting,
  meetingWhen,
  scheduleMeeting,
  startMeeting,
  useGame,
} from '../data/store';
import type { Announcement, Employee, Meeting } from '../data/types';
import { Panel, report, timeAgo, useNow } from './common';
import { L } from '../i18n';

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
// Fijos para que el selector devuelva siempre lo mismo si aún no hay datos (si no, React entra en bucle).
const NO_MEETINGS: Meeting[] = [];
const NO_ANNOUNCEMENTS: Announcement[] = [];

/** "AAAA-MM-DD" y "HH:MM" de un instante en hora de Chile (para los campos del formulario). */
function localParts(ts: number): { date: string; time: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(ts)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Instante (ms) de una fecha y hora escritas en hora de Chile. */
function fromLocal(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  // Se prueba con el desfase de esa fecha: Chile cambia de horario dos veces al año.
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const back = localParts(guess);
  const [by, bm, bd] = back.date.split('-').map(Number);
  const [bh, bmin] = back.time.split(':').map(Number);
  const diff = guess - Date.UTC(by, bm - 1, bd, bh, bmin);
  return guess + diff;
}

function nextSlot(): number {
  const now = Date.now();
  return Math.ceil((now + 10 * 60_000) / (30 * 60_000)) * 30 * 60_000;
}

function MeetingCard({ m, me, employees }: { m: Meeting; me: Employee; employees: Record<string, Employee> }) {
  const canManage = m.createdBy === me.id || me.role === 'admin';
  const who =
    m.attendees.length === 0
      ? L('Todo el equipo', 'Whole team')
      : L(`${m.attendees.length} personas`, `${m.attendees.length} ${m.attendees.length === 1 ? 'person' : 'people'}`);
  const author = employees[m.createdBy]?.name ?? L('Alguien', 'Someone');
  return (
    <li className={`meeting-card meeting-${m.status}`}>
      <div className="meeting-top">
        <b>{m.title}</b>
        {m.status === 'active' && <span className="pill pill-live">{L('EN CURSO', 'LIVE')}</span>}
        {m.status === 'ended' && <span className="pill">{L('Terminada', 'Ended')}</span>}
        {m.status === 'cancelled' && <span className="pill">{L('Cancelada', 'Cancelled')}</span>}
      </div>
      <small>
        {meetingWhen(m.start)} · {m.durationMin} min · {who} · {L(`agendó ${author}`, `scheduled by ${author}`)}
      </small>
      {m.status === 'active' && <small>👥 {L(`${m.present.length} en la sala`, `${m.present.length} in the room`)}</small>}
      {canManage && m.status === 'scheduled' && (
        <div className="row-btns">
          <button className="btn btn-small" onClick={() => report(cancelMeeting(m.id))}>
            {L('Cancelar', 'Cancel')}
          </button>
          <button className="btn btn-small btn-primary" onClick={() => report(startMeeting(m.id))}>
            {L('Iniciar ahora', 'Start now')}
          </button>
        </div>
      )}
      {m.status === 'active' && (
        <div className="row-btns">
          <button className="btn btn-small" onClick={() => bridge.emit('camera:room', 'reuniones')}>
            {L('Ver la sala', 'View the room')}
          </button>
          {canManage && (
            <button className="btn btn-small btn-primary" onClick={() => report(endMeeting(m.id))}>
              {L('Terminar reunión', 'End meeting')}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function NewMeeting({ employees, meId }: { employees: Record<string, Employee>; meId: string }) {
  const slot = localParts(nextSlot());
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(slot.date);
  const [time, setTime] = useState(slot.time);
  const [duration, setDuration] = useState(30);
  const [everyone, setEveryone] = useState(true);
  const [picked, setPicked] = useState<string[]>([meId]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const people = Object.values(employees);

  return (
    <div className="form-card">
      <h4 className="section">{L('Agendar reunión', 'Schedule meeting')}</h4>
      <input className="input" placeholder={L('Título: Reunión de ventas semanal', 'Title: Weekly sales meeting')} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="row-fields">
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={L('Fecha', 'Date')} />
        <input className="input" type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} aria-label={L('Hora', 'Time')} />
        <select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))} aria-label={L('Duración', 'Duration')}>
          {DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d < 60 ? `${d} min` : `${d / 60} h`}
            </option>
          ))}
        </select>
      </div>
      <label className="check">
        <input type="checkbox" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} /> {L('Todo el equipo', 'Whole team')}
      </label>
      {!everyone && (
        <div className="attendee-grid">
          {DEPTS.map((d) => {
            const inDept = people.filter((e) => e.dept === d);
            const all = inDept.every((e) => picked.includes(e.id));
            return (
              <fieldset key={d}>
                <legend>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={all}
                      onChange={() =>
                        setPicked((p) => (all ? p.filter((id) => !inDept.some((e) => e.id === id)) : [...new Set([...p, ...inDept.map((e) => e.id)])]))
                      }
                    />
                    <b style={{ color: ROOMS[d].color }}>{ROOMS[d].name}</b>
                  </label>
                </legend>
                {inDept.map((e) => (
                  <label key={e.id} className="check">
                    <input type="checkbox" checked={picked.includes(e.id)} onChange={() => toggle(e.id)} /> {e.name}
                  </label>
                ))}
              </fieldset>
            );
          })}
        </div>
      )}
      <button
        className="btn btn-primary btn-block"
        disabled={!title.trim() || (!everyone && picked.length === 0)}
        onClick={() => {
          if (report(scheduleMeeting(title, fromLocal(date, time), duration, everyone ? [] : picked))) setTitle('');
        }}
      >
        📅 {L('Agendar y avisar', 'Schedule and notify')}
      </button>
    </div>
  );
}

function Announcements({ me }: { me: Employee }) {
  const list = useGame((s) => s.announcements ?? NO_ANNOUNCEMENTS);
  const employees = useGame((s) => s.employees);
  const now = useNow();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const admin = me.role === 'admin';
  return (
    <>
      {admin && (
        <div className="form-card">
          <h4 className="section">{L('Nuevo aviso general', 'New announcement')}</h4>
          <p className="hint">
            {L(
              'Le aparece en pantalla a todo el equipo, conectado o no (lo verán al entrar).',
              "It pops up on screen for the whole team, online or not (they'll see it when they log in).",
            )}
          </p>
          <input className="input" placeholder={L('Título: Mañana se corta la luz a las 15:00', 'Title: Power outage tomorrow at 15:00')} maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="input" rows={3} placeholder={L('Detalle (opcional)', 'Details (optional)')} maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
          <button
            className="btn btn-primary btn-block"
            disabled={!title.trim()}
            onClick={() => {
              if (report(announce(title, body))) {
                setTitle('');
                setBody('');
              }
            }}
          >
            📢 {L('Publicar aviso', 'Post announcement')}
          </button>
        </div>
      )}
      <h4 className="section">{L('Avisos', 'Announcements')}</h4>
      {list.length === 0 && <p className="hint">{L('No hay avisos por ahora.', 'No announcements for now.')}</p>}
      <ul className="announce-list">
        {list.map((a) => (
          <li key={a.id}>
            <b>📢 {a.title}</b>
            {a.body && <p>{a.body}</p>}
            <small>
              {employees[a.by]?.name ?? L('Administración', 'Admin')} · {timeAgo(a.ts, now)}
            </small>
            {admin && (
              <button className="btn-icon" aria-label={L('Eliminar aviso', 'Delete announcement')} onClick={() => report(deleteAnnouncement(a.id))}>
                🗑
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function AgendaPanel({ me, onClose }: { me: Employee; onClose: () => void }) {
  const [tab, setTab] = useState<'meetings' | 'news'>('meetings');
  const meetings = useGame((s) => s.meetings ?? NO_MEETINGS);
  const employees = useGame((s) => s.employees);
  const mine = meetings.filter((m) => m.attendees.length === 0 || m.attendees.includes(me.id) || m.createdBy === me.id || me.role === 'admin');
  const live = mine.filter((m) => m.status === 'active');
  const upcoming = mine.filter((m) => m.status === 'scheduled').sort((a, b) => a.start - b.start);
  const past = mine
    .filter((m) => m.status === 'ended' || m.status === 'cancelled')
    .sort((a, b) => b.start - a.start)
    .slice(0, 5);

  return (
    <Panel title={L('Agenda', 'Schedule')} onClose={onClose}>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'meetings'} className={`tab ${tab === 'meetings' ? 'tab-on' : ''}`} onClick={() => setTab('meetings')}>
          🗓️ {L('Reuniones', 'Meetings')}
        </button>
        <button role="tab" aria-selected={tab === 'news'} className={`tab ${tab === 'news' ? 'tab-on' : ''}`} onClick={() => setTab('news')}>
          📢 {L('Avisos', 'Announcements')}
        </button>
      </div>
      {tab === 'meetings' ? (
        <>
          {live.length > 0 && (
            <ul className="meeting-list">
              {live.map((m) => (
                <MeetingCard key={m.id} m={m} me={me} employees={employees} />
              ))}
            </ul>
          )}
          <h4 className="section">{L('Próximas', 'Upcoming')}</h4>
          {upcoming.length === 0 && <p className="hint">{L('No hay reuniones agendadas.', 'No meetings scheduled.')}</p>}
          <ul className="meeting-list">
            {upcoming.map((m) => (
              <MeetingCard key={m.id} m={m} me={me} employees={employees} />
            ))}
          </ul>
          <p className="hint">
            {L(
              'A la hora de inicio todos los citados caminan a la sala de reuniones y se quedan ahí hasta que la reunión termina. Asistir da monedas.',
              'At the start time everyone invited walks to the meeting room and stays there until the meeting ends. Attending earns coins.',
            )}
          </p>
          {canSchedule(me) && <NewMeeting employees={employees} meId={me.id} />}
          {past.length > 0 && (
            <>
              <h4 className="section">{L('Recientes', 'Recent')}</h4>
              <ul className="meeting-list">
                {past.map((m) => (
                  <MeetingCard key={m.id} m={m} me={me} employees={employees} />
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <Announcements me={me} />
      )}
    </Panel>
  );
}
