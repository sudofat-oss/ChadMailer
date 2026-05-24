# Portage ChadMailer PHP vers une application native Rust + Tauri

## 1. Objectif produit

Transformer l'application PHP actuelle en une application desktop native, professionnelle, performante et maintenable, compatible **Windows** et **Linux**, basée sur :

- **Tauri v2** pour l'application desktop, le packaging, les permissions et l'intégration système.
- **Rust** pour tout le backend métier : campagnes, envoi email, templates, CSV, stockage, DNS, scoring, logs, providers API.
- **Frontend web embarqué** dans le WebView Tauri, idéalement migré progressivement vers TypeScript.

L'objectif n'est pas simplement de faire “marcher l'équivalent PHP”, mais de produire une base propre : architecture modulaire, asynchrone, testable, robuste, sécurisée et optimisée.

---

## 2. État actuel du projet PHP

Le projet original a été déplacé dans :

- `../ChadMailer-php/`

Le nouveau dossier destiné à la version Rust/Tauri est :

- `./`

### 2.1 Stack PHP actuelle

| Zone | Implémentation actuelle |
|---|---|
| Frontend | HTML/CSS/JS vanilla dans `public/` |
| API | Router PHP unique `public/index.php?action=...` |
| Backend métier | Classes PHP sous `src/` |
| Email | Symfony Mailer + bridges Brevo/SES/SendGrid |
| CSV | `league/csv` |
| Logs | Monolog + fichiers JSON/logs |
| Serveur | `php -S localhost:8000` |
| Stockage | Fichiers JSON dans `~/.chadmailer/...` |

### 2.2 Modules PHP identifiés

| Module PHP | Rôle actuel | Portage Rust cible |
|---|---|---|
| `ConfigManager` | Configuration globale + chemins persistants | `config` service avec `serde`, `directories`, chiffrement secrets |
| `TemplateManager` | CRUD templates, dossiers, merge variables, rotation URLs | `template` service + moteur de rendu maison ou `handlebars` |
| `RecipientParser` | Import TXT/CSV, mapping colonnes, alias FR/EN | `recipient` service avec `csv`, validation email |
| `CampaignManager` | Création campagne, envoi, pause/resume/stop, logs, retry failed, rotation SMTP/template | `campaign` engine async Tokio, jobs contrôlés, events Tauri |
| `MailerManager` | SMTP/API providers, test connexion, envoi test/campagne | `mailer` provider abstraction + `lettre` + REST clients |
| `SMTPConfigManager` | CRUD configs SMTP/API + masquage secrets + remote snapshot | `account`/`provider_config` repository + secure storage |
| `DnsChecker` | SPF/DKIM/DMARC | `dns` service avec `hickory-resolver` |
| `CampaignScorer` | Score délivrabilité local | `scoring` module pur, testé |
| `SesAccountInspector` | Inspection compte SES | `aws-sdk-sesv2` ou REST signé AWS |
| `BrevoSendersClient` | Expéditeurs Brevo vérifiés | `reqwest` client Brevo |
| `SendGridRestClient` | SendGrid activity/feed/senders | `reqwest` client SendGrid |
| `ProviderRemoteInspector` | Inspection provider générique | Trait Rust `ProviderInspector` |
| `SmtpRemoteSnapshotBuilder` | Snapshot quotas/DNS/provider | Service agrégateur async |

---

## 3. Architecture cible recommandée

### 3.1 Vision d'ensemble

La meilleure architecture pour une app Tauri propre est :

1. **Frontend statique** dans `frontend/`.
2. **Backend Rust Tauri** dans `src-tauri/`.
3. **Modules métier Rust** séparés clairement dans `src-tauri/src/`.
4. **Communication frontend/backend par commandes Tauri**, pas par serveur HTTP local.
5. **Événements Tauri** pour les logs/progressions de campagne, au lieu de SSE/polling.
6. **Stockage applicatif dans le dossier data natif** de l'OS.
7. **Secrets dans le keychain OS** quand possible.

### 3.2 Arborescence proposée

```./ARCHITECTURE_TARGET.txt#L1-59
ChadMailer-rust/
├── README.md
├── PORTAGE_RUST_TAURI.md
├── frontend/
│   ├── index.html
│   ├── app.ts
│   ├── styles.css
│   └── assets/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   └── src/
│       ├── main.rs
│       ├── app_state.rs
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── dashboard.rs
│       │   ├── templates.rs
│       │   ├── campaigns.rs
│       │   ├── recipients.rs
│       │   ├── provider_configs.rs
│       │   ├── providers.rs
│       │   ├── scoring.rs
│       │   └── dns.rs
│       ├── core/
│       │   ├── mod.rs
│       │   ├── error.rs
│       │   ├── ids.rs
│       │   ├── time.rs
│       │   └── paths.rs
│       ├── storage/
│       │   ├── mod.rs
│       │   ├── json_store.rs
│       │   ├── repositories.rs
│       │   └── migrations.rs
│       ├── config/
│       │   └── mod.rs
│       ├── template/
│       │   ├── mod.rs
│       │   ├── model.rs
│       │   ├── repository.rs
│       │   └── renderer.rs
│       ├── recipient/
│       │   ├── mod.rs
│       │   ├── model.rs
│       │   └── parser.rs
│       ├── campaign/
│       │   ├── mod.rs
│       │   ├── model.rs
│       │   ├── repository.rs
│       │   ├── engine.rs
│       │   ├── scheduler.rs
│       │   ├── routing.rs
│       │   └── progress.rs
│       ├── mailer/
│       │   ├── mod.rs
│       │   ├── message.rs
│       │   ├── provider.rs
│       │   ├── smtp.rs
│       │   ├── brevo.rs
│       │   ├── sendgrid.rs
│       │   ├── ses.rs
│       │   └── office365.rs
│       ├── dns/
│       │   └── mod.rs
│       ├── scoring/
│       │   ├── mod.rs
│       │   └── spam_words.rs
│       └── security/
│           ├── mod.rs
│           └── secrets.rs
└── tests/
```

Cette structure évite le “gros fichier backend”. Chaque domaine a ses modèles, son repository et sa logique métier.

---

## 4. Choix techniques Rust recommandés

### 4.1 Runtime et app desktop

| Besoin | Crate / outil recommandé |
|---|---|
| Desktop | `tauri` v2 |
| Async runtime | `tokio` |
| Sérialisation | `serde`, `serde_json` |
| Erreurs | `thiserror`, éventuellement `anyhow` uniquement aux frontières |
| Logs | `tracing`, `tracing-subscriber`, `tracing-appender` |
| Dates | `chrono` ou `time` |
| IDs | `uuid` ou `nanoid` |
| Chemins OS | `directories` ou API `tauri::path` |

### 4.2 Email

| Provider | Implémentation recommandée |
|---|---|
| SMTP générique | `lettre` avec Tokio + TLS natif/rustls |
| Office365 SMTP | `lettre`, paramètres par défaut `smtp.office365.com:587 STARTTLS` |
| Brevo API | `reqwest` client REST |
| SendGrid API | `reqwest` client REST |
| Amazon SES | `aws-sdk-sesv2` ou `aws-sdk-ses` selon fonctionnalités requises |
| Mailgun/Postmark si conservés | `reqwest` client REST |

Important : il faut définir un trait commun pour tous les providers.

```./PROVIDER_TRAIT_SKETCH.rs#L1-36
#[async_trait::async_trait]
pub trait MailProvider: Send + Sync {
    async fn test_connection(&self) -> Result<(), MailerError>;
    async fn send(&self, message: EmailMessage) -> Result<SendResult, MailerError>;
}

#[async_trait::async_trait]
pub trait ProviderInspector: Send + Sync {
    async fn inspect(&self) -> Result<ProviderSnapshot, ProviderError>;
}
```

Ce design permet au moteur de campagne d'envoyer sans connaître les détails SMTP/Brevo/SES/SendGrid.

### 4.3 CSV, fichiers, parsing

| Besoin | Crate recommandée |
|---|---|
| CSV | `csv` |
| Détection encoding si nécessaire | `encoding_rs` |
| Validation email | `email_address` ou validation stricte maison |
| HTML to text | `html2text` |
| Nettoyage HTML si besoin | `ammonia` |
| Regex variables | `regex`, `once_cell` |

### 4.4 DNS et réseau

| Besoin | Crate recommandée |
|---|---|
| SPF/DKIM/DMARC TXT lookup | `hickory-resolver` |
| HTTP clients | `reqwest` avec `rustls-tls` |
| Proxy HTTP/SOCKS | `reqwest` proxy pour APIs ; SMTP proxy à étudier séparément |

### 4.5 Sécurité des secrets

Ne pas stocker les clés API/mots de passe SMTP en clair dans des JSON si on vise une application pro.

Recommandation :

- Métadonnées provider dans JSON.
- Secrets dans le coffre OS via `keyring` :
  - Windows Credential Manager.
  - Linux Secret Service / libsecret lorsque disponible.
- Fallback chiffré local optionnel si keyring indisponible.
- Masquage systématique côté frontend (`***`).
- Jamais de logs avec secrets.

---

## 5. Modèle de stockage cible

### 5.1 Emplacement

Utiliser le dossier data applicatif Tauri, par exemple :

- Linux : `~/.local/share/chadmailer/` ou chemin Tauri équivalent.
- Windows : `%APPDATA%\\ChadMailer\\`.

Ne plus dépendre directement de `~/.chadmailer`, mais prévoir une migration/import.

### 5.2 Organisation recommandée

```./DATA_LAYOUT_TARGET.txt#L1-28
app_data/
├── config.json
├── templates/
│   ├── template_x.json
│   └── folders.json
├── campaigns/
│   ├── campaign_x.json
│   ├── campaign_x.log.jsonl
│   └── campaign_x.recipients.jsonl
├── provider_configs/
│   └── smtp_x.json
├── uploads/
│   └── imported_file.csv
├── logs/
│   └── app.log
└── migrations/
    └── state.json
```

### 5.3 JSON vs SQLite

Pour un produit “ultra clean”, je recommande **SQLite** à moyen terme, même si le PHP utilisait du JSON.

#### Option A — JSON structuré au départ

Avantages :

- Migration plus simple depuis PHP.
- Développement plus rapide.
- Lisible/débogable.

Inconvénients :

- Concurrence d'écriture plus fragile.
- Recherche/filtrage moins performants.
- Historique campagne volumineux moins adapté.

#### Option B — SQLite directement

Avantages :

- Robuste pour campagnes, logs, destinataires, statuts.
- Requêtes efficaces.
- Migrations propres.
- Meilleur pour une app pro.

Inconvénients :

- Plus de design initial.
- Migration PHP JSON à écrire sérieusement.

**Recommandation professionnelle :**

- SQLite pour campagnes, destinataires, logs, provider configs hors secrets.
- Fichiers JSON/HTML pour templates si on veut conserver l'édition simple.
- Keyring pour secrets.

Crates recommandées :

- `sqlx` avec SQLite, ou `rusqlite` si on préfère un modèle synchrone simple.
- `sea-query` optionnel si requêtes dynamiques.

---

## 6. API Tauri cible

L'actuel frontend appelle `public/index.php?action=...`. En Tauri, on remplace cela par `invoke()`.

### 6.1 Commandes à exposer

| Ancien endpoint PHP | Commande Tauri cible |
|---|---|
| `dashboard` | `dashboard_get()` |
| `templates` GET/POST | `templates_list()`, `template_save()` |
| `template` GET/DELETE | `template_get(id)`, `template_delete(id)` |
| `template_folders` | `template_folders_list()`, `template_folder_save()` |
| `template_move` | `template_move(template_id, folder_id)` |
| `template_folder_move` | `template_folder_move(folder_id, parent_id)` |
| `campaigns` | `campaigns_list()` |
| `campaign` GET/POST/DELETE | `campaign_get()`, `campaign_save()`, `campaign_delete()` |
| `campaign_logs` | `campaign_logs_get()` mais surtout events temps réel |
| `send` | `campaign_start()` |
| `pause` | `campaign_pause()` |
| `resume` | `campaign_resume()` |
| `stop` | `campaign_stop()` |
| `retry_failed` | `campaign_retry_failed()` |
| `score` | `campaign_score()` |
| `dns_check` | `dns_check()` |
| `parse_recipients` | `recipients_parse()` |
| `template_preview_merge` | `template_preview_merge()` |
| `upload` | idéalement `dialog_open_file()` + import Rust |
| `smtp_configs` | `provider_configs_list()` |
| `smtp_config` | `provider_config_get/save/delete()` |
| `test_smtp` | `provider_config_test()` |
| `ses_inspect` | `ses_inspect()` |
| `verified_senders` | `provider_verified_senders()` |
| `provider_inspect` | `provider_inspect()` |
| `sendgrid_activity` | `sendgrid_activity()` |
| `send_test_email` | `send_test_email()` |

### 6.2 Événements Tauri

Les campagnes ne doivent pas être suivies par polling agressif. Utiliser des events :

- `campaign://started`
- `campaign://progress`
- `campaign://log`
- `campaign://paused`
- `campaign://resumed`
- `campaign://stopped`
- `campaign://completed`
- `campaign://failed`

Chaque event doit contenir :

- `campaign_id`
- `timestamp`
- `level`
- `message`
- `stats`: sent/failed/pending/total
- optionnel : provider/template/recipient masqué

---

## 7. Moteur de campagne Rust

C'est le cœur du portage. Il doit être mieux conçu que la version PHP.

### 7.1 Responsabilités

Le moteur doit gérer :

- Chargement campagne.
- Parsing destinataires.
- Déduplication optionnelle.
- Rotation templates.
- Rotation URLs par template.
- Rotation SMTP/API.
- Mode séquentiel et éventuellement parallèle contrôlé.
- Délais aléatoires min/max.
- Pause/reprise/stop.
- Retry des échecs.
- Journalisation structurée.
- Émission d'events Tauri.
- Persistance de l'état.

### 7.2 Concurrence recommandée

Utiliser `tokio` avec :

- `CancellationToken` pour stopper proprement.
- `watch::channel` ou `broadcast::channel` pour pause/resume/status.
- `mpsc` pour logs/progress.
- `Semaphore` pour limiter la parallélisation.
- Backoff/retry configurable.

### 7.3 Modèle d'exécution

#### Mode séquentiel

- Un seul email envoyé à la fois.
- Rotation provider selon `smtp_rotation_every`.
- Delay entre chaque email.
- Plus sûr pour la délivrabilité.

#### Mode parallèle contrôlé

- Concurrence limitée par provider et globalement.
- Nécessite rate limiting strict.
- Utile pour API providers avec quotas.
- Attention au risque de réputation/délivrabilité.

**Recommandation produit :** commencer par un mode séquentiel robuste, puis ajouter un parallèle configurable avec garde-fous.

### 7.4 Rate limiting

Ne pas se contenter d'un `sleep` naïf. Créer un composant :

- `RateLimiter` global.
- `RateLimiter` par provider/config.
- Prise en compte quotas SES/SendGrid/Brevo si disponibles.
- Jitter aléatoire.

---

## 8. Portage des providers email

### 8.1 SMTP / Office365

Utiliser `lettre`.

À gérer :

- STARTTLS vs SMTPS.
- Auth username/password.
- From name/email.
- Reply-To éventuel.
- Headers custom.
- List-Unsubscribe.
- HTML + text multipart.
- Attachments si fonctionnalité ajoutée plus tard.
- Test connexion sans envoyer ou via NOOP quand possible.

Point sensible : proxy SOCKS5 pour SMTP. Le PHP l'évoque, mais Symfony ne le supporte pas proprement. En Rust, il faudra décider :

- soit support HTTP proxy uniquement pour APIs ;
- soit implémentation SMTP via proxy SOCKS5 plus avancée ;
- soit documenter que le proxy SMTP n'est pas garanti en v1.

### 8.2 Brevo

Utiliser API REST officielle avec `reqwest`.

À porter :

- Envoi transactionnel.
- Liste expéditeurs vérifiés.
- Snapshot remote.
- Gestion erreurs HTTP détaillées.

### 8.3 SendGrid

Utiliser API REST officielle.

À porter :

- Envoi mail.
- Email Activity Feed.
- Verified senders si utilisé.
- Région/global/EU si déjà présent dans UI.

### 8.4 Amazon SES

Utiliser AWS SDK Rust.

À porter :

- Envoi email.
- Inspection quotas.
- Identités vérifiées.
- Régions.
- Gestion sandbox/production si exposée.

---

## 9. Templates et personnalisation

### 9.1 Compatibilité à conserver

La version Rust doit conserver :

- Variables `{{variable}}`.
- Variables `{variable}`.
- Variables prédéfinies : `date`, `time`, `datetime`.
- Variables aléatoires :
  - `{{RANDNUM-6}}`
  - `{{RANDALPHA-8}}`
  - `{{RANDALPHANUM-10}}`
- Alias FR/EN : `prenom`, `nom`, `first_name`, `last_name`, `name`, `full_name`, `nom_complet`.
- Rotation d'URLs : `rotate_url`, `url_rotate`.
- Rotation templates par fréquence.

### 9.2 Moteur de rendu

Deux options :

1. **Moteur maison compatible PHP** avec regex, recommandé pour éviter les breaking changes.
2. `handlebars` ou `tera`, mais attention : la syntaxe `{variable}` simple n'est pas native.

**Recommandation :** moteur maison en v1 pour compatibilité, puis éventuellement moteur avancé plus tard.

### 9.3 Génération text/plain

Ajouter une option propre :

- Si `text` vide, générer via `html2text`.
- Le scoring peut avertir si la version texte est trop courte.

---

## 10. Import destinataires

### 10.1 TXT

Conserver :

- Un email par ligne.
- Format `prenom/nom/email@domaine.com`.
- Normalisation email en lowercase.

### 10.2 CSV

Conserver :

- Première ligne comme headers.
- Mapping automatique historique.
- Mapping explicite `email`, `first_name`, `last_name`, `name`, `prenom`, `nom`.
- Custom variables.
- Skip lignes invalides.

### 10.3 Améliorations recommandées

- Détection séparateur `,`, `;`, tab.
- Détection encoding UTF-8/Windows-1252.
- Preview des N premières lignes avant import.
- Rapport d'import : valides, invalides, doublons.
- Option seed inbox / déduplication désactivable.

---

## 11. Scoring délivrabilité

Porter le scoring existant dans un module pur, déterministe et testé.

Critères actuels à conserver :

- Spam words sujet.
- Spam words corps.
- Ratio texte/images.
- Taille HTML max 102 KB.
- Multipart text.
- List-Unsubscribe.
- Liens suspects/raccourcisseurs/HTTP.
- Longueur objet.
- Domaine From gratuit.
- Images sans `alt`.

Améliorations possibles :

- SPF/DKIM/DMARC intégrés au score.
- Alignement domaine From / Return-Path / DKIM d=.
- Détection tracking domains multiples.
- Score séparé : contenu, technique, réputation.

---

## 12. DNS checker

Porter avec `hickory-resolver`.

À conserver :

- SPF sur domaine.
- DKIM via selector.
- DMARC `_dmarc.domain`.
- Messages lisibles côté UI.

Améliorations :

- Support selectors multiples.
- Détection SPF trop large (`+all`, `include` excessifs).
- Détection DMARC absent ou `p=none` en warning.
- Vérification CNAME DKIM providers.

---

## 13. Frontend Tauri

### 13.1 Court terme

Le frontend actuel étant vanilla HTML/CSS/JS, il peut être réutilisé rapidement.

À modifier :

- Remplacer `fetch('index.php?action=...')` par une couche API JS basée sur `invoke()`.
- Remplacer l'upload HTTP par le plugin dialog/file-system de Tauri ou une commande Rust d'import.
- Remplacer polling/SSE par `listen()` sur les events Tauri.

### 13.2 Moyen terme

Pour un rendu pro :

- Migrer `app.js` vers TypeScript.
- Séparer UI/API/state/components.
- Ajouter validation côté frontend.
- Ajouter tests unitaires sur adaptateurs API.
- Garder design system CSS propre ou migrer vers framework léger si besoin.

### 13.3 Couche API frontend recommandée

Créer un fichier type `frontend/api.ts` qui isole Tauri :

```./FRONTEND_API_SKETCH.ts#L1-22
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const api = {
  dashboard: () => invoke('dashboard_get'),
  listTemplates: () => invoke('templates_list'),
  saveTemplate: (template) => invoke('template_save', { template }),
  startCampaign: (campaignId) => invoke('campaign_start', { campaignId }),
};

export function onCampaignProgress(handler) {
  return listen('campaign://progress', (event) => handler(event.payload));
}
```

Ainsi, le reste de l'UI ne dépend pas directement de Tauri.

---

## 14. Sécurité Tauri

Tauri impose un modèle de permissions. Il faut être strict :

- Désactiver toute permission inutile.
- Autoriser uniquement les commandes nécessaires.
- Limiter filesystem à l'app data + fichiers choisis par dialog.
- Ne jamais exposer les chemins secrets au frontend si inutile.
- Nettoyer/sanitizer les HTML previews si affichage risqué.
- CSP stricte.
- Pas de serveur localhost caché.
- Pas de shell ouvert inutilement.

---

## 15. Migration depuis PHP

Prévoir un import depuis `~/.chadmailer` et/ou depuis `../ChadMailer-php/storage`.

À migrer :

- Templates JSON.
- Dossiers templates.
- SMTP/API configs JSON.
- Campagnes JSON.
- Uploads encore référencés.
- Logs si utiles.

Attention :

- Les secrets actuellement en JSON doivent être déplacés vers keyring.
- Les configs migrées doivent être marquées `migrated_from_php`.
- Ne pas supprimer les données PHP automatiquement.

---

## 16. Tests indispensables

### 16.1 Tests unitaires

- Renderer template.
- Variables random.
- Rotation URLs/templates.
- Parser TXT.
- Parser CSV auto/mapping explicite/custom variables.
- Scoring.
- DNS parsing TXT.
- Masquage secrets.

### 16.2 Tests d'intégration

- Envoi SMTP vers serveur local type MailHog/Mailpit.
- Brevo/SendGrid mock HTTP via `wiremock`.
- Campaign engine pause/resume/stop.
- Retry failed.
- Migration PHP JSON vers stockage Rust.

### 16.3 Tests packaging

- Build Linux AppImage/deb/rpm selon cible.
- Build Windows MSI/NSIS.
- Vérification stockage app data.
- Vérification keyring selon OS.

---

## 17. Plan de portage recommandé

### Phase 0 — Fondations

- Initialiser Tauri v2 dans `ChadMailer-rust`.
- Copier le frontend actuel dans `frontend/`.
- Créer une commande `health_check`.
- Mettre en place `AppState`, erreurs, logging `tracing`.
- Configurer chemins app data.

### Phase 1 — Modèles et stockage

- Définir structs Rust : `Template`, `Campaign`, `Recipient`, `ProviderConfig`, `EmailMessage`.
- Mettre en place repositories JSON ou SQLite.
- Implémenter migration/import PHP minimal.
- Implémenter keyring secrets.

### Phase 2 — Templates + recipients + scoring

- Porter `TemplateManager`.
- Porter `RecipientParser`.
- Porter `CampaignScorer`.
- Exposer commandes Tauri associées.
- Adapter frontend aux premières commandes `invoke()`.

### Phase 3 — Providers email

- Implémenter SMTP/Office365 avec `lettre`.
- Implémenter `send_test_email`.
- Implémenter Brevo REST.
- Implémenter SendGrid REST.
- Implémenter SES.
- Implémenter tests/mocks.

### Phase 4 — Campaign engine

- Implémenter moteur séquentiel.
- Pause/resume/stop.
- Logs JSONL/SQLite.
- Events Tauri temps réel.
- Retry failed.
- Rotation providers/templates.
- Delay min/max avec jitter.

### Phase 5 — Inspections provider + DNS

- Porter DNS checker.
- Porter snapshots provider.
- Porter SES inspect.
- Porter verified senders.
- Porter SendGrid activity.

### Phase 6 — Polish produit

- UI Tauri propre.
- TypeScript.
- Permissions Tauri strictes.
- Packaging Windows/Linux.
- Auto-update optionnel.
- Documentation utilisateur.
- CI build/test.

---

## 18. Risques techniques

| Risque | Impact | Stratégie |
|---|---:|---|
| Différences Symfony Mailer vs `lettre` | Moyen | Tests SMTP réels + Mailpit |
| Proxy SMTP SOCKS5 | Moyen/haut | Reporter ou implémenter explicitement |
| Keyring Linux indisponible | Moyen | Fallback chiffré documenté |
| SES SDK complexité | Moyen | Isoler dans module provider |
| Migration données existantes | Moyen | Import non destructif + logs migration |
| Campaign engine concurrent | Haut | Commencer séquentiel, tests Tokio intensifs |
| Frontend monolithique `app.js` | Moyen | Adapter via façade API, migrer progressivement |

---

## 19. Définition d'une v1 réussie

Une v1 Rust/Tauri est réussie si :

- L'app démarre sans PHP, sans serveur local, sans dépendance externe.
- Elle fonctionne sur Windows et Linux.
- Les templates sont créables/modifiables/supprimables.
- Les fichiers TXT/CSV sont importés correctement.
- Les configs SMTP/API sont sauvegardées avec secrets protégés.
- Un email test peut être envoyé.
- Une campagne peut être lancée, suivie, mise en pause, reprise, stoppée.
- Les logs/progressions arrivent en temps réel via events Tauri.
- Le scoring et le DNS checker fonctionnent.
- Les providers principaux fonctionnent : SMTP/Office365, Brevo, SendGrid, SES.
- Le packaging produit un installateur utilisable.

---

## 20. Recommandation finale

Pour faire une application “super clean et pro”, je recommande fortement de ne pas faire un port ligne-à-ligne du PHP.

La bonne stratégie est :

1. **Conserver la compatibilité fonctionnelle** avec les données et comportements existants.
2. **Repenser l'architecture autour de Rust/Tauri** : services, repositories, traits providers, moteur async.
3. **Sécuriser les secrets dès le départ**.
4. **Utiliser les events Tauri** pour les campagnes temps réel.
5. **Tester le moteur de campagne comme un composant critique**.
6. **Commencer par SMTP + templates + CSV + campagne séquentielle**, puis ajouter les providers API et inspections.

Le portage doit être traité comme la création d'une vraie application native, pas comme un simple emballage du projet PHP.
