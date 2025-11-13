export default function Page() {
  return (
    <main style={{ padding: 24, maxWidth: 840, margin: '0 auto' }}>
      <h1 style={{ fontSize: 32, marginBottom: 12 }}>Zahnarzt Voice Agent</h1>
      <p style={{ lineHeight: 1.6 }}>
        Dieser Sprachassistent beantwortet Fragen, verschiebt oder l?scht Termine und kann Anrufe an das Team weiterleiten.
        Alle wichtigen Informationen werden in Google Sheets protokolliert.
      </p>

      <h2 style={{ fontSize: 22, marginTop: 24 }}>Twilio Anbindung</h2>
      <ol style={{ lineHeight: 1.6 }}>
        <li>Richten Sie in Twilio f?r Ihre Rufnummer den Voice Webhook auf <code>/api/voice/incoming</code> (HTTP POST) ein.</li>
        <li>Sprache auf <strong>Deutsch (de-DE)</strong> setzen; DTMF/Speech aktiviert.</li>
        <li>Optional: <code>FORWARD_NUMBER</code> als Zielnummer f?r Weiterleitung konfigurieren.</li>
      </ol>

      <h2 style={{ fontSize: 22, marginTop: 24 }}>Google Sheets</h2>
      <p>
        Hinterlegen Sie Service-Account Variablen und ein Spreadsheet. Falls nicht gesetzt, wird lokal geloggt.
      </p>

      <div style={{ marginTop: 24, padding: 16, background: '#f1f5f9', borderRadius: 8 }}>
        <strong>Umgebungsvariablen</strong>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{`
FORWARD_NUMBER=+49XXXXXXXXXX
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n
GOOGLE_SHEETS_SPREADSHEET_ID=your_sheet_id
`}</pre>
      </div>

      <p style={{ marginTop: 24 }}>
        Deploy auf Vercel: Die API-Routen sind Serverless Functions (Node.js).
      </p>
    </main>
  );
}
