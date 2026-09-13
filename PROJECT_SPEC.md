PROJET : APPLICATION WEB IA POUR LE SUIVI INFIRMIER EN HOSPITALISATION À DOMICILE PSYCHIATRIQUE

1. MISSION

Tu dois développer une application web professionnelle destinée principalement à un infirmier spécialisé en psychiatrie travaillant en hospitalisation psychiatrique à domicile en Israël.

L’application doit devenir son outil quotidien pour :

* gérer sa liste de patients ;
* enregistrer ou importer les entretiens réalisés avec les patients ;
* transcrire automatiquement les conversations ;
* comprendre des conversations en hébreu, français ou mélangeant plusieurs langues ;
* associer chaque entretien au bon patient ;
* conserver l’historique clinique longitudinal ;
* utiliser l’historique pertinent du patient pour interpréter le nouvel entretien ;
* générer automatiquement une transmission infirmière psychiatrique professionnelle ;
* permettre au professionnel de vérifier et modifier le résultat ;
* copier immédiatement le compte rendu final dans le logiciel médical utilisé par son établissement.

L’application doit avant tout faire gagner du temps.

Elle ne doit pas chercher à remplacer le jugement clinique de l’infirmier ou du psychiatre.

L’IA produit un brouillon clinique destiné à être relu et validé par un professionnel de santé.

⸻

2. UTILISATEUR PRINCIPAL

L’utilisateur principal est un infirmier expérimenté en psychiatrie travaillant notamment en HAD psychiatrique.

Il suit environ 30 à 40 patients simultanément.

Il réalise quotidiennement :

* visites à domicile frontales ;
* visites virtuelles ;
* appels téléphoniques ;
* admissions ;
* évaluations psychiatriques ;
* surveillance clinique ;
* surveillance médicamenteuse ;
* évaluation du risque suicidaire ;
* coordination avec psychiatres et familles ;
* éducation thérapeutique.

L’application doit être extrêmement rapide à utiliser sur smartphone.

Une grande partie de son utilisation se fera depuis un iPhone entre deux visites.

L’interface doit donc être pensée MOBILE FIRST.

⸻

3. PRINCIPE FONDAMENTAL

Le workflow idéal doit être :

PATIENT → ENREGISTRER/IMPORTER → TRANSCRIRE → ANALYSER → GÉNÉRER → CORRIGER → VALIDER → COPIER

L’utilisateur doit pouvoir produire une transmission complète avec le minimum de clics possible.

⸻

4. DASHBOARD PRINCIPAL

Créer une page d’accueil très simple.

Afficher notamment :

PATIENTS ACTIFS

VISITES DU JOUR

TRANSMISSIONS À VALIDER

DERNIÈRES VISITES

ÉVENTUELLEMENT ALERTES CLINIQUES À VÉRIFIER

Prévoir une recherche instantanée.

La recherche doit pouvoir fonctionner notamment par :

* nom ;
* prénom ;
* ville ;
* téléphone ;
* information clinique pertinente.

⸻

5. FICHE PATIENT

Chaque patient possède une fiche individuelle.

Structure minimale :

Patient

* ID interne
* prénom
* nom
* date de naissance
* âge
* sexe si nécessaire
* téléphone
* ville
* adresse
* personne de contact
* téléphone du proche
* caisse maladie
* psychiatre référent
* infirmier référent
* date d’admission HAD
* statut actif/inactif

Informations psychiatriques :

* diagnostic principal
* diagnostics secondaires
* antécédents psychiatriques
* antécédents somatiques pertinents
* antécédents suicidaires
* addictions
* allergies
* facteurs de risque
* facteurs protecteurs

Traitement :

* médicament
* dosage
* fréquence
* voie
* date de début
* modifications
* effets secondaires
* observance

Prévoir un champ :

RÉSUMÉ CLINIQUE ACTUEL

Ce résumé doit pouvoir être mis à jour progressivement.

⸻

6. TIMELINE PATIENT

La fiche patient doit présenter une timeline chronologique.

Exemple :

11/09/2026 — visite frontale

10/09/2026 — visite virtuelle

08/09/2026 — psychiatre

05/09/2026 — visite infirmière

etc.

Chaque événement doit pouvoir contenir :

* date ;
* heure ;
* type de visite ;
* transcription ;
* résumé IA ;
* transmission finale validée ;
* éventuelles modifications thérapeutiques ;
* notes.

L’objectif est de reconstruire immédiatement l’évolution clinique du patient.

⸻

7. TYPES DE CONTACT

Lors de la création d’une nouvelle visite, proposer :

VISITE FRONTALE

VISITE VIRTUELLE

APPEL TÉLÉPHONIQUE

ADMISSION

ÉVALUATION

CONTACT FAMILLE

AUTRE

La date et l’heure sont automatiquement proposées mais restent modifiables.

⸻

8. AUDIO

Depuis la fiche patient :

bouton principal :

🎙 NOUVEL ENTRETIEN

Deux possibilités :

1. enregistrer directement ;
2. importer un fichier audio existant.

Formats usuels :

m4a
mp3
wav
aac

L’enregistrement doit pouvoir continuer même pour un entretien relativement long.

Afficher :

durée

pause

reprendre

terminer

annuler

⸻

9. TRANSCRIPTION

Après l’enregistrement :

ENVOYER POUR TRANSCRIPTION

La transcription doit supporter au minimum :

HÉBREU

FRANÇAIS

ANGLAIS

RUSSE si techniquement possible

et surtout les conversations MULTILINGUES.

Ne jamais traduire automatiquement la transcription originale.

Conserver :

AUDIO ORIGINAL

TRANSCRIPTION ORIGINALE

TRANSMISSION GÉNÉRÉE

séparément.

⸻

10. IDENTIFICATION DES INTERLOCUTEURS

Si possible, identifier :

INFIRMIER

PATIENT

CONJOINT

PARENT

AUTRE INTERVENANT

Exemple :

INFIRMIER :
איך אתה מרגיש היום?

PATIENT :
אני מרגיש יותר טוב…

Cette fonctionnalité pourra être améliorée progressivement.

⸻

11. PIPELINE IA

Après transcription, ne pas simplement demander à un modèle de résumer le texte.

Créer un pipeline structuré.

ÉTAPE A

Analyser la nouvelle transcription.

ÉTAPE B

Extraire les informations cliniques.

ÉTAPE C

Récupérer uniquement l’historique pertinent du patient.

ÉTAPE D

Comparer l’état actuel avec les visites précédentes.

ÉTAPE E

Identifier les changements.

ÉTAPE F

Produire la transmission professionnelle.

L’historique doit servir de contexte mais ne doit jamais conduire l’IA à inventer qu’une ancienne information est toujours vraie.

⸻

12. EXTRACTION CLINIQUE

L’IA doit rechercher notamment :

humeur

affect

anxiété

sommeil

appétit

niveau d’activité

fonctionnement quotidien

travail

relations familiales

isolement

discours

pensée

contenu de pensée

idées délirantes

hallucinations

symptômes psychotiques

agitation

ralentissement

impulsivité

comportement

insight

jugement

observance

effets secondaires

consommation de substances

idées suicidaires

idées hétéro-agressives

dangerosité

facteurs protecteurs

évolution depuis la dernière visite.

IMPORTANT :

Une information absente de l’entretien ne doit jamais être inventée.

⸻

13. RISQUE SUICIDAIRE

La détection du risque suicidaire doit être particulièrement prudente.

L’IA peut repérer dans la transcription :

* idées suicidaires ;
* plan ;
* intention ;
* moyens ;
* antécédents ;
* désespoir ;
* impulsivité ;
* intoxication ;
* facteurs protecteurs.

Mais elle ne doit jamais présenter une absence d’information comme une négation clinique.

Exemple :

si le suicide n’est jamais abordé pendant l’entretien, ne pas générer automatiquement :

“שולל מחשבות אובדניות”

Il faut distinguer :

NON ÉVALUÉ

NON RAPPORTÉ

NIÉ EXPLICITEMENT.

Même principe pour :

psychose

hétéro-agressivité

substances

effets secondaires.

⸻

14. RÈGLE ABSOLUE CONTRE LES HALLUCINATIONS

L’IA ne doit jamais inventer :

* médicament ;
* dosage ;
* diagnostic ;
* symptôme ;
* résultat biologique ;
* rendez-vous ;
* déclaration du patient ;
* absence de suicidalité ;
* information familiale.

Chaque donnée doit provenir :

1. de la nouvelle transcription ;

OU

2. d’une donnée historique clairement identifiée.

En cas de contradiction entre une ancienne donnée et une nouvelle donnée, la donnée récente doit être privilégiée et la contradiction éventuellement signalée pour validation.

⸻

15. FORMAT DE TRANSMISSION

Les transmissions doivent être générées en HÉBREU CLINIQUE PROFESSIONNEL lorsque ce format est sélectionné.

Le style doit être compatible avec un dossier psychiatrique israélien.

Le texte doit être synthétique, précis, professionnel et naturel.

Éviter le style générique d’une IA.

⸻

16. RÈGLES TYPOGRAPHIQUES PERSONNALISÉES

C’est une exigence importante.

Les transmissions doivent être rédigées PAR BLOCS.

Chaque partie possède un TITRE EN GRAS.

À l’intérieur d’un même bloc :

NE PAS introduire de lignes vides entre les phrases.

Entre deux grandes parties :

UNE séparation visuelle.

Exemple :

פרטי הביקור
בוצע ביקור בית פרונטלי בתאריך… המטופל נכח בביתו…

מצב נפשי
המטופל משתף פעולה… מצב רוח…

הערכת מסוכנות
המטופל שולל מחשבות אובדניות…

התערבות סיעודית
בוצעה הקשבה פעילה…

תוכנית
המשך מעקב…

L’objectif est de faciliter le COPIER-COLLER vers le dossier médical.

⸻

17. MODÈLES DE TRANSMISSION

Créer plusieurs templates.

VISITE FRONTALE

Informations visite

État clinique

Examen psychiatrique pertinent

Traitement/observance

Évaluation du risque

Intervention infirmière

Plan

VISITE VIRTUELLE

Informations appel

Évolution depuis dernier contact

État actuel

Traitement

Risque

Intervention

Plan

ADMISSION

Contexte d’admission

Situation psychosociale

Antécédents

État psychiatrique

Traitement

Évaluation du risque

Explications HAD

Consentements

Plan thérapeutique.

⸻

18. ÉDITION

Après génération :

ouvrir un éditeur.

L’utilisateur peut modifier librement le texte.

Boutons :

REGENERER

RACCOURCIR

PLUS CLINIQUE

CORRIGER HÉBREU

COPIER

VALIDER

Le bouton COPIER doit copier uniquement la transmission finale.

⸻

19. VALIDATION HUMAINE

Une transmission IA ne devient jamais automatiquement une transmission validée.

Statuts :

DRAFT

AI GENERATED

REVIEWED

VALIDATED

L’utilisateur doit explicitement cliquer :

VALIDER

Conserver :

version générée par IA

version modifiée

version finale validée.

⸻

20. HISTORIQUE DES MODIFICATIONS

Conserver un audit log.

Exemple :

07:42 audio enregistré

07:44 transcription terminée

07:45 transmission IA générée

07:47 texte modifié

07:48 transmission validée

Cette fonction est importante pour un outil médical.

⸻

21. TRAITEMENTS

Créer un module médicaments.

Chaque modification doit être historisée.

Exemple :

LITHIUM

ancien dosage : X

nouveau dosage : Y

date : XX/XX/XXXX

prescripteur : Dr X

raison : si connue.

Ne jamais remplacer silencieusement un ancien traitement.

⸻

22. CONTEXTE IA LONGITUDINAL

Ne pas envoyer systématiquement tout le dossier du patient au modèle.

Cela coûte cher, ralentit l’application et augmente le risque de confusion.

Créer plutôt :

CURRENT PATIENT SUMMARY

RECENT RELEVANT VISITS

CURRENT TRANSCRIPT

Le système doit rechercher les informations historiques pertinentes.

À terme, utiliser une stratégie de retrieval/RAG si nécessaire.

⸻

23. RÉSUMÉ CLINIQUE DYNAMIQUE

Maintenir pour chaque patient un résumé synthétique.

Exemple conceptuel :

Diagnostic

Situation sociale

Traitement actuel

État clinique récent

Risques connus

Événements récents

Objectifs thérapeutiques.

Ce résumé doit être actualisé uniquement à partir de données validées.

⸻

24. LANGUES DE L’INTERFACE

Prévoir :

FRANÇAIS

HÉBREU

L’application doit gérer correctement RTL pour l’hébreu.

Les transmissions hébraïques doivent s’afficher RTL.

⸻

25. UX MOBILE

Priorité absolue.

Sur smartphone, l’utilisateur doit pouvoir faire :

ouvrir application

→ patient

→ enregistrer

→ terminer

→ générer

→ vérifier

→ copier

avec très peu d’actions.

Les boutons doivent être suffisamment grands.

Ne pas surcharger l’écran.

⸻

26. DESIGN

Design professionnel médical moderne.

Pas d’interface “hôpital années 2000”.

Utiliser :

cards

typographie claire

espacement généreux

navigation simple

dashboard minimaliste.

Support :

mobile

tablet

desktop.

⸻

27. ARCHITECTURE TECHNIQUE PROPOSÉE

Pour une première version :

Frontend :

Next.js
TypeScript
React

UI :

Tailwind CSS

Backend :

Next.js server/API routes ou backend séparé si nécessaire.

Base de données :

PostgreSQL.

ORM :

Prisma.

Stockage fichiers :

stockage objet compatible S3.

Authentification :

système sécurisé avec sessions.

IA :

API OpenAI côté SERVEUR uniquement.

IMPORTANT :

aucune clé API ne doit être présente dans le frontend.

Utiliser des variables d’environnement.

⸻

28. STRUCTURE DE BASE DE DONNÉES

Prévoir au minimum les entités :

User

Patient

Visit

AudioRecording

Transcript

ClinicalExtraction

ClinicalReport

Medication

MedicationHistory

PatientSummary

AuditLog

Possible structure :

Patient
id
firstName
lastName
birthDate
phone
address
city
diagnoses
riskFactors
protectiveFactors
status
createdAt
updatedAt

Visit
id
patientId
type
date
startTime
duration
notes
status

AudioRecording
id
visitId
storageUrl
duration
mimeType

Transcript
id
visitId
language
rawText
speakerData

ClinicalReport
id
visitId
aiDraft
editedDraft
finalText
status
createdAt
validatedAt

Medication
id
patientId
name
dose
frequency
active

AuditLog
id
userId
patientId
visitId
action
timestamp

Utiliser des relations propres et des migrations.

⸻

29. CONFIDENTIALITÉ

Il s’agit de données médicales psychiatriques réelles.

La sécurité n’est donc pas une fonctionnalité optionnelle.

Prévoir notamment :

authentification forte

HTTPS

chiffrement des données sensibles

contrôle d’accès

logs d’accès

expiration des sessions

protection contre accès non autorisé

sauvegardes

séparation des environnements développement/production.

Ne jamais placer de vraies données patients dans :

logs développeur

analytics

services tiers non nécessaires

messages d’erreur.

⸻

30. DONNÉES POUR LE DÉVELOPPEMENT

NE JAMAIS utiliser de véritables patients pendant le développement initial.

Créer des patients fictifs.

Exemple :

PATIENT TEST 001

PATIENT TEST 002

PATIENT TEST 003.

Créer également de fausses conversations psychiatriques permettant de tester le pipeline.

⸻

31. AUDIO ET CONSENTEMENT

L’application doit permettre de gérer clairement la politique de conservation des enregistrements.

Prévoir techniquement la possibilité :

* de conserver l’audio ;
* de le supprimer après transcription ;
* de définir une durée de conservation.

La politique réelle devra être déterminée avant mise en production selon les obligations juridiques, institutionnelles et de confidentialité applicables.

Ne pas présumer qu’un enregistrement d’entretien médical peut être conservé indéfiniment.

⸻

32. API IA

Créer une abstraction :

AIService

et non disperser les appels API dans tout le projet.

Exemple :

transcribeAudio()

extractClinicalInformation()

generateClinicalReport()

updatePatientSummary()

Cela permettra ultérieurement de changer de modèle sans réécrire toute l’application.

⸻

33. PROMPTING

Créer les prompts dans des fichiers séparés.

Exemple :

/prompts/clinical-extraction.ts

/prompts/nursing-report-he.ts

/prompts/patient-summary.ts

Ne jamais mettre un gigantesque prompt directement dans un composant React.

⸻

34. SORTIE STRUCTURÉE DE L’IA

Pour l’analyse clinique, demander une sortie structurée avant de générer le texte.

Exemple conceptuel :

{
“mood”: {},
“anxiety”: {},
“sleep”: {},
“appetite”: {},
“psychosis”: {},
“suicidality”: {},
“aggression”: {},
“substanceUse”: {},
“medication”: {},
“sideEffects”: {},
“functioning”: {},
“family”: {},
“changes”: [],
“uncertainInformation”: []
}

Chaque information importante devrait idéalement posséder :

value

status

source

confidence.

Exemple :

suicidality.status = “explicitly_denied”

et non simplement :

suicidality = false.

⸻

35. TRAÇABILITÉ DES INFORMATIONS

Pour les informations critiques, conserver si possible leur provenance.

Exemple :

INFORMATION :
Pas d’idées suicidaires.

SOURCE :
nouvel entretien.

EXTRAIT :
phrase correspondante du patient.

Cela permettra au professionnel de vérifier rapidement pourquoi l’IA a produit une affirmation.

⸻

36. GESTION DE L’INCERTITUDE

L’IA doit pouvoir dire :

INFORMATION INCERTAINE

au lieu d’inventer.

Si un dosage est mal compris dans l’audio :

ne pas choisir arbitrairement un dosage.

Afficher par exemple :

⚠️ Dosage médicamenteux à vérifier.

Les médicaments, posologies et éléments de risque doivent recevoir un niveau de prudence particulièrement élevé.

⸻

37. ALERTES

Ne pas créer un système qui pose lui-même des diagnostics.

Créer plutôt des éléments :

À VÉRIFIER.

Exemples :

⚠️ Mention possible d’idées suicidaires

⚠️ Modification médicamenteuse détectée

⚠️ Posologie incertaine

⚠️ Possible consommation de substances

⚠️ Contradiction avec le traitement enregistré.

Ces alertes sont destinées au professionnel.

⸻

38. MVP

NE PAS essayer de construire immédiatement toutes les fonctionnalités.

VERSION 1 :

Authentification

Patients

Fiche patient

Timeline

Création visite

Import audio

Transcription

Génération transmission

Édition

Validation

Copie

Historique.

Cette version doit déjà être utilisable de bout en bout avec des données fictives.

⸻

39. VERSION 2

Ajouter ensuite :

enregistrement audio directement depuis l’application

speaker diarization

résumé clinique automatique

traitements structurés

comparaison entre visites

alertes

recherche avancée.

⸻

40. VERSION 3

Possibilités futures :

planning des visites

cartographie patients

optimisation des itinéraires

rappels

statistiques activité

dictée rapide

génération de synthèse mensuelle

export sécurisé

intégrations autorisées avec d’autres systèmes.

Ces fonctions ne doivent PAS compliquer le MVP.

⸻

41. ÉCRAN PATIENT IDÉAL

Header :

NOM PATIENT
VILLE
STATUT

Boutons principaux :

🎙 ENREGISTRER

📁 IMPORTER AUDIO

✍️ NOUVELLE NOTE

Puis :

RÉSUMÉ CLINIQUE

TRAITEMENT ACTUEL

DERNIÈRE VISITE

TIMELINE

L’utilisateur doit comprendre l’état du patient en quelques secondes.

⸻

42. ÉCRAN APRÈS ENTRETIEN

Afficher :

TRANSCRIPTION

ANALYSE CLINIQUE

TRANSMISSION

ALERTES À VÉRIFIER

L’utilisateur doit pouvoir basculer entre ces vues sans perdre ses modifications.

⸻

43. PERFORMANCE

La génération IA doit afficher clairement les étapes :

Upload…

Transcription…

Analyse clinique…

Génération transmission…

Ne jamais laisser l’utilisateur devant un écran bloqué sans indication.

⸻

44. GESTION DES ERREURS

Si la transcription échoue :

ne jamais perdre l’audio.

Si la génération échoue :

conserver la transcription.

Si la connexion internet disparaît :

préserver autant que possible le travail local non envoyé.

Afficher des erreurs compréhensibles.

Pas :

ERROR 500.

Mais :

“La transcription n’a pas pu être terminée. Votre enregistrement est conservé. Réessayer.”

⸻

45. PRINCIPE MÉDICO-LÉGAL

L’application est un OUTIL D’AIDE À LA DOCUMENTATION.

Elle ne doit jamais prétendre :

avoir réalisé une évaluation qui n’a pas eu lieu ;

avoir vérifié un traitement qui n’a pas été vérifié ;

avoir exclu un risque qui n’a pas été évalué.

La transmission finale reste sous responsabilité du professionnel qui la valide.

⸻

46. OBJECTIF DE PRODUCTIVITÉ

Une fois l’entretien terminé, l’objectif cible est d’obtenir une transmission exploitable en environ 1 à 2 minutes après traitement automatique, hors temps de relecture clinique.

Le nombre d’actions manuelles doit être minimal.

⸻

47. INSTRUCTION DE DÉVELOPPEMENT POUR CURSOR

Ne commence pas par coder tout le produit.

Commence par :

1. analyser ce cahier des charges ;
2. proposer l’architecture définitive ;
3. proposer l’arborescence du projet ;
4. définir le schéma PostgreSQL/Prisma ;
5. définir les composants principaux ;
6. définir le pipeline audio → transcription → extraction → transmission ;
7. identifier les risques de sécurité ;
8. identifier les décisions techniques encore nécessaires ;
9. produire un plan d’implémentation par étapes ;
10. seulement ensuite commencer le développement.

Ne crée pas de fonctionnalités non demandées.

Favorise :

simplicité

maintenabilité

sécurité

rapidité mobile

faible coût API

traçabilité clinique.

⸻

48. PREMIER OBJECTIF À LIVRER

Construire une démonstration fonctionnelle avec :

connexion

5 patients fictifs

fiche patient

timeline

création d’une visite

upload d’un audio

transcription

génération d’une transmission psychiatrique en hébreu

éditeur

bouton copier

validation.

Une fois ce parcours entièrement fonctionnel, stable et sécurisé, poursuivre avec les fonctionnalités avancées.

⸻

49. CRITÈRE DE RÉUSSITE

Le produit est réussi si un infirmier peut sortir d’une visite, ouvrir son téléphone, sélectionner le patient, traiter l’enregistrement et obtenir rapidement une transmission clinique de qualité qu’il relit, valide et copie dans son dossier médical.

La technologie doit disparaître derrière le workflow clinique.

L’utilisateur ne doit pas avoir l’impression d’utiliser plusieurs outils d’IA.

Il doit avoir l’impression d’utiliser son propre assistant de documentation psychiatrique.