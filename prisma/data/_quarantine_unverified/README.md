# Quarantaine — lots historiques non vérifiés (V1)

Les fichiers `legacy-visits-batch2.ts`, `legacy-visits-batch3.ts` et
`legacy-visits-batch4.ts` sont **hors mécanisme d’import actif**.

Règle V1 : une visite historique n’est importable que si l’identité, la date,
le type et la transmission clinique sont suffisamment certains.

Les lots 2–4 ne satisfont pas cette règle pour l’ensemble des entrées.

- Ne pas réactiver les scripts `import:legacy-visits-batch2|3|4`.
- Ne pas importer ces données.
- Ne pas les convertir en VALIDATED.
- Ne pas les reconstruire via OpenAI.

Le Lot 1 (`../legacy-visits-batch1.ts`) reste le seul lot d’import historique actif.
