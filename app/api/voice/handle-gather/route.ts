import { NextRequest } from "next/server";
import { response, say, gather, dial, redirect, hangup } from "../../../../lib/twiml";
import { detectIntent, faqAnswer, isAffirmative, isNegative, normalize, extractName } from "../../../../lib/nlu";
import { upsertCallLog } from "../../../../lib/sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseFormEncoded(req: NextRequest): Promise<URLSearchParams> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    return req.text().then((t) => new URLSearchParams(t));
  }
  if (ct.includes("multipart/form-data")) {
    return req.formData().then((fd) => {
      const params = new URLSearchParams();
      fd.forEach((v, k) => params.append(k, String(v)));
      return params;
    });
  }
  const url = new URL(req.url);
  return Promise.resolve(url.searchParams);
}

function q(url: string, extra: Record<string, string | undefined>): string {
  const u = new URL(url);
  Object.entries(extra).forEach(([k, v]) => {
    if (v !== undefined) u.searchParams.set(k, v);
  });
  return u.toString();
}

export async function POST(req: NextRequest) {
  const baseUrl = new URL(req.url);
  const params = await parseFormEncoded(req);

  const callSid = params.get("callSid") || params.get("CallSid") || crypto.randomUUID();
  const from = params.get("From") || params.get("from") || undefined;
  const state = params.get("state") || baseUrl.searchParams.get("state") || "main";
  const start = baseUrl.searchParams.get("start") || new Date().toISOString();
  const speech = params.get("SpeechResult") || params.get("speechResult") || "";

  const forwardNumber = process.env.FORWARD_NUMBER;

  // Persist transcript fragments and reason
  if (speech) {
    await upsertCallLog({ callSid, fromNumber: from, reasonLong: speech });
  }

  const nextAction = (nextState: string) => q(`${baseUrl.origin}/api/voice/handle-gather`, {
    callSid,
    start,
    state: nextState
  });

  // State machine
  if (state === "main") {
    const { intent, reasonShort } = detectIntent(speech);
    const possibleName = extractName(speech);
    await upsertCallLog({ callSid, fromNumber: from, reasonShort, name: possibleName || undefined });

    if (intent === "emergency") {
      const twiml = response([
        say("Bei akuten Notf?llen: Bitte w?hlen Sie die 112 oder suchen Sie die n?chste Notaufnahme auf."),
        say("Kann ich sonst noch helfen?"),
        gather({ prompt: "M?chten Sie weitere Hilfe?", action: nextAction("anything_else"), timeout: 6 })
      ].join(""));
      return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    if (intent === "forward") {
      const twiml = response([
        say("M?chten Sie mit einem Mitarbeiter verbunden werden?"),
        gather({ prompt: "Sagen Sie bitte Ja oder Nein.", action: nextAction("confirm_forward"), timeout: 6 })
      ].join(""));
      return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    if (intent === "reschedule") {
      const twiml = response([
        say("Gerne. Bitte nennen Sie Ihren Namen und Ihre Wunschzeiten f?r die Verschiebung."),
        gather({ prompt: "Wie lautet Ihr Name und welche Zeiten passen Ihnen?", action: nextAction("reschedule_details"), timeout: 8 })
      ].join(""));
      return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    if (intent === "cancel") {
      const twiml = response([
        say("In Ordnung. Bitte nennen Sie Ihren Namen sowie Datum und Uhrzeit des Termins, den Sie absagen m?chten."),
        gather({ prompt: "Wie lautet Ihr Name und welcher Termin soll abgesagt werden?", action: nextAction("cancel_details"), timeout: 8 })
      ].join(""));
      return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    if (intent === "faq") {
      const ans = faqAnswer(speech) || "Dazu habe ich leider keine genaue Information. Unser Team hilft Ihnen gerne weiter.";
      const twiml = response([
        say(ans),
        say("Kann ich sonst noch helfen?"),
        gather({ prompt: "Brauchen Sie noch etwas?", action: nextAction("anything_else"), timeout: 6 })
      ].join(""));
      return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    // Other / unclear
    const twiml = response([
      say("Ich habe Sie leider nicht eindeutig verstanden."),
      say("Sie k?nnen sagen: Termin verschieben, Termin absagen, ?ffnungszeiten, Adresse, Notfall oder verbinden Sie mich."),
      gather({ prompt: "Wobei kann ich helfen?", action: nextAction("main"), timeout: 7 })
    ].join(""));
    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  if (state === "confirm_forward") {
    if (!forwardNumber) {
      const twiml = response([
        say("Aktuell ist keine Zielnummer hinterlegt. Ich kann Sie leider nicht verbinden."),
        say("Kann ich sonst noch helfen?"),
        gather({ prompt: "Brauchen Sie noch etwas?", action: nextAction("anything_else"), timeout: 6 })
      ].join(""));
      return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    if (isAffirmative(speech)) {
      await upsertCallLog({ callSid, reasonShort: "Weiterleitung" });
      const actionUrl = q(`${baseUrl.origin}/api/voice/after-forward`, { callSid, start });
      const callerId = process.env.TWILIO_CALLER_ID || undefined;
      const twiml = response([
        say("Ich verbinde Sie nun mit unserem Team."),
        dial(forwardNumber, { action: actionUrl, callerId })
      ].join(""));
      return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    if (isNegative(speech)) {
      const twiml = response([
        say("Alles klar. Wobei kann ich Sie sonst unterst?tzen?"),
        gather({ prompt: "Bitte sagen Sie Ihr Anliegen.", action: nextAction("main"), timeout: 7 })
      ].join(""));
      return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    const twiml = response([
      say("Entschuldigung, war das ein Ja?"),
      gather({ prompt: "Sagen Sie bitte Ja oder Nein.", action: nextAction("confirm_forward"), timeout: 5 })
    ].join(""));
    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  if (state === "reschedule_details") {
    const detail = normalize(speech);
    const possibleName = extractName(speech);
    await upsertCallLog({ callSid, reasonShort: "Termin verschieben", reasonLong: detail, name: possibleName || undefined });
    const twiml = response([
      say("Vielen Dank. Wir k?mmern uns um die Verschiebung und melden uns zur Best?tigung."),
      redirect(q(`${baseUrl.origin}/api/voice/complete`, { callSid, start }))
    ].join(""));
    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  if (state === "cancel_details") {
    const detail = normalize(speech);
    const possibleName = extractName(speech);
    await upsertCallLog({ callSid, reasonShort: "Termin absagen", reasonLong: detail, name: possibleName || undefined });
    const twiml = response([
      say("Alles klar. Wir haben die Absage aufgenommen und best?tigen dies zeitnah."),
      redirect(q(`${baseUrl.origin}/api/voice/complete`, { callSid, start }))
    ].join(""));
    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  if (state === "anything_else") {
    if (isNegative(speech)) {
      const twiml = response([
        say("Vielen Dank f?r Ihren Anruf. Auf Wiederh?ren!"),
        hangup()
      ].join(""));
      return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
    }
    const twiml = response([
      say("Gern. Wobei kann ich helfen?"),
      gather({ prompt: "Bitte sagen Sie Ihr Anliegen.", action: nextAction("main"), timeout: 6 })
    ].join(""));
    return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
  }

  // Fallback
  const twiml = response([
    say("Entschuldigung, bitte wiederholen Sie Ihr Anliegen."),
    gather({ prompt: "Wobei kann ich helfen?", action: q(`${baseUrl.origin}/api/voice/handle-gather`, { callSid, start, state: "main" }), timeout: 6 })
  ].join(""));
  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}

export async function GET() {
  const twiml = response(say("Dieser Endpunkt erwartet POST-Anfragen von Twilio.", "de-DE"));
  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}
