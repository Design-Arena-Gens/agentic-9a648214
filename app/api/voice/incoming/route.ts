import { NextRequest } from "next/server";
import { response, say, gather } from "../../../../lib/twiml";
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
  // Fallback to URL query
  const url = new URL(req.url);
  return Promise.resolve(url.searchParams);
}

export async function POST(req: NextRequest) {
  const params = await parseFormEncoded(req);
  const callSid = params.get("CallSid") || params.get("callSid") || crypto.randomUUID();
  const from = params.get("From") || params.get("from") || "Unbekannt";
  const startIso = new Date().toISOString();

  await upsertCallLog({ callSid, fromNumber: from, startIso });

  const baseUrl = new URL(req.url);
  baseUrl.search = "";
  const handleUrl = `${baseUrl.origin}/api/voice/handle-gather?callSid=${encodeURIComponent(callSid)}&start=${encodeURIComponent(startIso)}&state=main`;

  const greeting = "Willkommen in der Zahnarztpraxis. Wie kann ich Ihnen helfen?"
    + " Sie k?nnen zum Beispiel sagen: Termin verschieben, Termin absagen, ?ffnungszeiten, Adresse, Notfall oder mit einem Mitarbeiter sprechen.";

  const twiml = response(
    [
      gather({ prompt: greeting, action: handleUrl, timeout: 7, speechTimeout: "auto" })
    ].join("")
  );

  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}

export async function GET() {
  const twiml = response(say("Dieser Endpunkt erwartet POST-Anfragen von Twilio.", "de-DE"));
  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}
