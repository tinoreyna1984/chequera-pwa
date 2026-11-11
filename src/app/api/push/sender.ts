import { sendNotification, setVapidDetails } from "web-push";
import type { PushSender, PushTarget, ReminderPayload, SendOutcome } from "@/core/reminder/run-dispatch";

export function createWebPushSender(): PushSender {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error(
      "Faltan VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY; ver README.md (Recordatorio diario: preparación).",
    );
  }
  setVapidDetails(subject, publicKey, privateKey);

  return {
    async send(target: PushTarget, payload: ReminderPayload): Promise<SendOutcome> {
      try {
        await sendNotification({ endpoint: target.endpoint, keys: target.keys }, JSON.stringify(payload));
        return "delivered";
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // suscripción expirada o inexistente: comportamiento esperado, no es ruido
          return "gone";
        }
        // 429, 5xx y errores de red: el caso de uso reintenta con failCount
        console.error(`web-push: fallo ${statusCode ?? "sin statusCode"} al notificar`, error);
        return "retry";
      }
    },
  };
}
