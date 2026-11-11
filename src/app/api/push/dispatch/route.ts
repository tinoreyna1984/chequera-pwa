import { runDispatch } from "@/core/reminder/run-dispatch";
import { createWebPushSender } from "../sender";
import { UpstashSubscriptionStore } from "../store";

/** Invocada por Vercel Schedules con `Authorization: Bearer <CRON_SECRET>`. */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const store = new UpstashSubscriptionStore();
    const sender = createWebPushSender();
    const report = await runDispatch(store, sender, Date.now());
    if (report === null) {
      return Response.json({ ok: true, note: "otra ejecución en curso; lock no obtenido" });
    }
    return Response.json({ ok: true, ...report });
  } catch (error) {
    console.error("dispatch:", error);
    return Response.json({ error: "No se pudo despachar el recordatorio" }, { status: 500 });
  }
}
