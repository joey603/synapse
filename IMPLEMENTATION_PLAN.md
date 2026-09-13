# Plan d’implémentation — Synapse

Document de référence pour le MVP.  
`PROJECT_SPEC.md` reste le cahier des charges fonctionnel. Ce fichier fige les décisions techniques, les arbitrages de cohérence, et le découpage.  
Phases 1 à 9 sont en place.

Écarts de scaffold, assumés :

- Next.js 16 + Tailwind 4 : pas de `tailwind.config.ts`. Le thème vit dans `src/app/globals.css` (`@theme`), qui est la forme actuelle de Tailwind.
- `docker-compose.yml` publie Postgres sur le port **5433**, pour ne pas entrer en conflit avec le PostgreSQL déjà présent sur 5432.
- La migration `init` a été appliquée sur ce Postgres local (`postgresql://yoelibarthel@localhost:5432/synapse`), Docker Desktop n’étant pas démarré. Le compose reste le chemin prévu dès qu’il l’est.
- Auth.js n’est pas utilisé pour la connexion. Son fournisseur Credentials ne crée pas de session en base, donc on ne peut pas la révoquer. La session est une ligne `Session`, cookie `httpOnly` qui ne contient que l’identifiant, jeton stocké sous HMAC. Durée fixe de 8 heures.

Périmètre : documentation clinique, hospitalisation à domicile psychiatrique, un infirmier, usage mobile-first (iPhone), données fictives uniquement pendant le développement.

Workflow retenu :

`PATIENT → VISITE → AUDIO (import) → TRANSCRIPTION → EXTRACTION STRUCTURÉE → CONTEXTE PATIENT PERTINENT → TRANSMISSION HÉBREU → RELECTURE → VALIDATION → COPIE`

---

## 1. Revue de cohérence

Le cahier des charges est exploitable. Le workflow central, l’interdiction d’halluciner, la validation humaine et la séparation audio / transcription / transmission sont clairs et compatibles entre eux.

Plusieurs passages se contredisent ou mélangent le MVP et les versions suivantes. Décisions retenues ci-dessous. Elles priment, pour le MVP, sur les passages contradictoires.

| Sujet | Tension dans le spec | Décision MVP |
| --- | --- | --- |
| Audio | §8 demande l’enregistrement dans l’app. §38 et §48 (premier livrable) demandent l’import. §39 place l’enregistrement direct en V2. | **Import de fichier uniquement** (`m4a`, `mp3`, `wav`, `aac`). Pas d’enregistreur in-app. |
| Locuteurs | §10 « si possible ». §39 place la diarization en V2. | **Pas de diarization.** Transcription brute. `speakerData` reste nullable pour plus tard. |
| Traitements | §21 et §28 demandent un module historisé. §39 place les traitements structurés en V2. | **Tables en base + liste en lecture seule** sur la fiche, pour servir de référence au pipeline. Pas d’écran d’édition ni d’historique de modifications en UI. |
| Résumé clinique | §5, §23, §28 demandent un résumé. §39 place la mise à jour automatique en V2. | **Champ manuel** sur la fiche. L’IA ne le met pas à jour. Seules des données validées pourront l’alimenter plus tard. |
| Alertes | §4 et §37 demandent des alertes. §39 les place en V2. | **Pas de moteur d’alertes.** Sur l’écran de relecture, une liste « à vérifier » est **calculée** depuis l’extraction (pas une table, pas un dashboard d’alertes). |
| Recherche | §4 inclut la recherche clinique. §39 place la recherche avancée en V2. | Recherche **nom, prénom, ville, téléphone** uniquement. |
| Visites du jour | §4 les affiche. Le planning est en V3 (§40). | Compteur des visites **datées aujourd’hui**, pas un agenda. |
| Comparaison entre visites | §11 étapes D et E la demandent dans le pipeline. §39 en fait une fonction V2. | **Diff déterministe interne au pipeline**, sans écran de comparaison. |
| Exemple typographique | §16 montre `המטופל שולל מחשבות אובדניות`. §13 interdit cette phrase si le sujet n’est pas abordé. | **L’exemple du §16 n’est pas un modèle.** Une négation clinique n’est rédigée que si le patient l’a dite explicitement, avec extrait. Sinon : non évalué / non rapporté, jamais nié. |
| Langues UI | §24 : français + hébreu RTL. Les transmissions sont toujours en hébreu. | UI **français par défaut**, structure RTL prête dès le départ, bascule hébreu sur le parcours principal. La transmission s’affiche toujours RTL, quelle que soit la langue de l’UI. |
| Russe | §9 : « si techniquement possible ». | Pas de travail produit dédié. Supporté si le modèle de transcription le gère. La langue détectée est stockée. |
| Hors-ligne | §44 demande de préserver le travail local. Un brouillon clinique en `localStorage` est un risque de fuite sur un téléphone. | Pas de mode hors-ligne. L’audio déjà uploadé et la transcription déjà reçue restent en base. L’éditeur s’enregistre **côté serveur**. Si le réseau coupe, message clair, sans persister de texte clinique dans le navigateur. |
| Chiffrement | §29 demande le chiffrement des données sensibles. Le chiffrement applicatif champ par champ casse Prisma et la recherche, pour un gain faible si le disque est déjà chiffré. | **TLS + chiffrement au repos** (volume Postgres, SSE sur le stockage objet). Pas de chiffrement champ par champ dans le MVP. Décision de pré-production, pas un oubli. |
| Premier livrable | §38 liste l’historique. §48 décrit la démo bout-en-bout. | La démo du §48 est le critère de fin du MVP. L’historique longitudinal est la timeline + les transmissions validées, pas les modules V2. |

Hors de ce tableau, le spec est suivi tel quel.

---

## 2. Décisions d’architecture

Priorités, dans l’ordre : sécurité des données, fiabilité clinique, absence d’hallucinations, simplicité mobile, rapidité, maintenabilité, coût API.

| Décision | Choix | Pourquoi |
| --- | --- | --- |
| Application | Next.js App Router + TypeScript, un seul dépôt | Spec. Un process serveur long (pas du serverless à timeout court) pour les fichiers audio. |
| UI | Tailwind CSS, mobile-first, cibles tactiles ≥ 44 px | Spec. Pas de bibliothèque de composants lourde au départ. |
| Données | PostgreSQL + Prisma + migrations | Spec. |
| Auth | Auth.js v5, sessions en base, cookie `httpOnly` / `Secure` / `SameSite=Lax` | Sessions révocables. Pas de JWT longue durée. |
| Fichiers | Stockage objet privé, interface `StorageService` | Spec. Local en dev, S3-compatible en prod. |
| IA | Appels **uniquement** dans `src/lib/ai`, clé dans l’environnement serveur | Spec. Aucun `NEXT_PUBLIC_*` pour OpenAI. |
| Jobs longs | Statut en base + traitement asynchrone dans le process Node + polling UI | Un entretien de 30–45 min dépasse les timeouts serverless typiques. Pas de Redis au MVP. |
| RAG / embeddings | **Non** | Le spec le renvoie à « à terme ». Le contexte MVP est une requête SQL bornée. Moins cher, plus prévisible, moins d’hallucinations. |
| Multi-tenant / RBAC | **Non** | Un déploiement = un clinicien. Le schéma porte un `User` pour ne pas peindre dans un angle mort, sans moteur de droits. |
| Tests cliniques | Fournisseur IA factice + transcripts fictifs | Zéro donnée réelle, zéro coût pour le parcours de démo. |

Hébergement recommandé, à confirmer avant toute donnée réelle : Docker (app + PostgreSQL + stockage objet) sur une machine contrôlée par le service, région UE ou Israël. Pas de Postgres managé chez un éditeur qui expose la base à un agent IA. OpenAI est un sous-traitant : compte avec **rétention nulle / pas d’entraînement**, et accord de traitement, **avant** le premier patient réel. Cette contrainte ne bloque pas le développement sur données fictives.

---

## 3. Architecture technique

```
iPhone (UI RTL/LTR)
    │  HTTPS, cookie de session
    ▼
Next.js (Server Components + Route Handlers)
    │
    ├── Auth.js ───────────── sessions Postgres
    ├── Prisma ────────────── PostgreSQL
    ├── StorageService ────── disque local (dev) / bucket privé (prod)
    ├── AuditLog ──────────── insert only, jamais de texte clinique
    └── Pipeline
            1. Upload + contrôles fichier          déterministe
            2. Transcription                       modèle audio
            3. Chargement du contexte              SQL borné
            4. Extraction JSON                     LLM + schéma Zod
            5. Validation des preuves              déterministe
            6. Diff avec la dernière visite validée déterministe
            7. Liste « à vérifier »                déterministe
            8. Rédaction hébreu depuis le JSON     LLM
            9. Relecture humaine → validation
```

Règle de coupe : une page ne parle jamais à OpenAI. Elle appelle une route authentifiée. La route appelle `pipeline.ts`. `pipeline.ts` appelle `AIService`. Les prompts vivent dans `/prompts`, jamais dans un composant.

Deux statuts distincts, volontairement :

- `Visit.pipelineStatus` : où en est le traitement automatique.
- `ClinicalReport.status` : où en est le texte clinique (`DRAFT` → `VALIDATED`).

Un échec de transcription ne supprime pas l’audio. Un échec de génération ne supprime pas la transcription.

---

## 4. Arborescence

```
Synapse/
├── PROJECT_SPEC.md
├── IMPLEMENTATION_PLAN.md
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── docker-compose.yml              # postgres + minio, dev uniquement
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                     # 5 patients fictifs, jamais de vraies données
├── prompts/
│   ├── clinical-extraction.ts
│   ├── nursing-report-he.ts
│   └── report-actions.ts           # raccourcir / plus clinique / corriger l’hébreu
├── fixtures/
│   └── transcripts/                # entretiens fictifs HE/FR/mixte, pour le fournisseur factice
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   │   └── login/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx          # shell mobile, garde d’auth
│   │   │   ├── page.tsx            # dashboard
│   │   │   └── patients/
│   │   │       ├── page.tsx
│   │   │       ├── new/page.tsx
│   │   │       └── [patientId]/
│   │   │           ├── page.tsx
│   │   │           ├── edit/page.tsx
│   │   │           └── visits/
│   │   │               ├── new/page.tsx
│   │   │               └── [visitId]/page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── patients/route.ts
│   │       ├── patients/[patientId]/route.ts
│   │       ├── visits/route.ts
│   │       ├── visits/[visitId]/route.ts
│   │       ├── visits/[visitId]/audio/route.ts
│   │       ├── visits/[visitId]/pipeline/route.ts
│   │       ├── visits/[visitId]/report/route.ts
│   │       └── recordings/[recordingId]/route.ts
│   ├── components/
│   │   ├── layout/                 # AppShell, BottomNav, PageHeader
│   │   ├── dashboard/
│   │   ├── patients/
│   │   ├── visits/
│   │   ├── pipeline/
│   │   └── reports/
│   ├── lib/
│   │   ├── db.ts
│   │   ├── auth.ts
│   │   ├── audit.ts
│   │   ├── logger.ts               # redact : jamais de transcript, audio, dosage
│   │   ├── storage/
│   │   │   ├── types.ts
│   │   │   ├── local.ts
│   │   │   └── s3.ts
│   │   ├── ai/
│   │   │   ├── types.ts            # contrats, indépendants d’OpenAI
│   │   │   ├── openai.ts
│   │   │   ├── fake.ts             # fixtures, zéro appel réseau
│   │   │   ├── factory.ts
│   │   │   ├── context.ts          # sélection SQL du contexte
│   │   │   ├── validators.ts       # anti-hallucination, après le LLM
│   │   │   └── pipeline.ts
│   │   ├── clinical/
│   │   │   ├── templates.ts        # choix de gabarit = code, pas LLM
│   │   │   ├── diff.ts
│   │   │   ├── review-flags.ts
│   │   │   ├── forbidden-phrases.ts
│   │   │   └── statuses.ts
│   │   └── i18n/
│   └── types/
└── tests/
    ├── clinical/                   # validateurs, statuts, phrases interdites
    └── api/                        # authz, perte d’audio interdite
```

`prompts/patient-summary.ts` n’est pas créé au MVP : le résumé n’est pas généré. Le chemin du spec reste réservé à la V2.

---

## 5. Schéma Prisma

Principes :

- l’âge n’est pas stocké : il se calcule depuis `birthDate` ;
- un patient, une visite, un audio actif, une transcription, une extraction, une transmission ;
- les faits cliniques du MVP sont un JSON validé par Zod, pas vingt tables de symptômes ;
- `Medication` existe pour ne pas inventer un traitement, mais l’UI ne le modifie pas ;
- `AuditLog` est en append-only applicatif (aucun update, aucun delete dans le code).

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  NURSE
  ADMIN
}

enum PatientStatus {
  ACTIVE
  INACTIVE
}

enum Sex {
  MALE
  FEMALE
  OTHER
  UNSPECIFIED
}

enum VisitType {
  IN_PERSON
  VIRTUAL
  PHONE
  ADMISSION
  ASSESSMENT
  FAMILY_CONTACT
  OTHER
}

enum PipelineStatus {
  IDLE
  UPLOADED
  TRANSCRIBING
  TRANSCRIBED
  EXTRACTING
  EXTRACTED
  GENERATING
  READY
  FAILED
}

enum ReportStatus {
  DRAFT
  AI_GENERATED
  REVIEWED
  VALIDATED
}

enum RetentionPolicy {
  KEEP
  DELETE_AFTER_TRANSCRIPTION
  EXPIRE_AT
}

enum AudioStatus {
  STORED
  DELETED
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  name         String
  passwordHash String
  role         UserRole  @default(NURSE)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  sessions     Session[]
  auditLogs    AuditLog[]
  validatedReports ClinicalReport[] @relation("ValidatedBy")
}

model Session {
  id        String   @id @default(cuid())
  sessionToken String @unique
  userId    String
  expires   DateTime
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Patient {
  id                    String        @id @default(cuid())
  firstName             String
  lastName              String
  birthDate             DateTime?     @db.Date
  sex                   Sex           @default(UNSPECIFIED)
  phone                 String?
  city                  String?
  address               String?
  contactName           String?
  contactPhone          String?
  insurer               String?
  referringPsychiatrist String?
  referringNurse        String?
  admittedAt            DateTime?     @db.Date
  status                PatientStatus @default(ACTIVE)

  primaryDiagnosis      String?
  secondaryDiagnoses    String?
  psychHistory          String?
  somaticHistory        String?
  suicideHistory        String?
  addictions            String?
  allergies             String?
  riskFactors           String?
  protectiveFactors     String?
  currentSummary        String?       // manuel. Jamais écrasé par l’IA au MVP.
  currentTreatmentNote  String?       // texte libre, en plus de Medication

  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  visits                Visit[]
  medications           Medication[]
  auditLogs             AuditLog[]

  @@index([status])
  @@index([lastName, firstName])
  @@index([city])
  @@index([phone])
}

model Visit {
  id              String         @id @default(cuid())
  patientId       String
  type            VisitType
  occurredAt      DateTime
  notes           String?
  pipelineStatus  PipelineStatus @default(IDLE)
  failureCode     String?        // code stable, jamais le message brut du fournisseur
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  patient         Patient        @relation(fields: [patientId], references: [id], onDelete: Restrict)
  recording       AudioRecording?
  transcript      Transcript?
  extraction      ClinicalExtraction?
  report          ClinicalReport?
  auditLogs       AuditLog[]

  @@index([patientId, occurredAt])
  @@index([pipelineStatus])
}

model AudioRecording {
  id                  String          @id @default(cuid())
  visitId             String          @unique
  storageKey          String          @unique // UUID, jamais le nom du patient
  originalFilename    String?
  mimeType            String
  sizeBytes           Int
  durationSeconds     Int?
  retentionPolicy     RetentionPolicy @default(KEEP)
  expiresAt           DateTime?
  status              AudioStatus     @default(STORED)
  consentAcknowledged Boolean         @default(false)
  deletedAt           DateTime?
  createdAt           DateTime        @default(now())

  visit               Visit           @relation(fields: [visitId], references: [id], onDelete: Restrict)
}

model Transcript {
  id                String   @id @default(cuid())
  visitId           String   @unique
  detectedLanguage  String?  // he | fr | en | ru | mixed | unknown
  rawText           String   // originale, jamais traduite
  provider          String
  model             String
  promptVersion     String?
  speakerData       Json?    // null au MVP
  createdAt         DateTime @default(now())

  visit             Visit    @relation(fields: [visitId], references: [id], onDelete: Restrict)
}

model ClinicalExtraction {
  id            String   @id @default(cuid())
  visitId       String   @unique
  schemaVersion String
  promptVersion String
  provider      String
  model         String
  payload       Json     // faits + preuves + temporalité, validé par Zod avant insert
  createdAt     DateTime @default(now())

  visit         Visit    @relation(fields: [visitId], references: [id], onDelete: Restrict)
}

model ClinicalReport {
  id             String       @id @default(cuid())
  visitId        String       @unique
  status         ReportStatus @default(DRAFT)
  templateKey    String
  promptVersion  String?
  provider       String?
  model          String?
  aiDraft        String?
  editedDraft    String?
  finalText      String?
  validatedAt    DateTime?
  validatedById  String?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  visit          Visit        @relation(fields: [visitId], references: [id], onDelete: Restrict)
  validatedBy    User?        @relation("ValidatedBy", fields: [validatedById], references: [id])

  @@index([status])
}

model Medication {
  id          String    @id @default(cuid())
  patientId   String
  name        String
  dose        String?
  frequency   String?
  route       String?
  startedAt   DateTime? @db.Date
  active      Boolean   @default(true)
  note        String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  patient     Patient   @relation(fields: [patientId], references: [id], onDelete: Restrict)

  @@index([patientId, active])
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  action     String
  entityType String
  entityId   String?
  patientId  String?
  visitId    String?
  metadata   Json?    // ids, codes, transitions. Jamais de texte clinique.
  createdAt  DateTime @default(now())

  actor      User?    @relation(fields: [actorId], references: [id], onDelete: SetNull)
  patient    Patient? @relation(fields: [patientId], references: [id], onDelete: SetNull)
  visit      Visit?   @relation(fields: [visitId], references: [id], onDelete: SetNull)

  @@index([createdAt])
  @@index([patientId, createdAt])
  @@index([visitId, createdAt])
  @@index([actorId, createdAt])
}
```

`MedicationHistory` du spec n’est pas créée au MVP : il n’y a pas d’édition. Quand le module traitements arrivera, chaque changement créera une ligne d’historique **avant** d’écrire la nouvelle valeur. Rien ne sera écrasé en silence. Créer la table maintenant, vide et sans écriture, n’apporte rien.

Pas de table `Alert`. Pas de table `PatientSummary` séparée : `Patient.currentSummary` suffit tant que la mise à jour est manuelle. Une table versionnée n’a d’intérêt que lorsque l’IA proposera une mise à jour (V2), et encore, seulement après confirmation humaine.

### Forme du JSON d’extraction

Chaque fait important a la même enveloppe. C’est elle qui empêche de confondre « absent », « nié » et « non évalué ».

```ts
type Assertion =
  | "present"
  | "explicitly_denied"
  | "not_assessed"
  | "not_reported"
  | "uncertain";

type Temporality = "current_visit" | "historical" | "unknown";
type SourceKind = "transcript" | "patient_record" | "previous_validated_visit";

type ClinicalFact = {
  value: string | null;
  assertion: Assertion;
  temporality: Temporality;
  source: SourceKind;
  evidence: { quote: string } | null;
  confidence: "high" | "medium" | "low";
};
```

Domaines du payload : `mood`, `affect`, `anxiety`, `sleep`, `appetite`, `activity`, `functioning`, `work`, `family`, `isolation`, `speech`, `thought`, `thoughtContent`, `delusions`, `hallucinations`, `psychosis`, `agitation`, `retardation`, `impulsivity`, `behavior`, `insight`, `judgment`, `adherence`, `sideEffects`, `substanceUse`, `suicidality`, `aggression`, `dangerousness`, `protectiveFactors`, `medicationMentions`, `changes`, `uncertainInformation`.

`suicidality` (et de la même façon psychose, hétéro-agressivité, substances, effets secondaires) ne peut pas être un booléen. `explicitly_denied` n’est légal que si `evidence.quote` est une phrase réellement présente dans la transcription.

---

## 6. Pages et routes

UI en français par défaut. Transmission toujours en `dir="rtl"`.

| Route | Rôle | Actions |
| --- | --- | --- |
| `/login` | Connexion | email + mot de passe |
| `/` | Dashboard | patients actifs, visites du jour, transmissions à valider, dernières visites, recherche |
| `/patients` | Liste | recherche nom / prénom / ville / téléphone, filtre actif |
| `/patients/new` | Création | fiche minimale |
| `/patients/[patientId]` | Fiche | identité, résumé manuel, traitements en lecture seule, dernière visite, timeline |
| `/patients/[patientId]/edit` | Édition administrative et clinique | pas d’IA |
| `/patients/[patientId]/visits/new` | Nouvelle visite | type, date/heure préremplies et modifiables |
| `/patients/[patientId]/visits/[visitId]` | Après entretien | onglets Transcription / Analyse / Transmission, sans perdre le texte |

Pas de page planning, carte, statistiques, audit UI, ni réglages avancés. La copie et la validation vivent sur la page visite, pas sur un écran séparé.

Navigation mobile : barre basse `Accueil` / `Patients`. Sur la fiche, un bouton principal fixe : `Importer un audio`.

### Dashboard, version stricte

- patients actifs (compteur + accès liste) ;
- visites dont `occurredAt` est aujourd’hui ;
- transmissions `AI_GENERATED` ou `REVIEWED` ;
- 5 dernières visites ;
- recherche instantanée sur nom, prénom, ville, téléphone.

Pas d’alerte clinique sur le dashboard.

---

## 7. Composants principaux

Peu de composants. Chacun a un seul rôle.

| Composant | Rôle |
| --- | --- |
| `AppShell` | cadre, session, langue, `dir` |
| `BottomNav` | 2 destinations, grandes cibles |
| `DashboardStats` | 3 compteurs cliquables |
| `PatientSearch` | champ unique, résultats immédiats |
| `PatientHeader` | nom, ville, statut |
| `PatientForm` | création / édition |
| `SummaryCard` | résumé manuel, lecture + lien édition |
| `MedicationList` | lecture seule |
| `Timeline` | date, type, statut de transmission |
| `VisitTypePicker` | 7 types, date/heure éditables |
| `AudioUploader` | import, durée/taille, case de conservation consciente |
| `PipelineProgress` | Upload, Transcription, Analyse, Transmission, erreur compréhensible, réessayer |
| `TranscriptView` | texte original, non traduit, non éditable au MVP |
| `ExtractionReview` | faits avec badge actuel / historique / incertain / non évalué, extrait source |
| `ReviewFlags` | « à vérifier », calculé, pas un diagnostic |
| `ReportEditor` | texte hébreu RTL, blocs, autosave serveur |
| `ReportToolbar` | Régénérer, Raccourcir, Plus clinique, Corriger l’hébreu, Copier, Valider |
| `StatusBadge` | statut de transmission |
| `ConfirmDialog` | régénération qui écrase, copie non validée, suppression d’audio |

Pas de design system générique à installer. Typographie claire, cartes, espacement large, contraste lisible dehors.

---

## 8. API

Toutes les routes ci-dessous exigent une session, sauf la connexion. Aucune ne renvoie une erreur brute du fournisseur. Chaque mutation écrit un `AuditLog` **sans** coller le contenu clinique dans `metadata`.

| Méthode | Route | Effet |
| --- | --- | --- |
| `*` | `/api/auth/[...nextauth]` | session |
| `GET` | `/api/patients?q=` | recherche bornée |
| `POST` | `/api/patients` | création |
| `GET` | `/api/patients/:id` | fiche + timeline |
| `PATCH` | `/api/patients/:id` | mise à jour manuelle, y compris le résumé |
| `POST` | `/api/visits` | crée la visite et une transmission `DRAFT` vide |
| `GET` | `/api/visits/:id` | visite + statuts, sans renvoyer l’URL brute du fichier |
| `PATCH` | `/api/visits/:id` | type, date, notes |
| `POST` | `/api/visits/:id/audio` | upload, contrôles, stockage privé |
| `DELETE` | `/api/recordings/:id` | suppression du fichier, la transcription et la transmission restent |
| `POST` | `/api/visits/:id/pipeline` | lance la suite à partir de la première étape manquante |
| `GET` | `/api/visits/:id/pipeline` | statut pour le polling |
| `PATCH` | `/api/visits/:id/report` | sauve `editedDraft`, passe à `REVIEWED` si le texte diffère du brouillon IA |
| `POST` | `/api/visits/:id/report/actions` | `regenerate` \| `shorten` \| `more_clinical` \| `correct_hebrew` |
| `POST` | `/api/visits/:id/report/validate` | fige `finalText` |

La copie est faite dans le navigateur à partir du texte déjà chargé (`editedDraft`, ou `finalText` si validé). Elle ne copie jamais la transcription. Un `POST` léger écrit seulement l’événement d’audit `REPORT_COPIED`.

Pas d’URL signée longue durée exposée à l’UI. La lecture éventuelle du fichier passe par une route authentifiée qui streame après contrôle d’accès. Au MVP, la lecture audio n’est pas un écran : le fichier est une archive, pas un lecteur.

Les pages serveur lisent Prisma directement. Les mutations passent par les Route Handlers, pour avoir un seul endroit d’audit et de test.

---

## 9. Pipeline

Deux appels modèle par transmission réussie, plus la transcription. Les étapes A–F du spec sont conservées, mais fusionnées quand un appel supplémentaire n’apporte que du coût et du risque.

```
audio reçu
  → contrôles (déterministe)
  → transcription originale (modèle audio, 1 appel)
  → contexte SQL (déterministe)
  → extraction JSON (LLM, 1 appel)          # étapes A + B
  → validateurs (déterministe)              # refuse l’invention
  → diff dernière visite validée (déterministe) # étapes D + E
  → drapeaux « à vérifier » (déterministe)
  → transmission hébreu (LLM, 1 appel)      # étape F
  → relecture humaine → validation → copie
```

### Étape 0 — Upload

Déclencheur : l’utilisateur importe un fichier sur une visite déjà créée.

Contrôles, tous en code :

- extension et type MIME dans `m4a`, `mp3`, `wav`, `aac` ;
- taille max (25 Mo après éventuelle transcodification, limite courante de l’API de transcription) ;
- nom stocké = UUID, jamais le nom du fichier original comme clé ;
- case explicite : l’utilisateur confirme que l’enregistrement est couvert par la politique du service. Sans cette case, pas d’upload. La formulation juridique exacte reste à valider avant production ;
- échec d’upload : rien n’est marqué transcrit. Message : l’envoi n’a pas abouti, réessayer.

Si le fichier dépasse la limite du modèle audio, transcodage mono basse débit (ffmpeg, déterministe) **avant** l’envoi au modèle. L’original reste stocké selon la politique de rétention. Pas de résumé audio par un LLM pour « faire rentrer » le fichier.

### Étape 1 — Transcription

- fournisseur audio, pas un chat qui « écoute » un résumé ;
- consigne : ne pas traduire, ne pas corriger le sens, ne pas remplir les blancs ;
- hébreu, français, anglais, mélange, russe si le modèle le renvoie ;
- résultat écrit dans `Transcript.rawText` avant toute analyse ;
- `pipelineStatus = TRANSCRIBED` ;
- si la politique est `DELETE_AFTER_TRANSCRIPTION`, le fichier est supprimé **seulement après** persistance réussie de la transcription, avec audit `AUDIO_DELETED` ;
- échec : audio conservé, `FAILED`, message « La transcription n’a pas pu être terminée. Votre enregistrement est conservé. Réessayer. »

### Étape 2 — Contexte patient pertinent

`context.ts` construit un paquet **borné**. Il n’envoie jamais le dossier entier.

Inclus :

- identité courte (nom, âge calculé, ville) ;
- diagnostic principal tel qu’enregistré, étiqueté `patient_record` / historique ;
- traitements **actifs en base**, étiquetés source dossier, pas « dit aujourd’hui » ;
- `currentSummary` s’il existe, étiqueté historique ;
- les **2 dernières transmissions `VALIDATED`**, tronquées (environ 800 caractères chacune), ou à défaut leur extraction JSON — jamais un brouillon IA non validé ;
- facteurs de risque / protecteurs du dossier, étiquetés historique.

Exclu : autres patients, audio, transcriptions intégrales anciennes, brouillons `AI_GENERATED` / `REVIEWED`, notes non validées.

C’est l’étape C. Elle est du SQL, pas du RAG.

### Étape 3 — Extraction

Un seul appel LLM, sortie JSON conforme au schéma Zod (`prompts/clinical-extraction.ts`).

Consignes non négociables, répétées dans le prompt et **réappliquées en code** ensuite :

- n’extraire un fait `current_visit` que s’il est dans la transcription de cette visite ;
- le contexte historique est en lecture seule. Il sert à reconnaître un changement, pas à remplir les blancs ;
- information absente → `not_assessed` ou `not_reported`, jamais `explicitly_denied`, jamais une valeur inventée ;
- dosage, nom de médicament, rendez-vous, résultat biologique : si le texte n’est pas clair, `uncertain` + `confidence: low`, valeur numérique vide ;
- chaque `present` et chaque `explicitly_denied` doit citer un extrait court de la transcription ;
- température basse. Pas de modèle « raisonnement » long : plus cher, et la traçabilité du JSON suffit.

### Étape 4 — Validation déterministe

`validators.ts` s’exécute après le modèle, avant d’écrire l’extraction. Le modèle ne peut pas se valider lui-même.

1. JSON invalide → échec d’étape, transcription conservée, pas de transmission.
2. `present` ou `explicitly_denied` sans `evidence.quote` → le fait passe en `uncertain`, drapeau « à vérifier ».
3. L’extrait doit être retrouvé dans `rawText` (normalisation espaces / ponctuation, pas de recherche floue permissive). Sinon même rétrogradation.
4. `source` dossier ou visite précédente ⇒ `temporality` forcée à `historical`. Un fait historique ne peut pas rester `current_visit`.
5. Un médicament ou un dosage `confidence != high` n’a pas de chiffre recopiable.
6. `not_assessed` et `not_reported` sont conservés tels quels. Le code ne les convertit jamais en absence clinique.

### Étape 5 — Changements

`diff.ts` compare l’extraction validée à l’extraction de la dernière visite **validée** uniquement.

Un changement n’est retenu que si les deux côtés existent comme faits structurés, ou si la transcription actuelle contient un extrait qui le soutient. Les `changes` proposés par le modèle et non recoupés sont jetés. Pas d’écran de comparaison.

### Étape 6 — « À vérifier »

Règles, pas un second modèle. Exemples :

- mention possible d’idées suicidaires (`suicidality.assertion == present`) ;
- suicidalité `uncertain` ;
- dosage incertain ;
- médicament cité dans l’entretien et absent de `Medication` actif, ou l’inverse ;
- contradiction explicite entre un fait actuel et un fait historique ;
- tout fait rétrogradé par le validateur.

Formulation destinée au professionnel (« à vérifier »), jamais un diagnostic, jamais une conduite à tenir inventée.

### Étape 7 — Transmission hébreu

Un appel LLM. Entrée : extraction **déjà validée**, diff, métadonnées de visite (type, date, heure), gabarit. La transcription brute n’est pas la source de rédaction : elle a déjà servi à l’extraction. La repasser en entier réouvre la porte à l’invention.

`templates.ts` choisit le gabarit selon `VisitType` :

- `IN_PERSON` → visite frontale (§17) ;
- `VIRTUAL` et `PHONE` → gabarit visite virtuelle / appel ;
- `ADMISSION` → gabarit admission ;
- `ASSESSMENT`, `FAMILY_CONTACT`, `OTHER` → gabarit court générique (contexte, état rapporté, risque, intervention, plan). Pas trois prompts de plus.

Règles de rédaction :

- hébreu clinique, blocs, titre en gras, pas de ligne vide dans un bloc, une séparation entre blocs ;
- une section sans fait actuel est omise, ou porte « לא הוערך במפגש זה » si le gabarit exige le bloc risque. Jamais une négation par défaut ;
- un fait `historical` ne peut apparaître que dans un bloc explicitement historique (antécédents, traitement enregistré), jamais dans l’état mental du jour ;
- un fait `uncertain` apparaît comme point à vérifier, pas comme une mesure ;
- température basse ;
- `aiDraft` et `editedDraft` reçoivent le même texte. `finalText` reste null. Statut → `AI_GENERATED`.

### Étape 8 — Actions de réécriture

Déclenchées par l’utilisateur, jamais en cascade.

- Régénérer : relance l’étape 7 depuis l’extraction déjà stockée (pas une nouvelle transcription). Si `editedDraft` a été modifié, confirmation avant écrasement.
- Raccourcir, plus clinique, corriger l’hébreu : un appel, même gabarit, consigne courte. Interdiction d’ajouter un fait absent de l’extraction. Le validateur de phrases interdites repasse sur le résultat.
- Échec : l’ancien `editedDraft` est conservé.

### Étape 9 — Validation et copie

Voir section 11. La copie n’envoie rien à un serveur tiers. Elle met le texte dans le presse-papiers du téléphone.

### Reprise

Relancer le pipeline reprend à la première étape absente : audio sans transcript → transcrire ; transcript sans extraction → extraire ; extraction sans `aiDraft` → rédiger. Aucune étape réussie n’est refaite implicitement (coût, et risque de changer un texte déjà relu).

---

## 10. Ancien ≠ actuel

Le problème n’est pas seulement le prompt. Un prompt qui « demande de ne pas inventer » ne suffit pas. La séparation est un contrat de données, vérifié hors du modèle.

1. **Trois temporalités, pas une.** `current_visit`, `historical`, `unknown`. Une information du dossier naît `historical`. Seule la transcription du jour peut produire `current_visit`.
2. **Trois absences, pas un faux.** `not_assessed` (le sujet n’a pas été abordé), `not_reported` (abordé sans donnée exploitable), `explicitly_denied` (le patient ou l’interlocuteur l’a nié, avec extrait). L’UI et le texte hébreu ont une phrase distincte pour chaque cas. `false` n’existe pas.
3. **La source est obligatoire.** Transcription, dossier, ou visite validée précédente. Le validateur force `historical` dès que la source n’est pas la transcription du jour.
4. **Pas de mémoire de modèle.** Chaque appel reçoit un paquet reconstruit. Rien n’est laissé dans un fil de conversation.
5. **Le dossier ne comble pas les trous.** Si le résumé dit « idées suicidaires il y a trois mois » et que l’entretien du jour n’en parle pas, l’extraction du jour est `not_assessed`. Le passé peut être rappelé uniquement dans un bloc historique, avec sa date, jamais comme constat du jour.
6. **Les brouillons ne sont pas du contexte.** Seules les transmissions `VALIDATED` et les champs saisis par le professionnel nourrissent la visite suivante. Un texte IA non validé ne « devient » pas l’histoire du patient.
7. **Le résumé n’est pas régénéré.** `currentSummary` reste ce que l’infirmier a écrit. Cela coupe la voie la plus fréquente par laquelle une ancienne formulation revient comme un état actuel.
8. **Liste de phrases interdites.** Après génération, `forbidden-phrases.ts` refuse notamment une formulation du type « nie les idées suicidaires » / `שולל מחשבות אובדניות` si `suicidality.assertion !== explicitly_denied`. Même contrôle pour psychose, hétéro-agressivité, substances, effets secondaires. En cas de refus, la section est remplacée par la formule « non évalué », et un drapeau est posé. Le texte n’est pas renvoyé au modèle en boucle.
9. **Contradiction.** Si le jour dit le contraire du dossier, le fait actuel (avec extrait) prime, et un drapeau « contradiction avec le dossier » est affiché. L’ancien fait n’est pas effacé.
10. **Médicament.** La liste active en base est la référence. L’entretien peut signaler une prise rapportée. Il ne crée pas une ligne de traitement et ne change pas une dose.

---

## 11. Statuts de transmission

Machine à états fermée. Toute autre transition est refusée.

```
création visite
    → DRAFT
        aiDraft null, editedDraft null, finalText null

pipeline de rédaction réussi
    → AI_GENERATED
        aiDraft = editedDraft = texte, finalText null

sauvegarde d’un texte différent de aiDraft
    → REVIEWED
        aiDraft inchangé, editedDraft mis à jour

clic explicite VALIDER (depuis AI_GENERATED ou REVIEWED, texte non vide)
    → VALIDATED
        finalText = editedDraft (copie figée)
        validatedAt, validatedById
```

Règles :

- l’IA ne peut jamais écrire `VALIDATED` ni `REVIEWED` ;
- ouvrir l’éditeur sans modifier ne change pas le statut ;
- `VALIDATED` est terminal au MVP. Pas de réouverture silencieuse. Une correction ultérieure sera une nouvelle version, pas un écrasement. Hors MVP, donc un texte validé est en lecture seule ;
- Régénérer depuis `AI_GENERATED` remplace `aiDraft` et `editedDraft`, le statut reste `AI_GENERATED` ;
- Régénérer depuis `REVIEWED` demande confirmation, car cela jette les corrections humaines. Après confirmation, retour à `AI_GENERATED` ;
- Raccourcir / plus clinique / corriger l’hébreu modifient `editedDraft` et posent `REVIEWED` (une main humaine a demandé la transformation, le texte n’est plus le brouillon brut) ;
- Copier depuis `AI_GENERATED` ou `REVIEWED` est possible pour ne pas bloquer le téléphone, avec confirmation : « Cette transmission n’est pas validée. » Copier depuis `VALIDATED` est direct. Dans les deux cas, seul le texte de transmission est copié ;
- Valider exige un texte non vide. La validation écrit l’audit `REPORT_VALIDATED`.

`pipelineStatus` est indépendant : une visite peut être `READY` avec une transmission encore `AI_GENERATED`. L’échec pipeline (`FAILED`) ne modifie pas un statut de transmission déjà atteint.

---

## 12. Stockage audio

Interface unique :

```ts
interface StorageService {
  put(key: string, body: Buffer, mimeType: string): Promise<void>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}
```

`STORAGE_DRIVER=local|s3`. Le reste du code ne connaît pas le disque.

Dev : répertoire hors de `public/`, ignoré par git, minio possible via Docker. Prod : bucket privé, chiffrement au repos (SSE), pas de liste publique, pas d’ACL public.

Clé : `audio/{recordingId}` . UUID. Pas de nom, pas de date de naissance, pas d’identifiant parlant.

Upload :

- taille et MIME imposés côté serveur ;
- le navigateur envoie le fichier à notre route, authentifiée. Pas d’URL pré-signée au MVP : un seul clinicien, des fichiers de parole compressés, moins de surface. Si l’upload iPhone se révèle trop fragile, une URL pré-signée de 5 minutes, type et taille fixés, pourra être ajoutée sans changer le métier ;
- après écriture, ligne `AudioRecording` puis audit `AUDIO_UPLOADED` (taille, type, id — pas le contenu).

Rétention, champ par enregistrement, défaut `KEEP` en développement :

- `KEEP` — conservé ;
- `DELETE_AFTER_TRANSCRIPTION` — objet supprimé après transcription persistée ;
- `EXPIRE_AT` — `expiresAt` renseigné, une tâche quotidienne supprime les objets échus.

La politique réelle (durée, base légale, consentement) doit être décidée avant production. Le MVP ne suppose pas une conservation illimitée : les trois modes existent, le défaut de production reste **non choisi**.

Suppression : objet détruit, `status = DELETED`, `deletedAt`, clé conservée pour l’audit. Transcription et transmission ne sont pas supprimées avec le fichier, sauf action explicite future hors MVP.

Jamais : audio dans les logs, dans les analytics, dans un ticket, dans un prompt de documentation d’erreur.

---

## 13. Authentification et autorisation

MVP, un utilisateur seedé. Développement : compte de démo, mot de passe dans `.env` local, jamais commité.

Authentification :

- Auth.js v5, fournisseur Credentials, mot de passe Argon2id ;
- session en base, pas en JWT, pour pouvoir révoquer ;
- cookie `httpOnly`, `Secure` en production, `SameSite=Lax` ;
- durée : 8 heures, sans renouvellement silencieux au-delà. Un outil clinique sur un téléphone trouvé ne doit pas rester ouvert des semaines ;
- verrouillage simple après 5 échecs (attente croissante). Suffisant pour un seul compte, sans usine à gaz ;
- avant toute donnée réelle : second facteur (TOTP ou passkey / Face ID). Pas un prérequis de la démo fictive, **bloquant pour la production**. Le schéma n’a pas besoin de changer pour l’ajouter : c’est un second facteur au login, pas un nouveau modèle métier.

Autorisation :

- middleware : pas de session → `/login` ;
- le déploiement est mono-clinicien : tout utilisateur authentifié de cette instance voit les patients de cette instance ;
- pas de RBAC, pas d’organisation, pas de RLS Postgres au MVP ;
- `User.role` existe pour ne pas bloquer un second accès plus tard. Aujourd’hui `NURSE` et `ADMIN` ont les mêmes droits. **Avant d’ajouter un deuxième compte, les règles d’accès doivent être définies.** Ce n’est pas un trou pour la démo à un utilisateur ;
- chaque handler vérifie la session lui-même, en plus du middleware.

Ce qui n’est pas fait, volontairement : OAuth Google/Apple (inutile, et un fournisseur de plus voit l’email), magic link (boîte mail = copie des liens de session), compte partagé sans identity (l’audit a besoin d’un `actorId`).

---

## 14. Risques sécurité et confidentialité

Risques réels de ce produit, pas une liste générique.

| Risque | Gravité | Parade MVP | Reste ouvert |
| --- | --- | --- | --- |
| Clé OpenAI dans le client | Critique | SDK uniquement serveur, revue de `NEXT_PUBLIC_`, `.env` hors git | — |
| PHI dans les logs, erreurs, tickets | Critique | logger qui redact, messages utilisateur génériques, pas de transcript dans `AuditLog.metadata` ni dans `failureCode` | Discipline à tenir à chaque feature |
| IDOR / visite d’un autre patient | Haute | tout accès exige une session ; instance mono-utilisateur | Vrai multi-utilisateur = autre chantier, avant le 2e compte |
| Audio public ou URL signée trop longue | Haute | bucket privé, pas d’URL signée, stream authentifié si lecture | — |
| Sous-traitant IA entraîne sur les entretiens | Haute | compte zéro rétention + DPA **avant** données réelles. Dev = fixtures | Décision juridique encore à prendre |
| Hallucination recopiée dans le dossier | Haute | extraction prouvée, validateurs, validation humaine, copie avertie si non validée | Le professionnel peut quand même valider trop vite. L’UI doit montrer les drapeaux avant le bouton Valider |
| Ancien fait réécrit comme état du jour | Haute | temporalité + source + phrases interdites | — |
| Téléphone perdu, session longue | Haute | session 8 h, cookie sécurisé | 2FA avant production |
| Brouillon dans `localStorage` | Haute | autosave serveur uniquement | Travail perdu si coupure avant le premier save. Accepté. |
| Fuite par MCP, analytics, Sentry, Suivi | Haute | aucun de ces outils sur des routes cliniques. Voir section 16 | — |
| Injection de prompt via la transcription | Moyenne | le transcript est une donnée, pas une consigne. Le schéma JSON et les validateurs limitent l’effet. La sortie est contrainte | Un patient peut dicter « ignore les règles ». Les validateurs restent la barrière, pas le prompt |
| Fichier déguisé (MIME client menteur) | Moyenne | contrôle serveur extension + taille. Pas d’exécution du fichier | — |
| Sauvegarde et restauration | Haute en prod | volume chiffré, sauvegardes prévues au déploiement | Procédure non écrite : hors code, avant production |
| Environnement dev = prod | Haute | `.env` distincts, seed fictif, interdiction documentée de copier une base réelle | — |
| Dépendance à OpenAI (disponibilité, prix, transfert hors Israël) | Moyenne produit / haute juridique | interface `AIService`, fournisseur factice | Choix d’hébergement et base légale du transfert |

Pas d’analytics. Pas de rapport d’erreur cloud tant qu’il peut contenir une requête. Les erreurs 500 côté client disent ce qui est conservé et quoi réessayer, jamais `ERROR 500`.

L’application est une aide à la documentation. Aucun libellé ne doit dire qu’une évaluation a eu lieu si elle n’a pas eu lieu.

---

## 15. AuditLog

Append-only. Une fonction `audit()` est le seul chemin d’écriture. Pas d’écran d’audit au MVP : la table existe, elle se consulte en SQL sur la base de dev. Un écran viendra s’il y a un besoin réel.

Événements :

`LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`,  
`PATIENT_CREATED`, `PATIENT_VIEWED`, `PATIENT_UPDATED`,  
`VISIT_CREATED`, `VISIT_UPDATED`,  
`AUDIO_UPLOADED`, `AUDIO_DELETED`,  
`TRANSCRIBE_STARTED`, `TRANSCRIBE_SUCCEEDED`, `TRANSCRIBE_FAILED`,  
`EXTRACT_SUCCEEDED`, `EXTRACT_FAILED`,  
`REPORT_GENERATED`, `REPORT_EDITED`, `REPORT_ACTION`, `REPORT_VALIDATED`, `REPORT_COPIED`.

`metadata` autorisé : ids, ancien statut → nouveau statut, type de visite, taille de fichier, code d’erreur stable, nom d’action (`shorten`, etc.), versions de prompt et de modèle.

`metadata` interdit : transcription, extrait, transmission, nom de médicament, dosage, résumé, adresse, téléphone, contenu d’erreur fournisseur.

`PATIENT_VIEWED` est écrit à l’ouverture de la fiche (accès au dossier), pas à chaque frappe. `REPORT_EDITED` à la sauvegarde, pas par caractère.

Rétention des logs : à caler sur l’obligation du service avant production. Le code ne propose pas de suppression.

---

## 16. Autres modèles, sans réécrire l’application

Le métier dépend de contrats, pas d’OpenAI.

```ts
interface TranscriptionProvider {
  transcribe(input: {
    audio: Buffer;
    mimeType: string;
  }): Promise<{ text: string; detectedLanguage: string | null; model: string }>;
}

interface ClinicalLanguageProvider {
  extract(input: ExtractionInput): Promise<unknown>;
  generateReport(input: ReportInput): Promise<string>;
  rewrite(input: RewriteInput): Promise<string>;
}
```

`factory.ts` lit `AI_PROVIDER=openai|fake` et les noms de modèles (`AI_TRANSCRIBE_MODEL`, `AI_CLINICAL_MODEL`). Ajouter un fournisseur = un fichier qui implémente ces deux interfaces, plus une branche dans la factory. Les prompts, le schéma Zod, les validateurs, les gabarits et les statuts ne bougent pas.

Chaque extraction et chaque transmission stockent `provider`, `model`, `promptVersion`. On sait quel couple a produit quel texte.

Le fournisseur `fake` est obligatoire dès la phase transcription : la démo et les tests ne doivent pas dépendre du réseau ni d’une clé.

Ce qui ne change pas quand le modèle change : sélection du contexte, validation des preuves, diff, drapeaux, machine à états, gabarits, audit.

Ce qui devra être retesté, sur fixtures, à chaque changement de modèle : qualité de l’hébreu parlé mixte, respect du JSON, respect des négations. Un nouveau modèle n’est pas activé parce qu’il est plus récent.

---

## 17. LLM ou déterministe

Le coût se maîtrise en **supprimant des appels**, pas en prenant un petit modèle pour les faits cliniques. Un modèle faible sur la suicidalité est plus cher, au sens du risque, qu’un appel de plus.

| Opération | Moteur | Appel payant |
| --- | --- | --- |
| Contrôle fichier, rétention, clés | code | non |
| Transcription | modèle audio | 1 par audio, jamais relancé automatiquement |
| Choix du contexte | SQL + troncature | non |
| Choix du gabarit | code selon `VisitType` | non |
| Extraction des faits | LLM, modèle clinique fort, JSON strict | 1 |
| Preuve dans le transcript, temporalité, phrases interdites | code | non |
| Diff avec la dernière visite validée | code | non |
| Liste « à vérifier » | code | non |
| Rédaction hébreu | LLM, même modèle clinique | 1 |
| Mise à jour du résumé | **personne** au MVP | 0 |
| Identification des locuteurs | **non fait** | 0 |
| Recherche patients | SQL `ILIKE` | non |
| Âge, statuts, timeline | code | non |
| Raccourcir / plus clinique / corriger l’hébreu / régénérer | LLM | seulement si l’utilisateur clique |

Cible : **1 transcription + 2 appels LLM** pour une transmission. Pas de RAG, pas d’embeddings, pas de file de raisonnement, pas de second passage « vérifie ton travail » (les validateurs le font mieux, et gratuitement).

Ordres de grandeur, à recalibrer sur une facture réelle, pour un entretien de 30 minutes et un contexte court : transcription de l’ordre de 0,10–0,30 €, extraction + rédaction de l’ordre de quelques centimes à ~0,15 € si le contexte reste borné. L’objectif interne est de rester **sous environ 0,50 € par visite** hors clics de réécriture. Si une visite dépasse ce budget, on réduit le contexte, on ne change pas pour un modèle plus bavard.

Modèles : noms dans l’environnement, pas dans le code. Transcription : un modèle audio multilingue correct en hébreu, choisi après écoute de fixtures (pas au hasard du jour). Clinique : un modèle avec sortie JSON stricte et bon hébreu écrit. Température basse (0–0,2). Le choix exact est une décision de la phase transcription / extraction, documentée dans `.env.example`, pas dans ce plan.

---

## 18. MCP utiles — développement seulement

Les MCP aident **Cursor pendant le développement**. Ils ne font pas partie de l’application, et ils ne doivent jamais voir un patient réel, une transcription, un audio, ni la base de production.

Déjà présent dans cet environnement : **Suivi** (`user-suivi`). Il instrumente des parcours et peut capturer des payloads. Ne pas le brancher sur les routes patients, visites, audio, transcription ou transmission. S’il est utilisé, uniquement sur un parcours non clinique (login de la démo), en local, non versionné. Pas en production.

Recommandés, célèbres, réellement utilisés :

| Serveur | Dépôt | Ordre de grandeur | Usage ici | Limite |
| --- | --- | --- | --- | --- |
| Context7 | [upstash/context7](https://github.com/upstash/context7) | ~62 k étoiles, le plus utilisé | Docs à jour Next.js, Prisma, Tailwind, Auth.js. Réduit les API inventées. | Aucune donnée patient. Outil de doc. |
| GitHub MCP | [github/github-mcp-server](https://github.com/github/github-mcp-server) | ~33 k étoiles, éditeur officiel | Issues, PR, quand le dépôt sera sur GitHub. | Le dépôt ne doit contenir ni `.env`, ni audio, ni fixture ressemblant à un vrai dossier. |
| Playwright MCP | [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | ~37 k étoiles, très téléchargé | Vérifier le parcours iPhone (viewport, RTL, boutons) sur données fictives. | Uniquement contre l’app locale seedée. |
| Postgres MCP | [crystaldba/postgres-mcp](https://github.com/crystaldba/postgres-mcp) | ~3,3 k étoiles, le Postgres MCP le plus cité | Inspecter le schéma et des requêtes **en lecture** sur la base **locale fictive**. | Rôle SQL read-only. Jamais l’URL de production. Jamais un compte qui peut `UPDATE`. |
| Navigateur Cursor | déjà disponible | — | Contrôle visuel du mobile. | Même règle : données fictives. |

Référence officielle, à connaître mais pas à installer en bloc : [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) (~90 k étoiles). Le serveur Postgres de cette archive est en lecture seule : acceptable en local, moins utile que `crystaldba/postgres-mcp` une fois Prisma en place. Le serveur GitHub de cette archive est remplacé par celui de GitHub.

À ne pas brancher :

- le MCP distant Prisma (`https://mcp.prisma.io`, [prisma/mcp](https://github.com/prisma/mcp)) s’il passe par Prisma Postgres cloud. La base clinique ne part pas chez un éditeur pour qu’un agent la requête ;
- Sentry, Slack, Google Drive, analytics : surface de fuite de PHI, inutile au MVP ;
- [chukaofili/next-mcp](https://github.com/chukaofili/next-mcp) : générateur de squelette, peu établi, et il choisirait l’architecture à notre place ;
- tout MCP « base de données universelle » pointé sur autre chose que le Postgres local de fixtures.

Décision : ne rien installer maintenant. Context7 et, au moment des tests UI, Playwright, suffisent. Postgres MCP seulement après le seed fictif, en lecture seule, si le schéma devient difficile à raisonner sans requête. Ce n’est pas une dépendance du produit.

---

## 19. Phases

Chaque phase se termine par un test manuel sur données fictives, décrit ici. On ne démarre pas la suivante si le critère n’est pas vrai. Aucune phase n’ajoute de V2.

### Phase 0 — ce document

Critère : plan validé. On s’arrête ici.

### Phase 1 — socle

Next.js, TypeScript, Tailwind, Prisma, Postgres via Docker, `.env.example`, `.gitignore` (audio, `.env`, `.suivi`), logger redact, `dir` RTL branché, shell mobile vide.

Critère : `npm run dev` affiche une page, `prisma migrate` passe, un secret n’est pas dans le client.

### Phase 2 — session

Login, seed d’un utilisateur, session 8 h, déconnexion, audit login succès / échec, routes app inaccessibles sans session.

Critère : sans cookie, `/` renvoie au login. Un mot de passe faux n’écrit pas le mot de passe dans les logs.

### Phase 3 — patients fictifs

CRUD fiche (champs du §5, hors module traitements), recherche nom / prénom / ville / téléphone, seed de 5 patients fictifs, résumé manuel.

Critère : les 5 fiches s’ouvrent sur un viewport iPhone, la recherche téléphone répond, aucune donnée réelle.

### Phase 4 — visites et timeline

Création visite (7 types, date/heure modifiables), timeline, transmission `DRAFT` vide créée avec la visite.

Critère : une visite apparaît dans l’ordre chronologique, le dashboard compte les visites du jour et les brouillons n’apparaissant pas comme « à valider » tant qu’il n’y a pas de texte IA.

### Phase 5 — audio

Import, contrôles, stockage privé, rétention enregistrée, suppression du fichier, audit. Pas encore d’IA.

Critère : un `.m4a` fictif est stocké hors de `public/`. Un échec simulé ne le marque pas transcrit. Le fichier n’a pas une URL publique.

### Phase 6 — transcription

`AIService` + fournisseur fake + OpenAI derrière la factory. Statuts pipeline, écran de progression, texte original conservé non traduit. Relance sans perdre le fichier.

Critère : avec `AI_PROVIDER=fake`, un fixture hébreu/français devient une transcription persistée. Couper le fake en erreur laisse l’audio et un message compréhensible.

### Phase 7 — extraction et barrières

Schéma Zod, prompt d’extraction, validateurs, phrases interdites, badges actuel / historique / non évalué / incertain, drapeaux « à vérifier ». Tests unitaires sur les cas du §13, y compris l’exemple dangereux du §16.

Critère : un fixture où le suicide n’est pas abordé ne produit pas une négation. Un fixture où le patient nie explicitement produit `explicitly_denied` avec extrait. Un dosage flou n’a pas de chiffre. Un fait dont l’extrait n’est pas dans le texte est rétrogradé.

### Phase 8 — transmission, édition, validation, copie

Contexte SQL borné, gabarits, rédaction hébreu, éditeur, autosave, statuts, boutons du §18, copie du texte seul, confirmation si non validé, texte validé figé.

Critère du premier livrable (§48) : login → patient fictif → visite → upload → transcription → transmission hébreu en blocs → correction → validation → copie. Les trois versions `aiDraft` / `editedDraft` / `finalText` sont distinctes après édition puis validation. Un fait historique n’apparaît pas comme constat du jour.

### Phase 9 — durcissement du parcours

Reprise d’étape, messages d’erreur du §44, passage en revue mobile (cibles, RTL de la transmission, pas de spinner muet), revue des logs sur un parcours complet.

Critère : le parcours du §48 tient, un log d’erreur ne contient ni transcript ni dosage, et une transmission non validée n’est pas marquée finale.

Hors de ces phases : enregistrement micro, diarization, résumé automatique, édition des traitements, écran de comparaison, moteur d’alertes, recherche clinique, planning, carte, statistiques, dictée, synthèse mensuelle, export, intégration dossier.

---

## 20. Décisions encore ouvertes

Elles ne bloquent pas les phases 1 à 9 sur données fictives. Elles bloquent la mise en production réelle.

1. Où tourne l’application, et dans quelle région (Israël / UE), qui administre les sauvegardes.
2. Base légale du transfert des audio et transcriptions vers OpenAI, et activation réelle de la rétention nulle.
3. Politique de conservation des audio (un des trois modes), et texte de la case de confirmation.
4. Second facteur avant le premier vrai dossier.
5. Durée de conservation de l’audit.
6. Modèle de transcription retenu après essai sur fixtures hébreu / français / mixte — pas avant.
7. Formulation exacte, par un clinicien, des formules hébraïques « non évalué » et « nié explicitement ». Le code aura des chaînes par défaut, à relire par l’infirmier, pas inventées comme du style littéraire.

---

## 21. Critère d’arrêt

L’implémentation ne commence pas avant validation explicite de ce plan.

Une fois validé, la prochaine action est la phase 1, rien d’autre. Le premier incrément livrable au clinicien est la fin de la phase 8, durcie en phase 9.
