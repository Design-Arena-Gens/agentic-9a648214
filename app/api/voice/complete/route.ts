import { NextRequest } from "next/server";
import { response, say, hangup } from "../../../../lib/twiml";
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

export async function POST(req: NextRequest) {
  const baseUrl = new URL(req.url);
  const params = await parseFormEncoded(req);
  const callSid = params.get("callSid") || params.get("CallSid") || baseUrl.searchParams.get("callSid") || "";
  const startIso = baseUrl.searchParams.get("start");
  const endIso = new Date().toISOString();

  if (callSid) {
    let durationSeconds: number | undefined = undefined;
    if (startIso) {
      try {
        const start = new Date(startIso).getTime();
        const end = new Date(endIso).getTime();
        durationSeconds = Math.max(0, Math.round((end - start) / 1000));
      } catch {}
    }
    await upsertCallLog({ callSid, endIso, durationSeconds });
  }

  const twiml = response([
    say("Vielen Dank f?r Ihren Anruf. Auf Wiederh?ren!"),
    hangup()
  ].join(""));

  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}

export async function GET() {
  const twiml = response(say("Dieser Endpunkt erwartet POST-Anfragen von Twilio.", "de-DE"));
  return new Response(twiml, { headers: { "Content-Type": "text/xml" } });
}
