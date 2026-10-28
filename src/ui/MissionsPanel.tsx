import { useState } from 'react';
import { CHECKIN_COINS, DAILY_BONUS, KUDOS_COINS, STREAK_BONUS, STREAK_EVERY } from '../data/catalog';
import { ACHIEVEMENTS, LEVEL_REWARD_PER_LEVEL, MEETING_REWARD, PUNCTUAL_BONUS, TEAM_GOAL_REWARD } from '../data/progress';
import { achievementValue, canOpenChest, claimDailyBonus, missionStatus, openChest, today, type MissionStatus } from '../data/store';
import type { Employee } from '../data/types';
import { Panel, Progress, report } from './common';

function MissionList({ list }: { list: MissionStatus[] }) {
  return (
    <ul className="mission-list">
      {list.map((m) => (
        <li key={m.id} className={m.done ? 'mission-done' : ''}>
          <span className="mission-icon">{m.done ? '✅' : m.icon}</span>
          <span className="mission-body">
            <b>{m.label}</b>
            <Progress value={m.progress} max={m.target} tone={m.done ? 'green' : 'blue'} />
            <small>
              {m.progress}/{m.target}
            </small>
          </span>
          <span className="mission-reward">+{m.reward}</span>
        </li>
      ))}
    </ul>
  );
}

export function MissionsPanel({ me, onClose }: { me: Employee; onClose: () => void }) {
  const [tab, setTab] = useState<'missions' | 'achievements' | 'how'>('missions');
  const { daily, weekly } = missionStatus(me);
  const unlocked = new Set(me.achievements ?? []);
  const allDaily = daily.length > 0 && daily.every((m) => m.done);

  return (
    <Panel title="Misiones y logros" onClose={onClose} wide>
      <div className="tabs" role="tablist">
        {(
          [
            ['missions', '🎯 Misiones'],
            ['achievements', `🏆 Logros ${unlocked.size}/${ACHIEVEMENTS.length}`],
            ['how', '💡 Cómo ganar monedas'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'tab-on' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'missions' && (
        <div className="missions-grid">
          <section>
            <h4 className="section">Hoy</h4>
            {daily.length === 0 ? <p className="hint">Las misiones diarias vuelven el próximo día laboral.</p> : <MissionList list={daily} />}
            <div className="row-btns">
              <button className="btn chest-btn" disabled={!canOpenChest(me)} onClick={() => report(openChest())}>
                🧰 {canOpenChest(me) ? 'Abrir cofre diario' : 'Cofre abierto hoy'}
              </button>
              <button className="btn btn-gold" disabled={!allDaily || me.bonusDate === today()} onClick={() => report(claimDailyBonus())}>
                🎁 Bono diario +{DAILY_BONUS}
              </button>
            </div>
          </section>
          <section>
            <h4 className="section">Esta semana</h4>
            <MissionList list={weekly} />
          </section>
        </div>
      )}

      {tab === 'achievements' && (
        <ul className="achievement-grid">
          {ACHIEVEMENTS.map((a) => {
            const got = unlocked.has(a.id);
            const value = Math.min(a.target, achievementValue(me, a));
            return (
              <li key={a.id} className={got ? 'ach-got' : ''}>
                <span className="ach-icon">{a.icon}</span>
                <b>{a.name}</b>
                <small>{a.desc}</small>
                {got ? <span className="ach-done">¡Desbloqueado!</span> : <Progress value={value} max={a.target} tone="gold" />}
                <span className="ach-reward">
                  +{a.reward} {a.cosmetic ? '· 🎩 adorno' : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {tab === 'how' && (
        <ul className="how-list">
          <li>☀️ <b>Marca tu llegada</b> cada día laboral: +{CHECKIN_COINS}, y +{PUNCTUAL_BONUS} extra si llegas hasta las 8:30.</li>
          <li>🔥 <b>Racha</b>: cada {STREAK_EVERY} días laborales seguidos, +{STREAK_BONUS}. El fin de semana no la corta.</li>
          <li>🎯 <b>Misiones diarias</b>: 3 distintas cada día (de 5 a 18 monedas), y +{DAILY_BONUS} al completar las tres.</li>
          <li>📆 <b>Misiones semanales</b>: desafíos más grandes, hasta 80 monedas cada uno.</li>
          <li>🧰 <b>Cofre diario</b>: de 8 a 120 monedas. ¡Algunos días toca premio gordo!</li>
          <li>💖 <b>Reconocimientos</b>: quien recibe gana {KUDOS_COINS} y quien reconoce gana 1 (hasta 3 al día).</li>
          <li>🏅 <b>Desempeño</b>: tu jefatura registra ventas, metas y logros (de 10 a 150, o más en casos especiales).</li>
          <li>🎉 <b>Meta del equipo</b>: cuando la productividad llega al 100 %, todos ganan +{TEAM_GOAL_REWARD}.</li>
          <li>🗓️ <b>Reuniones</b>: asistir da +{MEETING_REWARD}.</li>
          <li>⭐ <b>Subir de nivel</b> da un premio de nivel × {LEVEL_REWARD_PER_LEVEL} monedas.</li>
          <li>🏆 <b>Logros</b>: premios únicos de hasta 150 monedas, y algunos regalan adornos para tu personaje.</li>
        </ul>
      )}
    </Panel>
  );
}
