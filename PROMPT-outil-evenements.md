# Prompt : outil de gestion des événements Au Dé 12 (remplacer Google Agenda)

> À coller tel quel dans une nouvelle conversation avec Claude (idéalement Claude Code, avec le dépôt `alicep-r/calendrier-d12` attaché).

---

## Contexte

Je gère le calendrier public d'**Au Dé 12**, un bar à jeux de société et de jeux de rôle à Paris (fermé le mardi). Le site public est en ligne sur **calendrier.au-de12paris.com** et le code est dans le dépôt GitHub **`alicep-r/calendrier-d12`**.

Aujourd'hui, **Google Agenda est la source des événements**. Je veux construire **notre propre outil de gestion des événements** pour ne plus dépendre de Google Agenda : une interface d'administration pour l'équipe du bar, qui alimente le calendrier public existant.

## Ce qui existe aujourd'hui (architecture)

1. **Deux agendas Google** :
   - **JDS** (jeux de société), un agenda de groupe ;
   - **JDR** (jeux de rôle), l'agenda `gestionjdr@au-de12paris.com`.
2. **Google Apps Script** (`apps-script/Code.gs`, déployé en application web) :
   - lit les deux agendas via l'API Calendar v3 (`singleEvents=true` pour déplier les récurrences), sur le **mois en cours et le mois suivant** ;
   - garde le `colorId` de chaque événement (c'est lui qui donne la catégorie) ;
   - retire les événements `private` / `confidential` et ceux annulés ;
   - **coupe la description à partir du marqueur `---interne---`** (tolère majuscules, espaces, tirets longs et balises HTML ajoutées par Google Agenda) : tout ce qui suit ne doit jamais quitter le serveur ;
   - renvoie un JSON (ou JSONP via `?callback=`) : `{ jds: [...], jdr: [...], generated }`, chaque événement ayant `title, description, startDate, startDateTime, endDateTime, isAllDay, visibility, location, colorId, id`.
3. **Site statique** dans `docs/`, publié par **GitHub Pages** (domaine via `docs/CNAME`) :
   - `docs/index.html` : une seule page, HTML + CSS + JS vanilla, **sans framework ni étape de build** ;
   - `docs/config.js` : URL de l'Apps Script, rafraîchissement toutes les 60 s, fuseau `Europe/Paris`.
   - Le script Apps Script est volontairement hors de `docs/` pour ne pas être publié.

## Fonctionnalités du site public (à conserver)

- Calendrier sur **2 mois** (mois en cours + suivant), navigation par flèches, loader en squelette de calendrier.
- Boutons de filtre **Tous / Jeux de société / Jeux de rôle** + **légende à cocher par catégorie** (couleur), limitée à la section affichée ; les filtres sont **conservés dans l'URL** pour le partage.
- **Compteurs JDS / JDR** dans chaque case du jour.
- **Rafraîchissement automatique** chaque minute (pas d'appel quand l'onglet est masqué, rechargement au retour sur l'onglet, sans réafficher le loader).
- **Fenêtre de détail** d'un événement : horaires, lieu, description (liens écrits en texte brut rendus cliquables, ouverts dans un nouvel onglet).
- Section **« Comment participer »** (JDS et JDR) avec les liens Discord, Instagram, Meetup, Vibes et mail.
- Responsive (en-tête « Mar. » abrégé sur petit écran, etc.), favicon, logo.
- Ton : **tutoiement**, français, émojis sobres.
- Charte : brun `#352419`, crème `#f1e1c0` / `#e4d0ae`, vert `#415921`, orange `#d75c1e`, rouge `#b3320b`, texte `#3a2a1f` / `#6b5646`. Design simple : couleurs unies, pas d'ombres ni de dégradés.

## Catégories (aujourd'hui = couleurs Google Agenda)

Une même couleur n'a pas le même sens en JDS et en JDR. Chaque catégorie a : un **nom**, une **teinte**, un **bouton** dans la fenêtre de détail (`inscription`, `reservation` ou aucun) et, pour le JDR, un **effet sur la salle**.

**JDS**

| Catégorie | Teinte | Bouton |
|---|---|---|
| Soirée BOTC | `#512DA8` | inscription |
| Tables Ouvertes | `#FDD835` | inscription |
| Soirée Découverte | `#1E88E5` | inscription |

**JDR**

| Catégorie | Teinte | Bouton | Salle |
|---|---|---|---|
| Réservation Client | `#7E57C2` | aucun | bloque |
| Créneau Libre | `#55b080` | réservation | libre (réservable) |
| MJ PRO - Vadrouilles & Magie | `#E53935` | inscription | bloque |
| OS & Initiation | `#FB8C00` | inscription | bloque |
| MJ PRO - Campagne Semi-Ouverte | `#455A64` | aucun | bloque |
| Créneau prioritaire à la Ligue Ludique | `#F06292` | aucun | ligue |

Un événement **sans catégorie** n'a pas de bouton (réservations privées, privatisations…) et **bloque la salle**.

## Règles métier

### Description d'un événement (conventions actuelles dans Google Agenda)
- `---interne---` : tout ce qui suit est réservé à l'équipe, jamais envoyé au public.
- Ligne `Inscription : <lien>` → bouton « S'inscrire sur le site de l'organisateur » à la place du bouton normal. `Inscription : aucune` → pas de bouton. La ligne est retirée du texte affiché.
- Lignes `Vibes : <lien>`, `Meetup : <lien>`, `Discord : <lien>`, `Instagram : <lien>` → reprises dans les boutons de canal de l'inscription et retirées du texte affiché.
- Pas de bouton pour un événement déjà terminé.

→ Dans le nouvel outil, ces conventions textuelles doivent devenir de **vrais champs** (notes internes, lien d'inscription externe / pas d'inscription, liens par canal).

### Demande d'inscription / de réservation (pas de vrai système de réservation)
- Bouton « ✋ Demander à m'inscrire » ou « 🔑 Demander à réserver la salle ».
- Petit formulaire : **prénom** + **nombre de personnes** → aperçu d'un message pré-rédigé (ex. « Bonjour ! Je souhaiterais m'inscrire à « X » le samedi 12 octobre 2026 à 19h30 pour 2 personnes. Prénom : Léa. Merci ! »).
- Canaux : **Mail** (menu : Gmail, Outlook en ligne, application de mail, copier l'adresse), **Discord**, **Instagram**, et pour l'inscription aussi **Meetup** et **Vibes**. Hors mail, le message est copié dans le presse-papiers puis le canal s'ouvre dans un nouvel onglet.
- Liens par défaut : mail `contact@au-de12paris.com`, Instagram `https://ig.me/m/aude12.paris`, un salon Discord pour JDS et un pour JDR, Meetup et Vibes du bar (cf. `CONTACTS` dans `docs/index.html`).

### Salle JDR
- Réservable uniquement sur les **« Créneau Libre »** du calendrier, et seulement si rien d'autre ne bloque la salle ce jour-là.
- **Jamais le mardi** (bar fermé).
- **Jeudi et samedi** : prioritaires pour la Ligue Ludique ; demande possible si on s'y prend **au moins 1 mois à l'avance** (les créneaux « Ligue » ne bloquent pas une telle demande).
- Minimum de commande : **lun., mer., ven. soir 17h30 – fin de service : 90 €** ; **dimanche 14h30 – fin de service : 80 €**.
- Outil « La salle est-elle libre ? » : choix d'une date → verdict (✅ libre / ⏳ à demander / ❌ prise ou impossible), et liste des **5 prochaines dates libres**.
- La réservation se fait **par message** (Discord, Instagram, mail), pas par un système automatique.

## Ce que je veux maintenant

Un **outil de gestion des événements** qui remplace Google Agenda :

1. **Interface d'administration** (réservée à l'équipe, avec connexion) pour créer / modifier / dupliquer / supprimer des événements JDS et JDR : titre, date, heures (ou journée entière), lieu, description publique, **notes internes**, catégorie, visibilité (public / privé), lien d'inscription externe ou « pas d'inscription », liens par canal, **récurrence** (ex. toutes les semaines).
2. **Gestion des catégories** depuis l'interface (nom, teinte, bouton, effet sur la salle) au lieu du tableau `COULEURS` codé en dur.
3. **API publique** qui renvoie le même format JSON qu'aujourd'hui (pour que `docs/index.html` continue de marcher en changeant seulement l'URL dans `config.js`), sans jamais exposer les notes internes ni les événements privés.
4. Idéalement : un **flux iCal (.ics)** abonnable, pour que l'équipe et le public puissent toujours voir les événements dans leur agenda habituel.
5. **Migration** : importer les événements existants depuis Google Agenda (couleur → catégorie, `---interne---` → notes internes, lignes `Inscription :` / `Vibes :`… → champs dédiés).

### Contraintes
- Budget quasi nul : hébergement **gratuit** de préférence.
- Maintenable par une personne non développeuse à plein temps : simple, peu de dépendances, pas de build compliqué si possible.
- Le site public reste sur GitHub Pages (`docs/`) et doit continuer de fonctionner pendant la transition (Google Agenda en parallèle jusqu'à la bascule).
- Données personnelles minimales (RGPD) ; aucune donnée interne côté public.
- Code et textes en **français**, commits en français.
- Note : une tentative précédente de « panel admin avec Google Sign-In et formulaires d'inscription » directement dans `index.html` a été annulée (revert) ; je préfère une interface d'admin séparée de la page publique.

## Ta mission

1. Commence par lire le dépôt (`docs/index.html`, `docs/config.js`, `apps-script/Code.gs`) pour vérifier ce contexte.
2. Pose-moi les questions qui manquent (qui doit pouvoir se connecter, combien de personnes, besoin de rôles différents JDS / JDR, besoin d'un historique des modifications, etc.).
3. Propose **2 ou 3 architectures** possibles (ex. Supabase / Firebase / Cloudflare Workers + D1 / Google Sheets + Apps Script…) avec avantages, limites et coût, et **recommande-en une**.
4. Une fois validé, propose un plan par étapes (MVP d'abord : CRUD des événements + API compatible), puis implémente étape par étape sur une branche dédiée, sans casser le site public.
