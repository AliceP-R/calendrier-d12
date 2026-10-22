# Charte : réparer un évènement cassé du calendrier Au Dé 12

> À transmettre telle quelle à Claude, avec la description du problème
> (ex. « la soirée BOTC du 14 novembre n'apparaît pas sur le site »).

---

## 1. Règles absolues (des données ont déjà été perdues en allant trop vite)

1. **Lecture seule par défaut.** Tu ne modifies JAMAIS un évènement de Google Agenda, ni le Google Sheet, ni le code, de ta propre initiative.
2. **Diagnostic d'abord.** Tu lis, tu compares, puis tu présentes ton diagnostic **avant** toute modification.
3. **Pour chaque correction, tu proposes un « avant / après » exact** (titre, description complète ou étiquette), et tu attends un « oui » explicite pour **cet évènement-là**. Un accord ne vaut pas pour les suivants.
4. **Par défaut, c'est l'humain qui applique la correction** dans Google Agenda : tu lui dis exactement quoi changer et où. Tu ne passes par un outil de modification que si on te le demande explicitement, et après avoir recopié dans la conversation la description d'origine complète (pour pouvoir revenir en arrière).
5. **Jamais** : supprimer un évènement, changer sa date, son heure ou sa récurrence, changer sa visibilité, modifier ce qui est sous le marqueur `---interne---`, toucher aux autres occurrences d'un évènement récurrent sans l'avoir dit.
6. **Jamais deviner un ID de couleur à partir d'un nom de couleur.** Dans l'agenda JDR, les étiquettes ont été recolorées : l'ID 3 est « Créneau Libre » en JDR mais « BOTC » en JDS. Seul le Sheet fait foi.
7. **Confidentialité** : ce qui est sous `---interne---` (noms de clients, contacts, codes…) ne doit jamais être recopié ailleurs que dans la conversation privée, et jamais publié.
8. Explique en **français simple** : la personne qui te parle n'est pas développeuse.

---

## 2. Comment ça marche (à connaître pour diagnostiquer)

```
Google Agenda (titre + étiquette + description) ──┐
                                                  ├─► Apps Script « Calendrier Coloré » ──► site calendrier.au-de12paris.com
Google Sheet « Calendrier d12 - config »        ──┘
```

| Élément | Référence |
|---|---|
| Agenda JDS | `c_b182530e0a332b3e4f20ff0c2308bb5010f8c91130af1b6e6828aa6a15751a6e@group.calendar.google.com` |
| Agenda JDR | `gestionjdr@au-de12paris.com` |
| Google Sheet de configuration | ID `1h5VLpM1BzCOCLynVthGn_mlE1u2_bkUW0KaSSQIEkJ8` (onglets **Couleurs** et **Liens**) |
| Code | dépôt GitHub `alicep-r/calendrier-d12` : `apps-script/Code.gs` (serveur), `docs/index.html` (site) |
| Données envoyées au site | https://script.google.com/macros/s/AKfycbyfYLV_KkuG4Bkq5YLW1JkcuiWVENKTvDMNnu7sHnQW3viFR8xNeKBRRptFLh1JBzaf-A/exec (à ouvrir dans un navigateur ; JSON avec `jds`, `jdr`, `config`) |

- Le site affiche **le mois en cours et le mois suivant** uniquement.
- La correspondance étiquette ↔ réglages se fait sur le couple **Calendrier (JDS/JDR) + ID** (colonne « ID (ne pas toucher) » = `colorId` de l'API Google Calendar).
- Délais : le Sheet est relu toutes les **5 minutes**, le site se rafraîchit toutes les **minutes**.

---

## 3. Liste de vérification d'un évènement

Pour l'évènement signalé, lis-le dans l'agenda (titre, date, `colorId`, visibilité, description complète) et la ligne correspondante du Sheet, puis vérifie dans cet ordre :

### L'évènement n'apparaît pas sur le site
| Cause | Comment le voir | Correction à proposer |
|---|---|---|
| Visibilité **privée** | `visibility` = `private` ou `confidential` | Voulu : un évènement privé n'est jamais affiché. Ne rien changer sauf demande explicite. |
| **Aucune étiquette** de couleur | pas de `colorId` | Choisir l'étiquette dans Google Agenda (l'humain la choisit par son nom, pas toi par sa couleur). |
| Étiquette **absente du Sheet** pour ce calendrier | le couple Calendrier + ID n'existe pas dans l'onglet Couleurs | Soit changer l'étiquette de l'évènement, soit ajouter une ligne au Sheet (décision humaine). |
| **Hors période** | date avant le 1er du mois en cours ou après la fin du mois suivant | Normal, il apparaîtra plus tard. |
| Évènement **annulé** | `status` = `cancelled` | Normal. |

### Une information privée est visible sur le site
- Tout ce qui est **en dessous** du marqueur est retiré avant d'arriver sur le site. Le marqueur est reconnu sous deux formes :
  1. **« interne » entouré de tirets**, quel que soit le mélange : `---interne---`, `—interne—`, `—-interne—-` (l'iPhone transforme `--` en `—`), `-interne-`, avec ou sans espaces ;
  2. **« interne » seul sur sa ligne**, avec ou sans deux-points : `interne`, `Interne :`, `INTERNE`.
- Majuscules et fautes en fin de mot (`internet`, `internes`) sont tolérées. **Pas** reconnus : un mot coupé (`inter ne`), « interne » au milieu d'une phrase (« réunion interne lundi », voulu), ou un marqueur absent.
- Vérifier aussi que l'info privée n'est pas **au-dessus** du marqueur, ni dans le **titre** ou le **lieu** (jamais masqués).

### Le bouton est absent, en trop ou faux
| Cas | Règle |
|---|---|
| Pas de bouton | Normal si : titre contenant **« Complet »** (ou complète, complets…), évènement **passé**, ou colonne « Texte du bouton » vide dans le Sheet. |
| Bouton « lien externe » absent | Il faut une ligne **`Inscription : https://…`** (lien complet, sur la même ligne) **au-dessus** de `---interne---`. Sans elle, pas de bouton. |
| Lien Inscription ignoré | Normal si l'étiquette est de type **« demande »** (mini-formulaire) : la ligne Inscription ne sert qu'aux étiquettes « lien externe ». |
| Mauvais lien Meetup / Vibes | Lignes **`Meetup : https://…`** / **`Vibes : https://…`** en **début de ligne**, au-dessus du marqueur ; sinon le lien du groupe (onglet Liens) est utilisé. |
| Mauvais canaux proposés | Colonnes Mail / Discord / Instagram / Meetup / Vibes du Sheet (VRAI/FAUX ou cases). |
| Message ou objet du mail bizarre | Colonnes « Objet du mail » / « Message » : variables autorisées `{titre} {jour} {date} {heure} {horaire} {personnes}` (accolades, sans espace). |

### Lignes obsolètes à nettoyer (proposer, ne pas imposer)
- **`Inscription : aucune`** → à remplacer par « Complet » dans le titre si la soirée est complète, sinon supprimer la ligne.
- **`Discord : …`** → inutile (le salon planning de l'onglet Liens est utilisé), peut être supprimée.
- Ces lignes s'affichent comme du texte normal : ce n'est pas grave, seulement moins propre.

### La couleur, le nom ou la phrase sont faux
- Ils viennent de l'onglet **Couleurs** (Teinte au format `#RRGGBB`, Nom (légende), Phrase). Une teinte mal écrite est remplacée par du brun.
- Pour la salle JDR : colonne « Salle (JDR) » = `bloque`, `libre` ou `ligue` (vide = bloque). Un évènement sans étiquette connue ne bloque **pas** la salle.

---

## 4. Ton compte rendu

Présente ton diagnostic sous cette forme, puis **attends** :

| Évènement (date, agenda) | Problème trouvé | Correction proposée (avant → après) | Qui la fait |
|---|---|---|---|
| ex. Réservation Client, 4 nov., JDR | séparateur écrit `---internet---` | remplacer par `---interne---` | toi, dans Google Agenda |

Termine par : ce que tu n'as **pas** pu vérifier, et la question précise à laquelle il faut répondre pour continuer.

Après une correction, vérifie au bout de **5 minutes** (adresse « Données envoyées au site » ci-dessus, ou le site lui-même) et dis clairement si c'est réglé.
