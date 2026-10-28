import { useCallback, useEffect, useState } from 'react';
import { bridge } from './bridge';
import { startWeather } from './data/sky';
import { onNotification, onPrivateMessage, unreadDms, useChat } from './data/social';
import { logout, missionStatus, onSyncError, useGame, useSession } from './data/store';
import { PhaserGame } from './game/PhaserGame';
import { NOTIFICATION_ICON, NotificationsPanel } from './ui/ActivityFeed';
import { AdminPanel } from './ui/AdminPanel';
import { AgendaPanel } from './ui/AgendaPanel';
import { AwardPanel } from './ui/AwardPanel';
import { CharacterSetup } from './ui/CharacterSetup';
import { ChatPanel } from './ui/ChatPanel';
import { SafeBoundary, Toasts, richToast, toast } from './ui/common';
import { DecorBar } from './ui/DecorBar';
import { FundPanel } from './ui/FundPanel';
import { BellButton, BottomNav, ClockCard, MeetingBanner, Objectives, Ticker, type NavItem } from './ui/Hud';
import { KudosPanel } from './ui/KudosPanel';
import { LoginScreen } from './ui/LoginScreen';
import { MissionsPanel } from './ui/MissionsPanel';
import { AnnouncementOverlay, Celebrations, GiftNotice, WelcomeCard } from './ui/Overlays';
import { ProfilePanel } from './ui/ProfilePanel';
import { RankingPanel } from './ui/RankingPanel';
import { ShopPanel } from './ui/ShopPanel';

type PanelId = 'shop' | 'ranking' | 'award' | 'kudos' | 'admin' | 'notifications' | 'chat' | 'agenda' | 'missions' | 'fund';
type Open = { kind: PanelId; target?: string } | { kind: 'profile'; target: string } | null;

const TONE: Record<string, 'gold' | 'pink' | 'blue' | 'green'> = {
  mission: 'gold',
  award: 'gold',
  kudos: 'pink',
  meeting: 'blue',
  team: 'green',
};

export function App() {
  const me = useGame((s) => (s.currentUserId ? s.employees[s.currentUserId] : undefined));
  const { status, connection } = useSession();
  const chat = useChat();
  const [open, setOpen] = useState<Open>(null);
  const [decorating, setDecorating] = useState(false);

  const close = useCallback(() => setOpen(null), []);

  useEffect(() => onSyncError((message) => toast(message, false)), []);
  useEffect(() => startWeather(), []);
  useEffect(() => bridge.on('employee:clicked', (id) => setOpen({ kind: 'profile', target: id })), []);
  useEffect(() => bridge.on('decor:mode', (id) => setDecorating(id !== null)), []);

  // Avisos que llegan en vivo: los grandes (regalo, aviso general, logro, nivel) tienen su propia capa.
  useEffect(
    () =>
      onNotification((n) => {
        if (n.kind === 'gift' || n.kind === 'announcement' || n.kind === 'achievement' || n.kind === 'levelup') return;
        richToast(NOTIFICATION_ICON[n.kind], n.title, n.body ?? '', TONE[n.kind] ?? 'blue');
      }),
    [],
  );

  const employees = useGame((s) => s.employees);
  useEffect(
    () =>
      onPrivateMessage((m) => {
        const from = employees[m.from];
        richToast('💬', from ? `${from.name.split(' ')[0]} te escribió` : 'Mensaje nuevo', m.text, 'blue');
      }),
    [employees],
  );

  // Al cambiar de usuario se cierra todo y la cámara va a su puesto.
  useEffect(() => {
    setOpen(null);
    setDecorating(false);
    if (me) window.setTimeout(() => bridge.emit('camera:focus', me.id), 900);
    // Solo cuando cambia la persona, no cada vez que cambian sus datos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  if (status !== 'in' || me === undefined) {
    return (
      <div className="app">
        <PhaserGame />
        <div className="vignette" />
        <LoginScreen />
        <Toasts />
      </div>
    );
  }

  if (me.avatarSet !== true) {
    return (
      <div className="app">
        <PhaserGame />
        <div className="vignette" />
        <CharacterSetup me={me} />
        <Toasts />
      </div>
    );
  }

  const toggle = (kind: PanelId) => setOpen(open?.kind === kind ? null : { kind });
  const startDecor = () => {
    setOpen(null);
    bridge.emit('decor:mode', decorating ? null : me.id);
  };
  const boss = me.role !== 'colaborador';
  const missionsLeft = missionStatus(me).daily.filter((m) => !m.done).length;
  const chatUnread = chat.generalUnread + unreadDms(chat);

  const nav: NavItem[] = [
    {
      id: 'office',
      icon: 'home',
      label: 'Oficina',
      active: open === null && !decorating,
      onClick: () => {
        setOpen(null);
        if (decorating) bridge.emit('decor:mode', null);
        bridge.emit('camera:focus', me.id);
      },
    },
    { id: 'shop', icon: 'cart', label: 'Tienda', active: open?.kind === 'shop', onClick: () => toggle('shop') },
    { id: 'decor', icon: 'hammer', label: decorating ? 'Terminar' : 'Decorar', active: decorating, onClick: startDecor },
    { id: 'missions', icon: 'target', label: 'Misiones', active: open?.kind === 'missions', badge: missionsLeft, onClick: () => toggle('missions') },
    { id: 'chat', icon: 'chat', label: 'Chat', active: open?.kind === 'chat', badge: chatUnread, onClick: () => toggle('chat') },
    { id: 'agenda', icon: 'calendar', label: 'Agenda', active: open?.kind === 'agenda', onClick: () => toggle('agenda') },
    { id: 'ranking', icon: 'users', label: 'Equipo', active: open?.kind === 'ranking' || open?.kind === 'kudos', onClick: () => toggle('ranking') },
    { id: 'fund', icon: 'build', label: 'Ampliar', active: open?.kind === 'fund', onClick: () => toggle('fund') },
    ...(boss
      ? [{ id: 'award', icon: 'medal' as const, label: 'Desempeño', active: open?.kind === 'award', onClick: () => toggle('award') }]
      : []),
    me.role === 'admin'
      ? { id: 'admin', icon: 'gear', label: 'Ajustes', active: open?.kind === 'admin', onClick: () => toggle('admin') }
      : { id: 'logout', icon: 'swap', label: 'Salir', onClick: logout },
  ];

  return (
    <div className="app">
      <PhaserGame />
      <div className="vignette" />
      {connection === 'offline' && (
        <div className="net-badge" role="status">
          Sin conexión · reintentando…
        </div>
      )}
      <SafeBoundary label="la interfaz">
      <ClockCard me={me} onProfile={() => setOpen({ kind: 'profile', target: me.id })} />
      {/* Junto al reloj: los paneles se abren a la derecha y no la tapan. */}
      <div className="hud-tools">
        <BellButton active={open?.kind === 'notifications'} onClick={() => toggle('notifications')} />
      </div>
      <div className="hud-right">
        {!decorating && (
          <Objectives
            me={me}
            onOpen={() => setOpen({ kind: 'missions' })}
            onKudos={() => setOpen({ kind: 'kudos' })}
            onShop={() => setOpen({ kind: 'shop' })}
            onChat={() => setOpen({ kind: 'chat' })}
          />
        )}
      </div>
      <MeetingBanner me={me} />
      <Ticker />
      {decorating ? (
        <DecorBar me={me} onShop={() => setOpen({ kind: 'shop' })} onDone={() => bridge.emit('decor:mode', null)} />
      ) : (
        <BottomNav items={nav} />
      )}

      {open?.kind === 'shop' && (
        <ShopPanel
          me={me}
          onClose={close}
          onDecorate={() => {
            setOpen(null);
            if (!decorating) bridge.emit('decor:mode', me.id);
          }}
        />
      )}
      {open?.kind === 'ranking' && (
        <RankingPanel onClose={close} onOpen={(id) => setOpen({ kind: 'profile', target: id })} onKudos={() => setOpen({ kind: 'kudos' })} />
      )}
      {open?.kind === 'award' && <AwardPanel me={me} onClose={close} preselect={open.target} />}
      {open?.kind === 'kudos' && <KudosPanel me={me} onClose={close} preselect={open.target} />}
      {open?.kind === 'notifications' && <NotificationsPanel onClose={close} onOpenAgenda={() => setOpen({ kind: 'agenda' })} />}
      {open?.kind === 'chat' && <ChatPanel key={open.target ?? 'chat'} onClose={close} initialWith={open.target} />}
      {open?.kind === 'agenda' && <AgendaPanel me={me} onClose={close} />}
      {open?.kind === 'missions' && <MissionsPanel me={me} onClose={close} />}
      {open?.kind === 'fund' && <FundPanel me={me} onClose={close} />}
      {open?.kind === 'admin' && me.role === 'admin' && <AdminPanel onClose={close} />}
      {open?.kind === 'profile' && (
        <ProfilePanel
          key={open.target}
          id={open.target}
          onClose={close}
          onKudos={(id) => setOpen({ kind: 'kudos', target: id })}
          onAward={(id) => setOpen({ kind: 'award', target: id })}
          onMessage={(id) => setOpen({ kind: 'chat', target: id })}
        />
      )}

      {!decorating && (
        <GiftNotice
          onPlace={() => {
            setOpen(null);
            bridge.emit('decor:mode', me.id);
          }}
        />
      )}
      <AnnouncementOverlay />
      <WelcomeCard
        me={me}
        onMissions={() => setOpen({ kind: 'missions' })}
        onAgenda={() => setOpen({ kind: 'agenda' })}
        onFund={() => setOpen({ kind: 'fund' })}
      />
      <Celebrations meId={me.id} />
      </SafeBoundary>
      <Toasts />
    </div>
  );
}
