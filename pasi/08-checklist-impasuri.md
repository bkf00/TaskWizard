# 08 - Checklist impasuri

Cand ceva nu functioneaza, verifica in ordine.

## Emailurile nu apar ca surse

- Folderul Outlook monitorizat este corect?
- Utilizatorul a mutat emailul in folderul dedicat?
- Subscription-ul Graph este activ?
- Tokenul Graph este valid?
- Exista erori 401, 403 sau 429?
- Emailul a fost marcat ca duplicat prin `source_hash`?

## Meetingurile nu apar ca surse

- Meetingul are transcript sau recap?
- Transcriptul a fost pornit in Teams?
- Politica tenantului permite acces la transcript?
- Organizatorul/contul aplicatiei are drepturile necesare?
- Meetingul este calendar-backed?
- Exista fallback manual disponibil?

## AI nu extrage taskuri bune

- Promptul cere explicit doar actiuni clare?
- Schema forteaza `confidence` si `evidence`?
- Sistemul interzice inventarea deadline-urilor?
- Textul sursa este prea lung sau prea zgomotos?
- Sunt exemple romanesti in prompt/teste?

## Apar duplicate

- Se calculeaza `source_hash`?
- Se verifica daca sursa a mai fost procesata?
- Se verifica taskuri similare inainte de aprobare?
- Workerul de Planner este idempotent?

## Taskurile nu ajung in Planner

- Taskul este `approved`?
- Exista `planId` si `bucketId` valide?
- Responsabilul este mapat la ID Microsoft?
- Graph are permisiuni pentru Planner?
- Exista retry pentru erori temporare?
- Eroarea este salvata in `processing_errors`?

## Probleme de confidentialitate

- Sursa a fost procesata explicit?
- Textul brut este pastrat prea mult?
- Cine poate vedea taskurile propuse?
- Cine poate vedea sursa originala?
- Datele trimise la AI sunt strict necesare?

