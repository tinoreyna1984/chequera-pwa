import { describe, expect, it } from "vitest";
import {
  decideDispatch,
  LATE_WINDOW_MS,
  localDateKey,
  MAX_DISPATCH_FAILURES,
  nextDueMs,
  todayDueMs,
} from "./dispatch";
import type { ReminderSubscription } from "./subscription-store";

const LIMA = "America/Lima"; // sin horario de verano, UTC-5 todo el año
const NEW_YORK = "America/New_York"; // DST: EDT (UTC-4) / EST (UTC-5)

function subscription(overrides: Partial<ReminderSubscription> = {}): ReminderSubscription {
  return {
    keys: { p256dh: "p256dh-de-prueba", auth: "auth-de-prueba" },
    time: "07:00",
    timezone: LIMA,
    failCount: 0,
    ...overrides,
  };
}

describe("todayDueMs / localDateKey en America/Lima", () => {
  it("07:00 local equivale siempre a 12:00 UTC", () => {
    const now = Date.UTC(2026, 10, 5, 10, 0); // 5 nov 05:00 en Lima
    expect(todayDueMs("07:00", LIMA, now)).toBe(Date.UTC(2026, 10, 5, 12, 0));
    expect(localDateKey(now, LIMA)).toBe("2026-11-05");
  });

  it("la fecha local cambia en la medianoche del dispositivo, no en la UTC", () => {
    const utc = Date.UTC(2026, 9, 5, 4, 0); // 4 oct 23:00 en Lima
    expect(localDateKey(utc, LIMA)).toBe("2026-10-04");
    expect(localDateKey(utc, NEW_YORK)).toBe("2026-10-05"); // 00:00 en Nueva York (EDT)
  });
});

describe("decideDispatch alrededor del horario de verano", () => {
  it("envía a las 07:00 EDT antes del cambio y a las 07:00 EST después", () => {
    // 31 oct 2026 (EDT, UTC-4): 07:00 EDT = 11:00 UTC
    expect(todayDueMs("07:00", NEW_YORK, Date.UTC(2026, 9, 31, 12, 0))).toBe(Date.UTC(2026, 9, 31, 11, 0));
    // 1 nov 2026, ya con EST (UTC-5): 07:00 EST = 12:00 UTC
    expect(todayDueMs("07:00", NEW_YORK, Date.UTC(2026, 10, 2, 12, 0))).toBe(Date.UTC(2026, 10, 2, 12, 0));

    const antes = subscription({ timezone: NEW_YORK });
    expect(decideDispatch(Date.UTC(2026, 9, 31, 10, 55), antes)).toBe("notYet"); // 06:55 EDT
    expect(decideDispatch(Date.UTC(2026, 9, 31, 11, 5), antes)).toBe("send"); // 07:05 EDT
    const despues = subscription({ timezone: NEW_YORK });
    expect(decideDispatch(Date.UTC(2026, 10, 1, 11, 55), despues)).toBe("notYet"); // 06:55 EST
    expect(decideDispatch(Date.UTC(2026, 10, 1, 12, 5), despues)).toBe("send"); // 07:05 EST
  });

  it("resuelve la hora local correcta en el cambio de primavera (EDT desde el 8 de marzo)", () => {
    expect(todayDueMs("07:00", NEW_YORK, Date.UTC(2026, 2, 7, 12, 0))).toBe(Date.UTC(2026, 2, 7, 12, 0)); // EST
    expect(todayDueMs("07:00", NEW_YORK, Date.UTC(2026, 2, 9, 12, 0))).toBe(Date.UTC(2026, 2, 9, 11, 0)); // EDT
    expect(decideDispatch(Date.UTC(2026, 2, 9, 11, 5), subscription({ timezone: NEW_YORK }))).toBe("send");
    expect(decideDispatch(Date.UTC(2026, 2, 9, 10, 55), subscription({ timezone: NEW_YORK }))).toBe("notYet");
  });
});

describe("decideDispatch: enviar, omitir o reprogramar", () => {
  const due = Date.UTC(2026, 10, 5, 12, 0); // 07:00 Lima

  it("envía dentro de la ventana y omite cuando está vencida más de 2 h", () => {
    expect(decideDispatch(due - 60_000, subscription())).toBe("notYet");
    expect(decideDispatch(due + 60_000, subscription())).toBe("send");
    expect(decideDispatch(due + LATE_WINDOW_MS, subscription())).toBe("send");
    expect(decideDispatch(due + LATE_WINDOW_MS + 1, subscription())).toBe("skipLate");
  });

  it("omite si el día ya fue enviado o marcado como leído, pero solo hoy", () => {
    const now = due + 60_000;
    const today = localDateKey(now, LIMA);
    expect(decideDispatch(now, subscription({ lastSentDate: today }))).toBe("skipAlreadySent");
    expect(decideDispatch(now, subscription({ readDate: today }))).toBe("skipRead");
    expect(decideDispatch(now, subscription({ lastSentDate: "2026-11-04" }))).toBe("send");
    expect(decideDispatch(now, subscription({ readDate: "2026-11-04" }))).toBe("send");
  });

  it("reprograma tras alcanzar el máximo de fallos consecutivos", () => {
    expect(decideDispatch(due + 60_000, subscription({ failCount: MAX_DISPATCH_FAILURES - 1 }))).toBe("send");
    expect(decideDispatch(due + 60_000, subscription({ failCount: MAX_DISPATCH_FAILURES }))).toBe("reprogram");
  });

  it("dos evaluaciones del mismo día devuelven enviar solo la primera", () => {
    const first = decideDispatch(due + 60_000, subscription());
    expect(first).toBe("send");

    // tras el primer envío, el caso de uso guarda lastSentDate con la fecha local
    const sent = subscription({ lastSentDate: localDateKey(due + 60_000, LIMA) });
    expect(decideDispatch(due + 15 * 60_000, sent)).toBe("skipAlreadySent");
    expect(decideDispatch(due + 60 * 60_000, sent)).toBe("skipAlreadySent");
  });
});

describe("nextDueMs", () => {
  it("apunta a hoy si la hora falta y a mañana si ya pasó", () => {
    expect(nextDueMs("07:00", LIMA, Date.UTC(2026, 10, 5, 10, 0))).toBe(Date.UTC(2026, 10, 5, 12, 0));
    expect(nextDueMs("07:00", LIMA, Date.UTC(2026, 10, 5, 12, 0))).toBe(Date.UTC(2026, 10, 6, 12, 0)); // estrictamente después
    expect(nextDueMs("07:00", LIMA, Date.UTC(2026, 10, 5, 13, 30))).toBe(Date.UTC(2026, 10, 6, 12, 0));
  });

  it("cruza mes y año correctamente", () => {
    expect(nextDueMs("07:00", LIMA, Date.UTC(2026, 11, 31, 13, 0))).toBe(Date.UTC(2027, 0, 1, 12, 0));
    expect(nextDueMs("07:00", LIMA, Date.UTC(2026, 1, 27, 13, 0))).toBe(Date.UTC(2026, 1, 28, 12, 0)); // 2026 no bisiesto
  });

  it("sobre el cambio de horario conserva la hora local elegida", () => {
    const afterChange = Date.UTC(2026, 10, 2, 12, 30); // 2 nov, 07:30 EST
    expect(nextDueMs("07:00", NEW_YORK, afterChange)).toBe(Date.UTC(2026, 10, 3, 12, 0)); // 3 nov 07:00 EST = 12:00 UTC
    const beforeChange = Date.UTC(2026, 9, 31, 12, 30); // 31 oct, 08:30 EDT (ya pasó la entrega)
    expect(nextDueMs("07:00", NEW_YORK, beforeChange)).toBe(Date.UTC(2026, 10, 1, 12, 0)); // 1 nov 07:00 EST = 12:00 UTC
  });
});
