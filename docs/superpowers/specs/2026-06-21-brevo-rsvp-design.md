# Design — Intégration Brevo RSVP

Date : 2026-06-21

## Contexte

Site statique GitHub Pages (`leaetvincent.fr`). Le formulaire RSVP soumet actuellement vers Formspree, qui notifie Léa & Vincent et stocke les réponses dans un tableau exportable.

**Objectif :** ajouter un email de confirmation automatique à l'invité + une liste Brevo pour envoyer des newsletters et rappels ultérieurs. Formspree est conservé tel quel.

## Architecture

```
Form submit
  ├── Formspree (inchangé)
  │     └── Notification complète à Léa & Vincent + tableau + export CSV
  │
  └── POST https://api.leaetvincent.fr/rsvp  (Vercel, nouveau)
        ├── Email de confirmation → invité (HTML inline)
        └── Contact créé/mis à jour dans Brevo (pour newsletters & rappels)
```

Les deux fetch partent en parallèle depuis `script.js`. Si Brevo échoue, Formspree a déjà fonctionné — rien de critique n'est perdu.

## Dépôt Vercel

Dépôt Git séparé : `mariage-api` (ne pas mettre dans le repo du site).

```
mariage-api/
├── api/
│   └── rsvp.js        ← fonction serverless unique
└── package.json
```

## Fonction serverless — `api/rsvp.js`

### Étapes dans l'ordre

1. Refuser toute méthode autre que POST
2. Vérifier `Content-Type: application/json`
3. Refuser les payloads > 50 ko
4. Parser le body JSON
5. Vérifier le honeypot (champ `_gotcha` doit être vide)
6. Valider : `prenom` présent, `nom` présent, `email` valide (regex), `presence` présent
7. Appel Brevo — email de confirmation à l'invité
8. Appel Brevo — créer/mettre à jour le contact
9. Retourner `{ ok: true }` — ou une erreur propre sans détails techniques

### Payload JSON reçu (depuis script.js)

```json
{
  "_gotcha": "",
  "prenom": "Marie",
  "nom": "Dupont",
  "email": "marie@exemple.fr",
  "telephone": "0601020304",
  "presence": "weekend",
  "presence_detail": "Vendredi, Samedi, Dimanche",
  "adultes": 2,
  "enfants": 1,
  "guests": [
    { "prenom": "Marie", "nom": "Dupont", "allergies": "" },
    { "prenom": "Paul", "nom": "Dupont", "allergies": "Sans gluten" }
  ]
}
```

### Appel 1 — Email de confirmation invité

- Endpoint Brevo : `POST https://api.brevo.com/v3/smtp/email`
- Expéditeur : `BREVO_SENDER_NAME` <`BREVO_SENDER_EMAIL`>
- Destinataire : email de l'invité
- Objet : `Nous avons bien reçu votre réponse — Mariage de Léa & Vincent`
- Contenu : HTML inline (pas de templateId — à créer ultérieurement dans Brevo si besoin)

Contenu email :
```
Bonjour [PRENOM],

Nous avons bien reçu votre réponse pour notre mariage.

Résumé :
- Présence : [PRESENCE_LABEL]
- Détail : [PRESENCE_DETAIL]
- Adultes : [ADULTES]
- Enfants : [ENFANTS]
[LISTE_INVITÉS si applicable]
[ALLERGIES si renseignées]

Pour modifier votre réponse, contactez-nous :
mariage@leaetvincent.fr

À très vite,
Léa & Vincent
```

### Appel 2 — Contact Brevo

- Endpoint Brevo : `POST https://api.brevo.com/v3/contacts`
- `updateEnabled: true` (pas d'erreur si le contact existe déjà)
- Ajouté dans la liste `BREVO_LIST_ID_INVITES`

Attributs :
| Attribut Brevo | Valeur |
|---|---|
| `FNAME` | prenom |
| `LNAME` | nom |
| `SMS` | telephone (si renseigné) |
| `RSVP_STATUS` | presence (ex: "weekend") |
| `RSVP_DETAIL` | presence_detail |
| `RSVP_ADULTS` | adultes |
| `RSVP_CHILDREN` | enfants |
| `RSVP_UPDATED_AT` | date ISO de soumission |

> Les attributs personnalisés (`RSVP_*`) doivent être créés dans Brevo avant le premier appel (Contacts > Attributs).

## Variables d'environnement Vercel

| Variable | Description |
|---|---|
| `BREVO_API_KEY` | Clé API Brevo (Settings > API Keys) |
| `BREVO_SENDER_EMAIL` | Ex: `mariage@leaetvincent.fr` |
| `BREVO_SENDER_NAME` | Ex: `Léa & Vincent` |
| `BREVO_LIST_ID_INVITES` | ID numérique de la liste Brevo |

Aucune de ces variables ne doit apparaître dans le code ou dans Git.

## Changements front-end

### script.js

Modifier la fonction `initRSVP()` — bloc `form.addEventListener('submit', ...)` :

1. Conserver l'appel Formspree **inchangé**
2. Construire un objet JSON structuré à partir des champs du formulaire
3. Envoyer un second `fetch` vers `https://api.leaetvincent.fr/rsvp` en parallèle
4. Si le fetch Vercel échoue → log console uniquement, pas d'impact sur l'UX (Formspree a déjà répondu)

### rsvp-module.html

Aucune modification nécessaire. La mention de confidentialité existante est suffisante pour un cercle d'invités proches.

## DNS OVH

Ajouter un enregistrement dans la zone DNS OVH :

| Type | Nom | Valeur |
|---|---|---|
| CNAME | `api` | fourni par Vercel lors de l'ajout du domaine custom |

## Gestion des erreurs

| Cas | Comportement |
|---|---|
| Champ obligatoire manquant | `400` + message JSON propre |
| Email invalide | `400` + message JSON propre |
| Honeypot rempli | `200` silencieux (leurre spam) |
| Brevo email échoue | `500` loggé côté serveur, message générique côté client |
| Brevo contact échoue | log uniquement, ne bloque pas la confirmation |

## Pré-requis Brevo avant déploiement

1. Créer les attributs personnalisés `RSVP_STATUS`, `RSVP_DETAIL`, `RSVP_ADULTS`, `RSVP_CHILDREN`, `RSVP_UPDATED_AT` dans Contacts > Attributs
2. Créer une liste "Invités mariage Léa & Vincent 2027" et noter son ID
3. Vérifier le domaine expéditeur `leaetvincent.fr` dans Brevo (Senders & IP > Domains)
4. Générer une clé API Brevo (Settings > API Keys)
