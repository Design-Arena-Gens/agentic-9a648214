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

  const callSid = params.get("callSid") || params.get("CallSid") || "";
  const start = baseUrl.searchParams.get("start") || new Date().toISOString();
  const dialDuration = Number(params.get("DialCallDuration") || 0);

  if (callSid) {
    await upsertCallLog({ callSid, durationSeconds: dialDuration > 0 ? dialDuration : undefined });
  }

  const twiml = response([
    say("Das Gespr?ch wurde beendet. Kann ich Ihnen sonst noch helfen?"),
    gather({ prompt: "Brauchen Sie noch etwas?", action: q(`${baseUrl.origin}/api/voice/handle-gather`, { callSid, start, state: "anything_else" }), timeout: 6 })
  ].join(""));

  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}

export async function GET() {
  const twiml = response(say("Dieser Endpunkt erwartet POST-Anfragen von Twilio.", "de-DE"));
  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}
