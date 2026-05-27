"use client";

export function EmailSourceForm({
  defaultActorEmail,
  authenticated
}: {
  defaultActorEmail: string;
  authenticated: boolean;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => {
          const dialog = document.getElementById("import-dialog") as HTMLDialogElement | null;
          dialog?.showModal();
        }}
      >
        Adauga email
      </button>

      <dialog id="import-dialog">
        <div className="modal">
          <div className="modal-head">
            <div>
              <h2>Import email</h2>
              <p className="muted">
                Procesat de {defaultActorEmail}
                {authenticated ? "" : " (fallback local)"}
              </p>
            </div>
            <button
              className="button-ghost"
              type="button"
              onClick={() => {
                const dialog = document.getElementById("import-dialog") as HTMLDialogElement | null;
                dialog?.close();
              }}
            >
              Inchide
            </button>
          </div>

          <form action="/api/sources/manual" method="post">
            <input id="actorEmail" name="actorEmail" type="hidden" value={defaultActorEmail} />

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

            <details className="advanced-source">
              <summary>Introducere avansata</summary>

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
            </details>

            <div className="modal-actions">
              <span className="muted">Taskurile vor intra intai in review.</span>
              <button type="submit">Extrage taskuri propuse</button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
