type Listener = (...args: never[]) => void;

/**
 * Bus de eventos entre React, el store y Phaser (mismo patrón que Agent-Quest).
 * Para eventos efímeros: efectos visuales, cámara, modo decoración.
 * El estado persistente vive en el store, no aquí.
 */
export interface BridgeEvents {
  /** Monedas ganadas: animación sobre el personaje. */
  'fx:coins': (employeeId: string, amount: number) => void;
  'fx:levelup': (employeeId: string, level: number) => void;
  'fx:kudos': (fromId: string, toId: string) => void;
  /** Administración regaló una decoración: el objeto vuela hasta quien lo recibe. */
  'fx:gift': (fromId: string, toId: string, itemId: string) => void;
  'fx:achievement': (employeeId: string, achievementId: string) => void;
  /** Compra: el objeto (o adorno del vestuario) aparece sobre la cabeza. */
  'fx:purchase': (employeeId: string, itemId: string) => void;
  'fx:contribute': (employeeId: string, amount: number) => void;
  'fx:expansion': (level: number) => void;
  /** Mensaje del chat general: globo sobre el personaje. */
  'chat:say': (employeeId: string, text: string) => void;
  /** Llegó el clima actualizado de Santiago (luz y lluvia en la oficina). */
  weather: (w: import('./data/weather').Weather) => void;
  /** Quiénes están conectados. */
  presence: (online: string[]) => void;
  /** La UI pide a la cámara mostrar una zona (ampliación, sala de reuniones). */
  'camera:room': (roomId: string) => void;
  /** React pide a la cámara ir a un colaborador. */
  'camera:focus': (employeeId: string) => void;
  /** Clic sobre un personaje en el mundo. */
  'employee:clicked': (employeeId: string) => void;
  /** Modo decoración: null = salir. */
  'decor:mode': (employeeId: string | null) => void;
  /** Objeto que se está por colocar (de la bodega), o null. */
  'decor:pick': (itemId: string | null) => void;
  'decor:rotate': () => void;
  /** Guardar en bodega el objeto que se está moviendo. */
  'decor:store-held': () => void;
  /** Phaser informa qué objeto colocado se está moviendo (uid) o null. */
  'decor:holding': (uid: string | null) => void;
  /** Phaser informa la última acción de decoración a la UI. */
  'decor:hint': (message: string) => void;
}

type EventName = keyof BridgeEvents;

class Bridge {
  private listeners = new Map<EventName, Set<Listener>>();

  on<E extends EventName>(event: E, fn: BridgeEvents[E]): () => void {
    let set = this.listeners.get(event);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as Listener);
    return () => this.off(event, fn);
  }

  off<E extends EventName>(event: E, fn: BridgeEvents[E]): void {
    this.listeners.get(event)?.delete(fn as Listener);
  }

  emit<E extends EventName>(event: E, ...args: Parameters<BridgeEvents[E]>): void {
    const set = this.listeners.get(event);
    if (set === undefined) return;
    for (const fn of set) (fn as (...a: Parameters<BridgeEvents[E]>) => void)(...args);
  }
}

export const bridge = new Bridge();
