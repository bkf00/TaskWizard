"use client";

export function EmailSourceForm({ defaultActorEmail }: { defaultActorEmail: string }) {
  return (
    <>
      <form action="/api/sources/manual" method="post">
        <label htmlFor="actorEmail">Procesat de</label>
        <input id="actorEmail" name="actorEmail" type="email" defaultValue={defaultActorEmail} />

        <label htmlFor="emailFile">Fisier .eml</label>
        <input
          id="emailFile"
          type="file"
          accept=".eml,message/rfc822,text/plain"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
              const textarea = document.getElementById("rawEmail") as HTMLTextAreaElement | null;
              if (textarea) textarea.value = String(reader.result ?? "");
            };
            reader.readAsText(file);
          }}
        />

        <label htmlFor="rawEmail">Email complet / text copiat</label>
        <textarea
          id="rawEmail"
          name="rawEmail"
          required
          placeholder="Alege fisierul .eml sau lipeste aici emailul complet din Outlook. Subiectul, expeditorul si participantii vor fi extrasi automat cand exista headere."
        />

        <div style={{ marginTop: 16 }}>
          <button type="submit">Extrage taskuri propuse</button>
        </div>
      </form>

      <details className="advanced-source">
        <summary>Introducere avansata</summary>
        <form action="/api/sources/manual" method="post">
          <input type="hidden" name="actorEmail" value={defaultActorEmail} />

          <label htmlFor="type">Tip sursa</label>
          <select id="type" name="type" defaultValue="manual_upload">
            <option value="manual_upload">Recap / text manual</option>
            <option value="email">Email copiat</option>
            <option value="teams_transcript">Transcript Teams</option>
          </select>

          <label htmlFor="subject">Subiect</label>
          <input id="subject" name="subject" placeholder="Ex: Sedinta PV lucrare X" />

          <label htmlFor="fromEmail">Expeditor / organizator</label>
          <input id="fromEmail" name="fromEmail" type="email" placeholder="optional@example.com" />

          <label htmlFor="participants">Participanti</label>
          <input id="participants" name="participants" placeholder="email1@example.com, email2@example.com" />

          <label htmlFor="rawText">Text email / recap / transcript</label>
          <textarea id="rawText" name="rawText" />

          <div style={{ marginTop: 16 }}>
            <button className="button-secondary" type="submit">
              Proceseaza sursa avansata
            </button>
          </div>
        </form>
      </details>
    </>
  );
}
