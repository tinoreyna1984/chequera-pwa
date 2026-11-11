export interface PushKeys {
  p256dh: string;
  auth: string;
}

export interface ReminderSubscription {
  /** Claves de cifrado del endpoint (las exige web-push para notificar). */
  keys: PushKeys;
  /** Hora local de entrega en formato 24 h, ej. "07:00". */
  time: string;
  /** Zona horaria IANA del dispositivo, ej. "America/Lima". */
  timezone: string;
  /** Fecha local ("YYYY-MM-DD") de la última entrega. */
  lastSentDate?: string;
  /** Fecha local ("YYYY-MM-DD") en que el usuario marcó el día como leído. */
  readDate?: string;
  /** Fallos consecutivos de envío; a 5 se reprograma (ver dispatch.ts). */
  failCount: number;
}

export interface DueSubscription {
  endpoint: string;
  record: ReminderSubscription;
}

export interface SubscriptionStore {
  /** Alta o actualización idempotente por endpoint, con su próxima entrega (dueMs en epoch ms). */
  put(endpoint: string, record: ReminderSubscription, dueMs: number): Promise<void>;
  /** Registro del endpoint, o null si no existe o el JSON está corrupto. */
  get(endpoint: string): Promise<ReminderSubscription | null>;
  /** Baja: elimina el registro y su candidata. */
  remove(endpoint: string): Promise<void>;
  /** Candidatas cuya próxima entrega (dueMs) ya llegó respecto a nowMs. */
  listDue(nowMs: number): Promise<DueSubscription[]>;
  /** Lock de despacho (SET NX PX): token propio si se tomó, null si ya está tomado. */
  acquireLock(): Promise<string | null>;
  /** Libera solo si el token sigue siendo el dueño (compare-and-delete). */
  releaseLock(token: string): Promise<void>;
}
