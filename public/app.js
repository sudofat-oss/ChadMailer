// ============================================
// GLOBAL STATE
// ============================================

const state = {
  currentSection: 'dashboard',
  /** Timer polling campagne (évite SSE : php -S ne traite qu’une requête à la fois) */
  campaignPollTimer: null,
  currentCampaignId: null,
  editingCampaignId: null,
  scoreData: null,
  uploadedFilePath: null,
  uploadedFileType: null,
  uploadedTotal: 0,
  templates: [],
  smtpConfigs: [],
  paused: false,
  /** En-têtes du dernier CSV importé (noms de colonnes exacts) */
  csvHeaders: [],
  csvMappingReparseTimer: null,
  /** Éditeur template : 'code' | 'visual' */
  templateHtmlEditMode: 'code',
  templatePreviewDevice: 'desktop',
  /** true après « Appliquer » données réelles — réinitialisé si le HTML change en mode code */
  templatePreviewUsesRealMerge: false,
  /** Résumé avant envoi */
  sendSummaryPending: null,
  configCacheForDetailEta: null,
  completionWatchTimer: null,
  completionWatchCampaignId: null,
  completionWatchName: null,
  /** Éditeur visuel : true si le source est un document HTML complet, false si fragment injecté dans body */
  templateVisualIsFullDocument: false,
  templateVisualLoading: false,
  templateVisualInputHandler: null,
  /** Dossiers de templates (loaders + rendu côté UI) */
  templateFolders: [],
  /** Dossier actuellement ouvert ('' = vue racine) */
  currentTemplateFolderId: '',
  /** État courant du DnD templates ↔ dossiers */
  templateDnd: {
    draggingId: null,
    draggingKind: null, // 'template' | 'folder' | null
    hoverMergeId: null,
    hoverMergeTimer: null
  }
};

const UI_TRANSLATIONS_FR_TO_EN = [
  ['Réduire le panneau', 'Collapse panel'],
  ['Retour à la liste', 'Back to list'],
  ['Quitter l’édition', 'Exit edit mode'],
  ['Mode édition', 'Edit mode'],
  ['Destinataires', 'Recipients'],
  ['Template(s)', 'Template(s)'],
  ['Configuration', 'Configuration'],
  ['Analyser & Envoyer', 'Analyze & Send'],
  ['Détail région choisie', 'Selected region details'],
  ['Scanner toutes les régions', 'Scan all regions'],
  ['Tester la connexion', 'Test connection'],
  ['Enregistrer & utiliser pour cette campagne', 'Save & use for this campaign'],
  ['Email de test', 'Test email'],
  ['Envoyer l’email de test', 'Send test email'],
  ['Sélectionnez', 'Select'],
  ['sélectionnez', 'select'],
  ['Importer', 'Import'],
  ['Lancer l’envoi', 'Start sending'],
  ['Relancer', 'Relaunch'],
  ['Pause', 'Pause'],
  ['Reprendre', 'Resume'],
  ['Supprimer', 'Delete'],
  ['Dossier', 'Folder'],
  ['dossier', 'folder'],
  ['template', 'template'],
  ['paramètres', 'settings'],
  ['Paramètres', 'Settings'],
  ['fournisseur', 'provider'],
  ['Fournisseur', 'Provider'],
  ['générique', 'generic'],
  ['obligatoire', 'required'],
  ['Optionnel', 'Optional'],
  ['optionnel', 'optional'],
  ['liste', 'list'],
  ['noms de colonnes', 'column names'],
  ['Variables personnalisées', 'Custom variables'],
  ['expéditeurs autorisés', 'authorized senders'],
  ['Aucune saisie manuelle', 'No manual input'],
  ['identités', 'identities'],
  ['introuvable', 'not found'],
  ['sauvegarde', 'save'],
  ['suppression', 'deletion'],
  ['création', 'creation'],
  ['mise à jour', 'update'],
  ['prévisualisation', 'preview'],
  ['prérempli', 'pre-filled'],
  ['délivrabilité', 'deliverability'],
  ['activité', 'activity'],
  ['Terminé', 'Completed'],
  ['Panneau', 'Panel'],
  ['brouillon', 'draft'],
  ['Brouillon actuel', 'Current draft'],
  ['Aucun modèle pour l’instant', 'No template yet'],
  ['Aucune campagne', 'No campaign'],
  ['Aucune configuration SMTP / API', 'No SMTP / API configuration'],
  ['Connexion en cours…', 'Connecting...'],
  ['Interrogation des API en cours…', 'Querying APIs...'],
  ['Interrogation de l’API Amazon SES…', 'Querying Amazon SES API...'],
  ['Région Amazon SES', 'Amazon SES region'],
  ['nom affiché', 'display name'],
  ['Nom affiché', 'Display name'],
  ['From (nom affiché)', 'From (display name)'],
  ['Ajustez la liste, l’expéditeur, le SMTP ou les templates, enregistrez puis lancez l’envoi pour appliquer les changements.', 'Adjust list, sender, SMTP or templates, save, then start sending to apply changes.'],
  ['Pour changer la liste, l’expéditeur ou le SMTP avant un nouvel envoi, utilisez « Modifier la campagne ».', 'To change list, sender, or SMTP before a new send, use "Edit campaign".'],
  ['Impossible de localiser le worker (cli.php/PHAR).', 'Unable to locate worker (cli.php/PHAR).'],
  ['Chargement...', 'Loading...'],
  ['Chargement des expéditeurs…', 'Loading senders...'],
  ['Chargement des identités…', 'Loading identities...'],
  ['Erreur réseau', 'Network error'],
  ['Erreur API', 'API error'],
  ['Erreur', 'Error'],
  ['Échec', 'Failed'],
  ['succès', 'success'],
  ['Connexion réussie.', 'Connection successful.'],
  ['Aucun log disponible pour cette campagne.', 'No logs available for this campaign.'],
  ['en attente du worker…', 'waiting for worker...'],
  ['en pause', 'paused'],
  ['terminé', 'completed'],
  ['Campagnes', 'Campaigns'],
  ['Campagne', 'Campaign'],
  ['Envoyés', 'Sent'],
  ['Échecs', 'Failed'],
  ['En attente', 'Pending'],
  ['Configuration SMTP', 'SMTP configuration'],
  ['Configurations SMTP / API', 'SMTP / API configurations'],
  ['Nouveau dossier', 'New folder'],
  ['Nouveau template', 'New template'],
  ['Annuler', 'Cancel'],
  ['Enregistrer', 'Save'],
  ['Analyser', 'Analyze'],
  ['Envoyer', 'Send'],
  ['Connexion', 'Connection'],
  ['délai', 'delay'],
  ['Délai', 'Delay'],
  ['expéditeur', 'sender'],
  ['Expéditeur', 'Sender'],
  ['destinataire', 'recipient'],
  ['Destinataire', 'Recipient'],
  ['Saisie manuelle', 'Manual input'],
  ['Configuration enregistrée', 'Saved configuration'],
  ['Choisissez', 'Choose'],
  ['Choisir', 'Choose'],
  ['Aucun', 'No'],
  ['Aucune', 'No'],
  ['Région', 'Region'],
  ['Clé API', 'API key'],
  ['Mot de passe', 'Password'],
  ['Prénom', 'First name'],
  ['États-Unis / global', 'United States / global'],
  ['Union européenne', 'European Union'],
  ['Aperçu avec données réelles — modifiez le HTML puis réappliquez pour mettre à jour.', 'Preview with real data - edit the HTML and reapply to refresh.'],
  ['Aperçu avec exemples fictifs — choisissez une campagne (ou le brouillon) et cliquez « Appliquer » pour une vraie ligne.', 'Preview with sample data - choose a campaign (or draft) and click "Apply" for a real row.'],
  ['Saisissez du HTML à gauche pour afficher l’aperçu ici.', 'Enter HTML on the left to display preview here.'],
  ['Récapitulatif avant envoi', 'Pre-send summary'],
  ['Envoi forcé', 'Forced send'],
  ['Score délivrabilité', 'Deliverability score'],
  ['Campagne existante — score non recalculé dans ce résumé.', 'Existing campaign - score not recalculated in this summary.'],
  ['Délai entre e-mails', 'Delay between emails'],
  ['Durée estimée (ordre de grandeur)', 'Estimated duration (approx.)'],
  ['Emails envoyés', 'Emails sent'],
  ['Aucune campagne récente. Les dernières campagnes apparaîtront ici.', 'No recent campaign. Latest campaigns will appear here.'],
  ['Par où commencer ? Créez un template de courriel, puis une campagne avec votre liste de contacts.', 'Where to start? Create an email template, then a campaign with your contact list.'],
  ['Créer un template', 'Create a template'],
  ['Aucun modèle pour l’instant', 'No template yet'],
  ['Créez un premier template : sujet, HTML, variables', 'Create your first template: subject, HTML, variables'],
  ['Retournez à « Tous les templates » puis glissez des letters ici.', 'Go back to "All templates" then drag templates here.'],
  ['Glissez un élément ici pour le déplacer', 'Drag an item here to move it'],
  ['Créer un dossier', 'Create a folder'],
  ['Template enregistré', 'Template saved'],
  ['Terminée', 'Completed'],
  ['Échouée', 'Failed'],
  ['Arrêtée', 'Stopped'],
  ['Impossible de modifier une campagne en cours. Mettez-la en pause ou arrêtez-la d’abord.', 'Cannot edit a running campaign. Pause or stop it first.'],
  ['Les fichiers Excel ne sont pas pris en charge. Exportez votre table en CSV (une ligne d’en-têtes + une ligne par contact).', 'Excel files are not supported. Export as CSV (one header row + one row per contact).'],
  ['Sélectionnez au moins un template.', 'Select at least one template.'],
  ['Sélectionnez au moins un SMTP pour la rotation.', 'Select at least one SMTP for rotation.'],
  ['Choisissez un email expéditeur.', 'Choose a sender email.'],
  ['Choisissez un email expéditeur (liste API ou saisie libre selon le fournisseur).', 'Choose a sender email (API list or manual input depending on provider).'],
  ['Importez une liste de destinataires (ou rouvrez la campagne si le fichier a été perdu).', 'Import a recipient list (or reopen campaign if file was lost).'],
  ['Lancez d’abord l’analyse de délivrabilité, ou utilisez « Envoyer quand même » si vous acceptez le risque.', 'Run deliverability analysis first, or use "Send anyway" if you accept the risk.'],
  ['Enregistrez d’abord le nouveau SMTP (« Enregistrer & utiliser pour cette campagne »), ou sélectionnez une configuration existante.', 'Save the new SMTP first ("Save & use for this campaign"), or select an existing configuration.'],
  ['Impossible de récupérer l\'ID de campagne.', 'Unable to get campaign ID.'],
  ['Erreur mise à jour campagne', 'Campaign update error'],
  ['Erreur création campagne', 'Campaign creation error'],
  ['Erreur analyse', 'Analysis error'],
  ['Erreur upload', 'Upload error'],
  ['Erreur parsing', 'Parsing error'],
  ['Erreur score', 'Score error'],
  ['Aucun expéditeur disponible', 'No sender available'],
  ['Aucun expéditeur listé pour ce compte.', 'No sender listed for this account.'],
  ['Aucun expéditeur actif trouvé.', 'No active sender found.'],
  ['Choisissez une configuration SMTP', 'Choose an SMTP configuration'],
  ['Choisissez un expéditeur', 'Choose a sender'],
  ['Choisissez une campagne', 'Choose a campaign'],
  ['Campagne introuvable', 'Campaign not found'],
  ['Aucune donnée en cache pour cette session', 'No cached data for this session'],
  ['Interroger l’API', 'Query API'],
  ['Historique', 'History'],
  ['Saisie libre', 'Manual entry'],
  ['fournit pas', 'does not provide'],
  ['ne propose pas', 'does not provide'],
  ['dans l’app.', 'in the app.'],
  ['adresse', 'address'],
  ['adresses', 'addresses'],
  ['enregistrée', 'saved'],
  ['enregistré', 'saved'],
  ['vérifié', 'verified'],
  ['vérifiée', 'verified'],
  ['Vérifiez', 'Check'],
  ['d’abord', 'first'],
  ['Renseignez', 'Fill in'],
  ['compte', 'account'],
  ['chargement', 'loading'],
  ['charger', 'load'],
  ['impossible de charger', 'unable to load'],
  ['Impossible de charger', 'Unable to load'],
  ['Impossible d’enregistrer la campagne', 'Unable to save campaign'],
  ['Impossible de charger la campagne', 'Unable to load campaign'],
  ['Erreur prévisualisation', 'Preview error'],
  ['Modifier la campagne', 'Edit campaign'],
  ['Nouvelle campagne', 'New campaign'],
  ['Enregistrer & lancer l’envoi', 'Save & start sending'],
  ['Campagne ', 'Campaign '],
  ['Connexion réussie', 'Connection successful'],
  ['réponse serveur inattendue', 'unexpected server response'],
  ['Erreur inconnue', 'Unknown error'],
  ['erreur inconnue', 'unknown error'],
  ['Erreur lors de la sauvegarde', 'Error while saving'],
  ['Erreur lors de la suppression', 'Error while deleting'],
  ['Erreur création dossier', 'Folder creation error'],
  ['Impossible de déplacer le template', 'Unable to move template'],
  ['Impossible de déplacer le dossier', 'Unable to move folder'],
  ['Aucun message correspondant', 'No matching message'],
  ['Essayez d’élargir les filtres', 'Try widening filters'],
  ['ou de charger un nombre plus élevé', 'or loading a higher number'],
  ['Sélectionnez une campagne', 'Select a campaign'],
  ['Erreur chargement campagnes', 'Campaign loading error'],
  ['Erreur envoi', 'Send error'],
  ['Erreur lors du relancement', 'Relaunch error'],
  ['Erreur lors de l\'upload', 'Upload error'],
  ['Erreur lors de l’upload', 'Upload error'],
  ['Échec :', 'Failed:'],
  ['expéditeur (From) sont requis', 'sender (From) are required'],
  ['sont requis', 'are required'],
  ['Aucune identité listée', 'No identity listed'],
  ['Aucune identité vérifiée', 'No verified identity'],
  ['Identité', 'Identity'],
  ['identité', 'identity'],
  ['Aucune donnée en cache', 'No cached data'],
  ['cliquez sur', 'click'],
  ['Introspection API disponible pour', 'API introspection available for'],
  ['uniquement', 'only'],
  ['Temps restant', 'Time remaining'],
  ['Relancer l’envoi', 'Relaunch sending'],
  ['Utilisez', 'Use'],
  ['pour les changer', 'to change them'],
  ['en attente', 'pending'],
  ['arrêtée', 'stopped'],
  ['envoyés', 'sent'],
  ['Fichier', 'File'],
  ['destinataire(s)', 'recipient(s)'],
  ['Le nom du template est requis.', 'Template name is required.'],
  ['Le nom du dossier est requis.', 'Folder name is required.'],
  ['Le nom de la configuration est requis.', 'Configuration name is required.'],
  ['URL de désabonnement sauvegardée.', 'Unsubscribe URL saved.'],
  ['Copié !', 'Copied!']
];

function translateUiText(value) {
  if (value == null) return value;
  let out = String(value);
  UI_TRANSLATIONS_FR_TO_EN.forEach(([fr, en]) => {
    out = out.split(fr).join(en);
  });
  return out;
}

function translateUiNodeText(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.parentElement && !['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)) {
      const translated = translateUiText(node.nodeValue);
      if (translated !== node.nodeValue) node.nodeValue = translated;
    }
    node = walker.nextNode();
  }
}

function translateUiAttributes(root) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('[title],[placeholder],[aria-label]').forEach(el => {
    ['title', 'placeholder', 'aria-label'].forEach(attr => {
      if (el.hasAttribute(attr)) {
        const current = el.getAttribute(attr) || '';
        const translated = translateUiText(current);
        if (translated !== current) el.setAttribute(attr, translated);
      }
    });
  });
}

function applyEnglishUiTranslation(root) {
  const target = root || document.body;
  if (!target) return;
  translateUiNodeText(target);
  translateUiAttributes(target);
}

function installUiTranslationObserver() {
  if (document.documentElement) document.documentElement.lang = 'en';
  applyEnglishUiTranslation(document.body);

  const origAlert = window.alert;
  window.alert = function patchedAlert(message) {
    return origAlert.call(window, translateUiText(message));
  };
  const origConfirm = window.confirm;
  window.confirm = function patchedConfirm(message) {
    return origConfirm.call(window, translateUiText(message));
  };

  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.type === 'characterData' && m.target && m.target.parentElement) {
        const translated = translateUiText(m.target.nodeValue);
        if (translated !== m.target.nodeValue) m.target.nodeValue = translated;
        return;
      }
      m.addedNodes.forEach(n => {
        if (n.nodeType === Node.TEXT_NODE) {
          const translated = translateUiText(n.nodeValue);
          if (translated !== n.nodeValue) n.nodeValue = translated;
        } else if (n.nodeType === Node.ELEMENT_NODE) {
          applyEnglishUiTranslation(n);
        }
      });
    });
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

/**
 * Régions SES (formulaires) — aligné sur SesAccountInspector::PROBE_REGIONS (PHP).
 * @type {{ v: string, l: string }[]}
 */
const SES_AWS_REGION_OPTIONS = [
  { v: 'af-south-1', l: 'Africa (Cape Town) — af-south-1' },
  { v: 'ap-northeast-1', l: 'Asia Pacific (Tokyo) — ap-northeast-1' },
  { v: 'ap-northeast-2', l: 'Asia Pacific (Seoul) — ap-northeast-2' },
  { v: 'ap-northeast-3', l: 'Asia Pacific (Osaka) — ap-northeast-3' },
  { v: 'ap-south-1', l: 'Asia Pacific (Mumbai) — ap-south-1' },
  { v: 'ap-south-2', l: 'Asia Pacific (Hyderabad) — ap-south-2' },
  { v: 'ap-southeast-1', l: 'Asia Pacific (Singapore) — ap-southeast-1' },
  { v: 'ap-southeast-2', l: 'Asia Pacific (Sydney) — ap-southeast-2' },
  { v: 'ap-southeast-3', l: 'Asia Pacific (Jakarta) — ap-southeast-3' },
  { v: 'ap-southeast-5', l: 'Asia Pacific (Malaysia) — ap-southeast-5' },
  { v: 'ca-central-1', l: 'Canada (Central) — ca-central-1' },
  { v: 'ca-west-1', l: 'Canada West (Calgary) — ca-west-1' },
  { v: 'eu-central-1', l: 'Europe (Frankfurt) — eu-central-1' },
  { v: 'eu-central-2', l: 'Europe (Zurich) — eu-central-2' },
  { v: 'eu-north-1', l: 'Europe (Stockholm) — eu-north-1' },
  { v: 'eu-south-1', l: 'Europe (Milan) — eu-south-1' },
  { v: 'eu-west-1', l: 'Europe (Ireland) — eu-west-1' },
  { v: 'eu-west-2', l: 'Europe (London) — eu-west-2' },
  { v: 'eu-west-3', l: 'Europe (Paris) — eu-west-3' },
  { v: 'il-central-1', l: 'Israel (Tel Aviv) — il-central-1' },
  { v: 'me-central-1', l: 'Middle East (UAE) — me-central-1' },
  { v: 'me-south-1', l: 'Middle East (Bahrain) — me-south-1' },
  { v: 'sa-east-1', l: 'South America (Sao Paulo) — sa-east-1' },
  { v: 'us-east-1', l: 'US East (N. Virginia) — us-east-1' },
  { v: 'us-east-2', l: 'USA (Ohio) — us-east-2' },
  { v: 'us-west-1', l: 'US West (N. California) — us-west-1' },
  { v: 'us-west-2', l: 'USA (Oregon) — us-west-2' },
  { v: 'us-gov-east-1', l: 'AWS GovCloud (US-East) — us-gov-east-1' },
  { v: 'us-gov-west-1', l: 'AWS GovCloud (US-West) — us-gov-west-1' }
];

function labelForAwsRegionCode(code) {
  if (!code) return '';
  const o = SES_AWS_REGION_OPTIONS.find(x => x.v === code);
  return o ? o.l : String(code) + ' — ' + String(code);
}

function populateAwsRegionSelects() {
  ['smtpAwsRegion', 'campAwsRegion', 'testingSesRegion'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const previous = sel.value;
    sel.textContent = '';
    SES_AWS_REGION_OPTIONS.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.v;
      opt.textContent = o.l;
      sel.appendChild(opt);
    });
    const allowed = SES_AWS_REGION_OPTIONS.some(o => o.v === previous);
    sel.value = allowed ? previous : 'eu-west-3';
  });
}

/** Ajoute l’option si besoin (ex. ancienne config ou scan) puis sélectionne. */
function ensureAwsRegionInSelect(selectId, regionCode, displayLabel) {
  const sel = document.getElementById(selectId);
  if (!sel || !regionCode) return;
  const code = String(regionCode).trim();
  if (!code) return;
  let found = Array.from(sel.options).some(o => o.value === code);
  if (!found) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = displayLabel || labelForAwsRegionCode(code);
    sel.appendChild(opt);
    found = true;
  }
  if (found) sel.value = code;
}

// --- Cache introspection API (sessionStorage — jamais d’appel automatique) ---
const INSPECT_CACHE_SS_KEY = 'chadmailer_provider_inspect_v1';
const INSPECTABLE_SMTP_PROVIDERS = new Set(['brevo', 'ses', 'amazonses', 'sendgrid']);

function readInspectCacheMap() {
  try {
    const raw = sessionStorage.getItem(INSPECT_CACHE_SS_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

function writeInspectCacheMap(map) {
  try {
    sessionStorage.setItem(INSPECT_CACHE_SS_KEY, JSON.stringify(map));
  } catch {
    /* quota / private */
  }
}

function getSmtpInspectCacheEntry(smtpId) {
  if (smtpId == null || smtpId === '') return null;
  const m = readInspectCacheMap();
  return m[String(smtpId)] || null;
}

function setSmtpInspectCacheEntry(smtpId, apiData) {
  if (smtpId == null || smtpId === '' || !apiData || !apiData.inspect) return;
  const m = readInspectCacheMap();
  m[String(smtpId)] = { fetched_at: apiData.fetched_at, inspect: apiData.inspect };
  writeInspectCacheMap(m);
}

function removeSmtpInspectCacheEntry(smtpId) {
  if (smtpId == null || smtpId === '') return;
  const m = readInspectCacheMap();
  delete m[String(smtpId)];
  writeInspectCacheMap(m);
}

function buildInspectPreHtml(fetchedAt, inspectObj) {
  const t =
    fetchedAt && String(fetchedAt).trim()
      ? `<p class="field-hint smtp-inspect-meta"><strong>Récupéré :</strong> ${escHtml(
          (() => {
            try {
              return new Date(fetchedAt).toLocaleString('fr-FR');
            } catch {
              return String(fetchedAt);
            }
          })()
        )}</p>`
      : '';
  return (
    t +
    '<pre class="inspect-json-pre" tabindex="0">' +
    escHtml(JSON.stringify(inspectObj, null, 2)) +
    '</pre>'
  );
}

function renderSmtpDetailMetaRows(c) {
  const rows = [
    ['ID', c.id || '—'],
    ['Nom', c.name || '—'],
    ['Fournisseur', c.provider || '—']
  ];
  if (c.host) rows.push(['Host', c.host]);
  if (c.port != null && c.port !== '') rows.push(['Port', String(c.port)]);
  if (c.username) rows.push(['Utilisateur', c.username]);
  if (c.region) rows.push(['Région SES', c.region]);
  if (String(c.provider || '').toLowerCase() === 'office365') {
    const enc = (c.encryption && String(c.encryption).trim()) || 'tls';
    rows.push(['Chiffrement SMTP', enc.toUpperCase() + ' (STARTTLS attendu sur le port 587)']);
  }
  if (String(c.provider || '').toLowerCase() === 'sendgrid') {
    const g = c.sendgrid_region != null ? String(c.sendgrid_region).trim() : '';
    const label =
      g === 'eu'
        ? 'UE (api.eu.sendgrid.com)'
        : g === 'global' || g === 'us'
          ? 'US / global (api.sendgrid.com)'
          : 'Automatique (introspection UE puis US)';
    rows.push(['Région API SendGrid', label]);
  }
  const masked =
    (c.api_key && String(c.api_key).includes('*')) ||
    c.password === '***' ||
    (c.secret_key && String(c.secret_key).includes('*'));
  rows.push(['Secrets enregistrés', masked ? '•••• (masqué dans l’interface)' : '—']);
  return rows;
}

function renderSmtpDetailMetaHtml(c) {
  const rows = renderSmtpDetailMetaRows(c);
  return (
    '<dl class="smtp-config-detail-meta">' +
    rows.map(([k, v]) => `<dt>${escHtml(k)}</dt><dd>${escHtml(String(v))}</dd>`).join('') +
    '</dl>'
  );
}

function smtpDnsBadgeClass(st) {
  if (st === 'ok') return 'smtp-dns-badge smtp-dns-badge--ok';
  if (st === 'fail') return 'smtp-dns-badge smtp-dns-badge--fail';
  if (st === 'warn') return 'smtp-dns-badge smtp-dns-badge--warn';
  return 'smtp-dns-badge smtp-dns-badge--na';
}

function buildSmtpRemoteRowExtrasHtml(c) {
  const p = String(c.provider || '').toLowerCase();
  if (!['brevo', 'ses', 'amazonses', 'sendgrid'].includes(p)) {
    return '<div class="smtp-row-extras smtp-row-extras--na" title="Indicateurs API pour Brevo, Amazon SES et SendGrid">—</div>';
  }
  if (!c.remote_snapshot || typeof c.remote_snapshot !== 'object') {
    return '<div class="smtp-row-extras smtp-row-extras--na" title="Sauvegardez la config ou ouvrez le détail puis « Interroger l’API » pour actualiser quotas et DNS">⋯</div>';
  }
  const snap = c.remote_snapshot;
  const d = snap.dns_badges || {};
  const hint = [d.hint, (snap.errors && snap.errors[0]) || ''].filter(Boolean).join(' — ');
  const qs = (snap.quotas && snap.quotas.lines) || [];
  const quotaStr = qs.map(l => escHtml(l)).join('<span class="smtp-quota-sep"> · </span>');

  return (
    '<div class="smtp-row-extras" title="' +
    escAttr(hint || 'Agrégat SPF / DKIM / DMARC selon la doc fournisseur + DNS public si besoin') +
    '">' +
    '<div class="smtp-dns-badges" role="group" aria-label="Authentification DNS">' +
    '<span class="' +
    smtpDnsBadgeClass(d.spf) +
    '">SPF</span>' +
    '<span class="' +
    smtpDnsBadgeClass(d.dkim) +
    '">DKIM</span>' +
    '<span class="' +
    smtpDnsBadgeClass(d.dmarc) +
    '">DMARC</span>' +
    '</div>' +
    (quotaStr ? '<div class="smtp-quota-inline">' + quotaStr + '</div>' : '') +
    '</div>'
  );
}

function mergeSmtpRemoteSnapshotIntoState(smtpId, snap) {
  if (!snap || !state.smtpConfigs) return;
  const i = state.smtpConfigs.findIndex(s => String(s.id) === String(smtpId));
  if (i >= 0) state.smtpConfigs[i].remote_snapshot = snap;
}

function patchSmtpRowExtrasFromState(smtpId) {
  const idEsc = escAttr(String(smtpId));
  const wrap = document.querySelector('.smtp-config-wrap[data-smtp-id="' + idEsc + '"]');
  if (!wrap) return;
  const cfg = (state.smtpConfigs || []).find(s => String(s.id) === String(smtpId));
  if (!cfg) return;
  const slot = wrap.querySelector('.smtp-row-extras-slot');
  if (!slot) return;
  slot.innerHTML = buildSmtpRemoteRowExtrasHtml(cfg);
}

// --- Expéditeur campagne : liste API (Brevo / SES) ou saisie libre (autres fournisseurs) ---

function getCampaignSmtpContextForVerifiedSenders() {
  const smtpSel = document.getElementById('smtpConfigSelect');
  const v = smtpSel && smtpSel.value;
  if (!v || v === '') {
    return { supportsApi: false, reason: 'no_smtp', hint: null, provider: null, payload: null };
  }
  if (v === '__new__') {
    const d = collectCampSmtpData();
    if (d.provider === 'brevo') {
      if (!d.api_key) {
        return { supportsApi: true, reason: 'inline', provider: 'brevo', payload: null };
      }
      return { supportsApi: true, reason: 'inline', provider: 'brevo', payload: { provider: 'brevo', api_key: d.api_key } };
    }
    if (d.provider === 'ses') {
      if (!d.access_key || !d.secret_key) {
        return { supportsApi: true, reason: 'inline', provider: 'ses', payload: null };
      }
      return {
        supportsApi: true,
        reason: 'inline',
        provider: 'ses',
        payload: {
          provider: 'ses',
          access_key: d.access_key,
          secret_key: d.secret_key,
          region: d.region || 'eu-west-3'
        }
      };
    }
    if (d.provider === 'sendgrid') {
      if (!d.api_key) {
        return { supportsApi: true, reason: 'inline', provider: 'sendgrid', payload: null };
      }
      const payload = { provider: 'sendgrid', api_key: d.api_key };
      if (d.sendgrid_region) payload.sendgrid_region = d.sendgrid_region;
      return { supportsApi: true, reason: 'inline', provider: 'sendgrid', payload };
    }
    return {
      supportsApi: false,
      reason: 'other_provider',
      hint: 'Saisie libre : ce fournisseur ne fournit pas de liste d’expéditeurs dans l’app.',
      provider: d.provider,
      payload: null
    };
  }
  const cfg = (state.smtpConfigs || []).find(s => String(s.id) === v);
  const p = (cfg && cfg.provider) || '';
  if (p === 'brevo' || p === 'ses' || p === 'amazonses' || p === 'sendgrid') {
    return {
      supportsApi: true,
      reason: 'saved',
      provider: p === 'brevo' ? 'brevo' : p === 'sendgrid' ? 'sendgrid' : 'ses',
      payload: { smtp_config_id: v }
    };
  }
  return {
    supportsApi: false,
    reason: 'other_provider',
    hint: 'Saisie libre : liste d’expéditeurs API non disponible pour ce fournisseur.',
    provider: p,
    payload: null
  };
}

function getFromEmailValue() {
  const sel = document.getElementById('fromEmailSelect');
  const inp = document.getElementById('fromEmail');
  if (sel && !sel.classList.contains('hidden')) {
    return (sel.value || '').trim();
  }
  if (inp && !inp.readOnly) {
    return (inp.value || '').trim();
  }
  return '';
}

function applyCampaignFromEmailBlockedMode(message) {
  const sel = document.getElementById('fromEmailSelect');
  const inp = document.getElementById('fromEmail');
  const btn = document.getElementById('refreshVerifiedSendersBtn');
  const hint = document.getElementById('fromEmailListHint');
  if (sel) {
    sel.classList.add('hidden');
    sel.innerHTML = '';
  }
  if (btn) btn.classList.add('hidden');
  if (inp) {
    inp.classList.remove('hidden');
    inp.readOnly = true;
    inp.value = '';
    inp.placeholder = message || '—';
  }
  if (hint) {
    hint.textContent =
      message ||
      'Choisissez une configuration SMTP (Brevo, SendGrid ou Amazon SES) pour afficher les expéditeurs autorisés.';
    hint.classList.remove('hidden');
  }
}

function applyCampaignFromEmailManualMode(value) {
  const sel = document.getElementById('fromEmailSelect');
  const inp = document.getElementById('fromEmail');
  const btn = document.getElementById('refreshVerifiedSendersBtn');
  const hint = document.getElementById('fromEmailListHint');
  if (sel) {
    sel.classList.add('hidden');
    sel.innerHTML = '';
  }
  if (btn) btn.classList.add('hidden');
  if (inp) {
    inp.classList.remove('hidden');
    inp.readOnly = false;
    inp.placeholder = 'newsletter@mondomaine.com';
    inp.value = value != null ? value : '';
  }
  if (hint) {
    hint.textContent = 'Saisie libre : ce fournisseur ne propose pas de liste d’expéditeurs dans l’app.';
    hint.classList.remove('hidden');
  }
}

function applyCampaignFromEmailApiMode(senders, preferredEmail) {
  const sel = document.getElementById('fromEmailSelect');
  const inp = document.getElementById('fromEmail');
  const btn = document.getElementById('refreshVerifiedSendersBtn');
  const hint = document.getElementById('fromEmailListHint');
  if (inp) {
    inp.classList.add('hidden');
    inp.readOnly = false;
    inp.value = '';
  }
  if (btn) btn.classList.remove('hidden');
  if (sel) {
    sel.classList.remove('hidden');
    sel.innerHTML = '';
    const o0 = document.createElement('option');
    o0.value = '';
    o0.textContent = senders.length ? '— Choisir un expéditeur —' : '— Aucun expéditeur disponible —';
    sel.appendChild(o0);
    (senders || []).forEach(s => {
      const o = document.createElement('option');
      o.value = s.email;
      o.textContent = s.label || s.email;
      sel.appendChild(o);
    });
    const pref = (preferredEmail || '').trim().toLowerCase();
    let picked = '';
    if (pref) {
      const match = [...sel.options].find(x => (x.value || '').toLowerCase() === pref);
      if (match) {
        sel.value = match.value;
        picked = match.value;
      }
    }
    if (!picked && senders.length === 1) {
      sel.value = senders[0].email;
      picked = sel.value;
    }
    if (hint) {
      if (pref && !picked) {
        hint.textContent =
          'L’adresse enregistrée ne figure pas dans la liste actuelle. Choisissez un expéditeur vérifié côté ' +
          (senders.length ? 'fournisseur' : 'compte') +
          '.';
        hint.classList.remove('hidden');
      } else {
        hint.textContent = 'Adresses autorisées par votre fournisseur (API). Aucune saisie manuelle.';
        hint.classList.remove('hidden');
      }
    }
  }
}

function ensureFromEmailSelectChangeHook() {
  const sel = document.getElementById('fromEmailSelect');
  if (!sel || sel.dataset.fromHook === '1') return;
  sel.dataset.fromHook = '1';
  sel.addEventListener('change', refreshCampaignSendButtonState);
}

async function refreshCampaignVerifiedSenders(opts = {}) {
  const preferredEmail = opts.preferredEmail != null ? String(opts.preferredEmail) : '';
  const silent = !!opts.silent;
  const meta = getCampaignSmtpContextForVerifiedSenders();
  const hintEl = document.getElementById('fromEmailListHint');
  ensureFromEmailSelectChangeHook();

  if (!meta.supportsApi) {
    if (meta.reason === 'no_smtp') {
      applyCampaignFromEmailBlockedMode('Choisissez d’abord une configuration SMTP.');
      if (hintEl) {
        hintEl.textContent =
          'Pour Brevo, SendGrid et Amazon SES, l’expéditeur est choisi dans la liste retournée par l’API après sélection du SMTP.';
        hintEl.classList.remove('hidden');
      }
    } else {
      applyCampaignFromEmailManualMode(preferredEmail);
      if (meta.hint && hintEl) {
        hintEl.textContent = meta.hint;
        hintEl.classList.remove('hidden');
      }
    }
    refreshCampaignSendButtonState();
    return;
  }

  if (!meta.payload) {
    applyCampaignFromEmailApiMode([], '');
    if (hintEl) {
      const msg =
        meta.provider === 'ses'
          ? 'Renseignez les clés IAM et la région SES, puis cliquez sur « Actualiser ».'
          : meta.provider === 'sendgrid'
            ? 'Renseignez la clé API SendGrid, puis cliquez sur « Actualiser ».'
            : 'Renseignez la clé API Brevo, puis cliquez sur « Actualiser ».';
      hintEl.textContent = msg;
      hintEl.classList.remove('hidden');
    }
    refreshCampaignSendButtonState();
    return;
  }

  if (!silent && hintEl) {
    hintEl.textContent = 'Chargement des expéditeurs…';
    hintEl.classList.remove('hidden');
  }

  try {
    const res = await api('verified_senders', 'POST', meta.payload);
    if (!res.success) {
      throw new Error(res.error || 'Erreur API');
    }
    const senders = (res.data && res.data.senders) || [];
    applyCampaignFromEmailApiMode(senders, preferredEmail);
    if (hintEl) {
      if (silent) {
        hintEl.classList.toggle('hidden', senders.length > 0);
        hintEl.textContent = senders.length ? '' : 'Aucun expéditeur listé pour ce compte.';
      } else if (senders.length === 0) {
        const who = meta.provider === 'ses' ? 'SES' : meta.provider === 'sendgrid' ? 'SendGrid' : 'Brevo';
        hintEl.textContent = 'Aucun expéditeur actif trouvé. Vérifiez votre compte ' + who + '.';
        hintEl.classList.remove('hidden');
      } else {
        hintEl.textContent = 'Adresses autorisées par votre fournisseur (API). Aucune saisie manuelle.';
        hintEl.classList.remove('hidden');
      }
    }
  } catch (e) {
    applyCampaignFromEmailApiMode([], '');
    if (hintEl) {
      hintEl.textContent = 'Impossible de charger la liste : ' + (e.message || String(e));
      hintEl.classList.remove('hidden');
    }
    if (!silent) console.error(e);
  }
  refreshCampaignSendButtonState();
}

/** Panneau libellés (sidebar) : mémorisé entre les visites */
const SIDEBAR_PANEL_EXPANDED_KEY = 'chadmailer_sidebar_panel_expanded';

/** Persistance de la vue (F5 / Ctrl+R) : section, éditeur template, campagnes… */
const UI_STATE_STORAGE_KEY = 'chadmailer_ui_state_v1';
let uiStateRestoreInProgress = false;

function persistUiState() {
  if (uiStateRestoreInProgress) return;
  try {
    const detail = document.getElementById('campaignDetail');
    const form = document.getElementById('campaignForm');
    const templateModal = document.getElementById('templateEditorModal');
    const codePhase = document.getElementById('templateEditorPhaseCode');
    const templateEditorOpen = !!(templateModal && !templateModal.classList.contains('hidden'));
    const templateCodePhase = templateEditorOpen && !!(codePhase && !codePhase.classList.contains('hidden'));
    const tidEl = document.getElementById('templateId');

    const campaignDetailOpen = !!(detail && !detail.classList.contains('hidden'));
    const campaignFormOpen = !!(form && !form.classList.contains('hidden'));

    sessionStorage.setItem(
      UI_STATE_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        section: state.currentSection || 'dashboard',
        templateEditorOpen,
        templateCodePhase,
        editingTemplateId: templateEditorOpen ? (tidEl && tidEl.value ? tidEl.value.trim() : '') : '',
        campaignDetailOpen,
        campaignDetailId: campaignDetailOpen ? String(state.currentCampaignId || '') : '',
        campaignFormOpen,
        editingCampaignId: campaignFormOpen ? String(state.editingCampaignId || '') : ''
      })
    );
  } catch (e) {
    /* quota / private mode */
  }
}

// ============================================
// HELPER: API
// ============================================

async function api(action, method = 'GET', data = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (data) opts.body = JSON.stringify(data);
  try {
    const res = await fetch('index.php?action=' + action, opts);
    return res.json();
  } catch (err) {
    console.error('API error', action, err);
    return { success: false, error: err.message };
  }
}

function parseDomainFilters(raw) {
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(/[,;\n]+/)
    .map(s => s.trim().replace(/^@+/, '').toLowerCase())
    .filter(Boolean);
}

function tyI(name, size, cls) {
  return typeof tyIcon === 'function' ? tyIcon(name, size, cls || '') : '';
}

function tySetAccordionChevron(el, open) {
  if (!el) return;
  el.setAttribute('data-ty-icon', open ? 'chevron-down' : 'chevron-right');
  if (typeof tyHydrateIconEl === 'function') tyHydrateIconEl(el);
  else if (typeof tyIcon === 'function') {
    const sz = parseInt(el.getAttribute('data-ty-icon-size') || '18', 10);
    el.innerHTML = tyIcon(open ? 'chevron-down' : 'chevron-right', sz);
  }
}

function inferEmailColumnFromHeaders(headers) {
  if (!headers || !headers.length) return '';
  const lower = headers.map(h => String(h).toLowerCase().trim());
  const prefer = ['email', 'e-mail', 'mail', 'courriel', 'e_mail', 'email address', 'adresse email'];
  for (const p of prefer) {
    const i = lower.indexOf(p);
    if (i >= 0) return headers[i];
  }
  for (let i = 0; i < lower.length; i++) {
    if (lower[i].includes('email') || lower[i].includes('mail')) return headers[i];
  }
  return '';
}

function fillCsvColumnSelect(selectEl, headers, includeEmptyLabel) {
  if (!selectEl) return;
  const cur = selectEl.value;
  selectEl.innerHTML = '';
  const opt0 = document.createElement('option');
  opt0.value = '';
  opt0.textContent = includeEmptyLabel ? '— Ignorer —' : '— Choisir —';
  selectEl.appendChild(opt0);
  (headers || []).forEach(h => {
    const o = document.createElement('option');
    o.value = h;
    o.textContent = h;
    selectEl.appendChild(o);
  });
  if (cur && [...selectEl.options].some(o => o.value === cur)) selectEl.value = cur;
}

function populateCsvColumnSelects() {
  const h = state.csvHeaders || [];
  fillCsvColumnSelect(document.getElementById('csvEmailColumn'), h, false);
  fillCsvColumnSelect(document.getElementById('csvFirstNameColumn'), h, true);
  fillCsvColumnSelect(document.getElementById('csvLastNameColumn'), h, true);
  fillCsvColumnSelect(document.getElementById('csvFullNameColumn'), h, true);
  document.querySelectorAll('#csvCustomVarsBody .csv-custom-var-row select.csv-custom-col').forEach(sel =>
    fillCsvColumnSelect(sel, h, false)
  );
}

function showCsvMappingPanel(show) {
  const p = document.getElementById('csvMappingPanel');
  if (p) p.classList.toggle('hidden', !show);
}

function clearCsvCustomVarRows() {
  const tb = document.getElementById('csvCustomVarsBody');
  if (tb) tb.innerHTML = '';
}

function addCsvCustomVarRow(varName = '', column = '') {
  const list = document.getElementById('csvCustomVarsBody');
  if (!list) return;
  const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const row = document.createElement('div');
  row.className = 'csv-custom-var-row';
  row.innerHTML = `
    <div class="form-group csv-custom-var-field">
      <label class="csv-custom-field-label" for="csvVarName_${uid}">Nom de la variable</label>
      <input type="text" id="csvVarName_${uid}" class="csv-custom-name" placeholder="ex. ville" value="${escAttr(varName)}" autocomplete="off">
    </div>
    <div class="form-group csv-custom-var-field">
      <label class="csv-custom-field-label" for="csvVarCol_${uid}">Colonne CSV</label>
      <select id="csvVarCol_${uid}" class="csv-column-select csv-custom-col"><option value="">— Choisir —</option></select>
    </div>
    <div class="csv-custom-var-actions">
      <button type="button" class="csv-custom-remove-btn" title="Retirer cette variable" aria-label="Retirer cette variable">${tyI('trash', 18)}</button>
    </div>`;
  list.appendChild(row);
  const sel = row.querySelector('select.csv-custom-col');
  fillCsvColumnSelect(sel, state.csvHeaders || [], false);
  if (column && sel) {
    const ok = [...sel.options].some(o => o.value === column);
    if (ok) sel.value = column;
  }
  row.querySelector('.csv-custom-remove-btn')?.addEventListener('click', () => {
    row.remove();
    scheduleCsvMappingReparse();
  });
  row.querySelector('.csv-custom-name')?.addEventListener('input', scheduleCsvMappingReparse);
  sel?.addEventListener('change', scheduleCsvMappingReparse);
}

function buildColumnMappingFromForm() {
  if (state.uploadedFileType !== 'csv') return null;
  const emailCol = (document.getElementById('csvEmailColumn') || {}).value?.trim();
  if (!emailCol) return null;
  const out = { email: emailCol };
  const fn = (document.getElementById('csvFirstNameColumn') || {}).value?.trim();
  const ln = (document.getElementById('csvLastNameColumn') || {}).value?.trim();
  const nm = (document.getElementById('csvFullNameColumn') || {}).value?.trim();
  if (fn) out.first_name = fn;
  if (ln) out.last_name = ln;
  if (nm) out.name = nm;
  const custom = {};
  document.querySelectorAll('#csvCustomVarsBody .csv-custom-var-row').forEach(tr => {
    const name = tr.querySelector('.csv-custom-name')?.value?.trim();
    const col = tr.querySelector('.csv-custom-col')?.value?.trim();
    if (name && col) {
      const key = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (key) custom[key] = col;
    }
  });
  if (Object.keys(custom).length) out.custom_variables = custom;
  return out;
}

function csvMappingHasRequiredEmail() {
  if (state.uploadedFileType !== 'csv') return true;
  return !!(document.getElementById('csvEmailColumn') || {}).value?.trim();
}

function setCsvMappingWarning(msg) {
  const w = document.getElementById('csvMappingWarning');
  if (!w) return;
  if (!msg) {
    w.textContent = '';
    w.classList.add('hidden');
    return;
  }
  w.textContent = msg;
  w.classList.remove('hidden');
}

async function reparseRecipientsWithCurrentMapping() {
  if (!state.uploadedFilePath) return;
  const ft = state.uploadedFileType;
  const payload = { file_path: state.uploadedFilePath, file_type: ft };
  if (ft === 'csv') {
    const m = buildColumnMappingFromForm();
    if (!m || !m.email) {
      state.uploadedTotal = 0;
      setCsvMappingWarning('Choisissez la colonne qui contient l’adresse e-mail pour compter les destinataires.');
      const summaryEl = document.getElementById('domainSummary');
      if (summaryEl) {
        summaryEl.classList.add('hidden');
        summaryEl.textContent = '';
      }
      document.getElementById('domainFilters')?.classList.add('hidden');
      updateUploadFileHint();
      refreshCampaignSendButtonState();
      return;
    }
    payload.column_mapping = m;
    setCsvMappingWarning('');
  }

  const parseRes = await api('parse_recipients', 'POST', payload);
  if (!parseRes.success) {
    alert('Erreur parsing: ' + (parseRes.error || ''));
    return;
  }
  state.uploadedTotal = parseRes.data.total || 0;
  if (ft === 'csv' && parseRes.data.headers && parseRes.data.headers.length) {
    state.csvHeaders = parseRes.data.headers;
    populateCsvColumnSelects();
  }
  const domains = parseRes.data.domains || {};
  const summaryEl = document.getElementById('domainSummary');
  if (summaryEl) {
    const parts = Object.entries(domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([domain, count]) => `${capitalize(domain)}: ${count.toLocaleString()}`);
    summaryEl.textContent = parts.join(' | ') + ` (Total: ${state.uploadedTotal.toLocaleString()})`;
    summaryEl.classList.toggle('hidden', state.uploadedTotal === 0);
  }
  document.getElementById('domainFilters')?.classList.toggle('hidden', state.uploadedTotal === 0);
  updateUploadFileHint();
  refreshCampaignSendButtonState();
}

function scheduleCsvMappingReparse() {
  if (state.csvMappingReparseTimer) clearTimeout(state.csvMappingReparseTimer);
  state.csvMappingReparseTimer = setTimeout(() => {
    state.csvMappingReparseTimer = null;
    reparseRecipientsWithCurrentMapping();
  }, 400);
}

function applyColumnMappingToForm(mapping) {
  if (!mapping || typeof mapping !== 'object') return;
  const setSel = (id, val) => {
    const el = document.getElementById(id);
    if (el && val && [...el.options].some(o => o.value === val)) el.value = val;
  };
  setSel('csvEmailColumn', mapping.email);
  setSel('csvFirstNameColumn', mapping.first_name);
  setSel('csvLastNameColumn', mapping.last_name);
  setSel('csvFullNameColumn', mapping.name);
  clearCsvCustomVarRows();
  const cv = mapping.custom_variables;
  if (cv && typeof cv === 'object') {
    Object.entries(cv).forEach(([k, col]) => addCsvCustomVarRow(k, col));
  }
}

function initCsvMappingUI() {
  document.getElementById('csvAddCustomVarBtn')?.addEventListener('click', () => {
    addCsvCustomVarRow();
    scheduleCsvMappingReparse();
  });
  ['csvEmailColumn', 'csvFirstNameColumn', 'csvLastNameColumn', 'csvFullNameColumn'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', scheduleCsvMappingReparse);
  });
}

/** Config à fusionner côté serveur : évite d’écraser file_path / SMTP avec des valeurs vides (ex. après parse échoué). */
function mergeSafeCampaignConfigForPut() {
  const c = collectCampaignConfig();
  if (!c.file_path) delete c.file_path;
  if (!c.smtp_config_id && (!Array.isArray(c.smtp_rotation_ids) || c.smtp_rotation_ids.length === 0)) {
    delete c.smtp_config_id;
  }
  return c;
}

function countSelectedTemplates() {
  return document.querySelectorAll('.template-chip.selected').length;
}

/**
 * Nouvelle campagne : envoi activé seulement après analyse (score ≥ 50 ou lien forcé).
 * Édition : pas besoin de ré-analyser — activer dès que liste + templates + SMTP sont prêts.
 */
function refreshCampaignSendButtonState() {
  const sendBtn = document.getElementById('sendBtn');
  const forceSendLink = document.getElementById('forceSendLink');
  if (!sendBtn) return;
  const cfg = collectCampaignConfig();
  syncCampaignFromEmailVisibility(cfg);

  const hasFile = !!state.uploadedFilePath;
  const hasTemplates = countSelectedTemplates() > 0;
  const smtpSel = document.getElementById('smtpConfigSelect');
  const smtpVal = smtpSel && smtpSel.value;
  const rotationEnabled = !!document.getElementById('smtpRotationEnabled')?.checked;
  const selectedRot = getSelectedSmtpRotationIds();
  const hasSmtp = rotationEnabled ? selectedRot.length > 0 : !!(smtpVal && smtpVal !== '__new__');
  const csvOk = csvMappingHasRequiredEmail();
  const hasRecipients = (state.uploadedTotal || 0) > 0;

  const hasFrom = hasUsableFromEmail(cfg);

  if (state.editingCampaignId) {
    const canSend = hasFile && csvOk && hasRecipients && hasTemplates && hasSmtp && hasFrom;
    sendBtn.disabled = !canSend;
    sendBtn.classList.toggle('btn-disabled', !canSend);
    if (forceSendLink) forceSendLink.classList.add('hidden');
    return;
  }

  const baseOk = hasFile && csvOk && hasRecipients && hasTemplates && hasSmtp && hasFrom;
  if (!baseOk) {
    sendBtn.disabled = true;
    sendBtn.classList.add('btn-disabled');
    if (forceSendLink) forceSendLink.classList.add('hidden');
    return;
  }

  if (state.scoreData && state.scoreData.score >= 50) {
    sendBtn.disabled = false;
    sendBtn.classList.remove('btn-disabled');
    if (forceSendLink) forceSendLink.classList.add('hidden');
  } else if (state.scoreData && state.scoreData.score < 50) {
    sendBtn.disabled = true;
    sendBtn.classList.add('btn-disabled');
    if (forceSendLink) forceSendLink.classList.remove('hidden');
  } else {
    sendBtn.disabled = true;
    sendBtn.classList.add('btn-disabled');
    if (forceSendLink) forceSendLink.classList.add('hidden');
  }
}

/** Ouvre une section du formulaire campagne (le bouton Envoi est dans « analyze », souvent replié). */
function openCampaignFormAccordionSection(dataSection) {
  const form = document.getElementById('campaignForm');
  if (!form) return;
  form.querySelectorAll('.accordion-section').forEach(sec => {
    const body = sec.querySelector('.accordion-body');
    const chev = sec.querySelector('.accordion-chevron');
    const isTarget = sec.getAttribute('data-section') === dataSection;
    if (body) body.classList.toggle('hidden', !isTarget);
    if (chev) tySetAccordionChevron(chev, isTarget);
    sec.classList.toggle('open', isTarget);
  });
}

function collectCampaignConfig(extra = {}) {
  const chips = document.querySelectorAll('.template-chip.selected');
  const templateIds = Array.from(chips).map(c => c.dataset.id).filter(Boolean);
  const smtpSelect = document.getElementById('smtpConfigSelect');
  let smtpId = '';
  if (smtpSelect && smtpSelect.value && smtpSelect.value !== '__new__') {
    smtpId = smtpSelect.value;
  }
  const domainRaw = (document.getElementById('domainFilterInput') || {}).value || '';
  const gmailEl = document.getElementById('gmailLastToggle');
  const keepDupEl = document.getElementById('campaignKeepDuplicateEmails');
  const rotationEl = document.getElementById('rotationFrequency');
  const smtpRotationEnabledEl = document.getElementById('smtpRotationEnabled');
  const smtpRotationEveryEl = document.getElementById('smtpRotationEvery');
  const smtpRotationModeEl = document.getElementById('smtpRotationMode');
  const smtpSenderModeEl = document.getElementById('smtpSenderMode');
  const smtpFromNameModeEl = document.getElementById('smtpFromNameMode');
  const smtpRotationEnabled = !!(smtpRotationEnabledEl && smtpRotationEnabledEl.checked);
  const smtpRotationIds = getSelectedSmtpRotationIds();
  if (smtpRotationEnabled && smtpRotationIds.length === 0 && smtpId) smtpRotationIds.push(smtpId);
  const smtpSenderMode = smtpSenderModeEl && smtpSenderModeEl.value === 'per_smtp' ? 'per_smtp' : 'default';
  const smtpFromNameMode = smtpFromNameModeEl && smtpFromNameModeEl.value === 'per_smtp' ? 'per_smtp' : 'global';
  const smtpPerSmtp = collectSmtpPerSenderMapFromUi();
  const delayMinEl = document.getElementById('delayMin');
  const delayMaxEl = document.getElementById('delayMax');
  const parseDelaySec = el => {
    if (!el || String(el.value).trim() === '') return null;
    const n = parseFloat(String(el.value).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  let delayMin = parseDelaySec(delayMinEl);
  if (delayMin === null) delayMin = 1;
  delayMin = Math.max(0, delayMin);
  let delayMax = parseDelaySec(delayMaxEl);
  if (delayMax === null) delayMax = 3;
  delayMax = Math.max(0, delayMax);
  if (delayMax < delayMin) delayMax = delayMin;

  const base = {
    template_ids: templateIds,
    from_email: getFromEmailValue(),
    from_name: (document.getElementById('fromName') || {}).value.trim() || '',
    smtp_config_id: smtpId,
    file_path: state.uploadedFilePath,
    file_type: state.uploadedFileType || 'csv',
    total_recipients: state.uploadedTotal,
    unsubscribe_url: localStorage.getItem('tydra_unsub_url') || '',
    delay_min: delayMin,
    delay_max: delayMax,
    domain_filters: parseDomainFilters(domainRaw),
    gmail_last: !!(gmailEl && gmailEl.checked),
    deduplicate_recipients: !(keepDupEl && keepDupEl.checked),
    template_rotation_frequency: Math.max(1, parseInt(rotationEl && rotationEl.value, 10) || 1),
    smtp_rotation_enabled: smtpRotationEnabled,
    smtp_rotation_ids: smtpRotationEnabled ? smtpRotationIds : [],
    smtp_rotation_every: Math.max(1, parseInt(smtpRotationEveryEl && smtpRotationEveryEl.value, 10) || 1),
    smtp_rotation_mode: (smtpRotationModeEl && smtpRotationModeEl.value === 'parallel') ? 'parallel' : 'sequential',
    smtp_sender_mode: smtpSenderMode,
    smtp_from_name_mode: smtpFromNameMode,
    smtp_per_smtp: smtpPerSmtp,
    ...extra
  };
  if (smtpRotationEnabled && smtpRotationIds.length > 0 && !smtpId) {
    base.smtp_config_id = smtpRotationIds[0];
  }
  const cm = buildColumnMappingFromForm();
  if (state.uploadedFileType === 'csv' && cm && cm.email) {
    base.column_mapping = cm;
  }
  return base;
}

/** Sous-ensemble pour l’API template_preview_merge (liste + filtres). */
function collectPreviewListConfigOnly() {
  const full = collectCampaignConfig();
  const o = {
    file_path: full.file_path || '',
    file_type: full.file_type || 'csv',
    domain_filters: full.domain_filters || [],
    gmail_last: !!full.gmail_last,
    deduplicate_recipients: full.deduplicate_recipients !== false
  };
  if (full.column_mapping) o.column_mapping = full.column_mapping;
  return o;
}

function updateUploadFileHint() {
  const hint = document.getElementById('uploadFileHint');
  if (!hint) return;
  if (state.uploadedFilePath) {
    const short = state.uploadedFilePath.split('/').pop() || state.uploadedFilePath;
    hint.textContent = `Fichier : ${short} — ${(state.uploadedTotal || 0).toLocaleString('fr-FR')} destinataire(s)`;
    hint.classList.remove('hidden');
  } else {
    hint.textContent = '';
    hint.classList.add('hidden');
  }
}

async function ensureSmtpConfigs() {
  if (state.smtpConfigs && state.smtpConfigs.length) return;
  const res = await api('smtp_configs');
  if (res.success) state.smtpConfigs = res.data || [];
}

function smtpLabelForId(id) {
  if (!id) return '—';
  const c = (state.smtpConfigs || []).find(s => String(s.id) === String(id));
  return c ? (c.name || c.host || c.id) : id;
}

function getSelectedSmtpRotationIds() {
  const wrap = document.getElementById('smtpRotationSelect');
  if (!wrap) return [];
  return Array.from(wrap.querySelectorAll('input[type="checkbox"][data-smtp-id]:checked'))
    .map(el => String(el.getAttribute('data-smtp-id') || ''))
    .filter(Boolean);
}

function setSelectedSmtpRotationIds(ids) {
  const wanted = new Set((ids || []).map(String));
  const wrap = document.getElementById('smtpRotationSelect');
  if (!wrap) return;
  Array.from(wrap.querySelectorAll('input[type="checkbox"][data-smtp-id]')).forEach(cb => {
    cb.checked = wanted.has(String(cb.getAttribute('data-smtp-id') || ''));
  });
}

function getSenderRoutingSmtpIds() {
  const rotationEnabled = !!document.getElementById('smtpRotationEnabled')?.checked;
  const ids = rotationEnabled
    ? getSelectedSmtpRotationIds()
    : [String(document.getElementById('smtpConfigSelect')?.value || '')];
  return ids
    .map(String)
    .filter(id => id && id !== '__new__')
    .filter((id, idx, arr) => arr.indexOf(id) === idx);
}

function collectSmtpPerSenderMapFromUi() {
  const wrap = document.getElementById('smtpSenderOverridesList');
  if (!wrap) return {};
  const out = {};
  wrap.querySelectorAll('[data-smtp-sender-item]').forEach(item => {
    const smtpId = String(item.getAttribute('data-smtp-id') || '').trim();
    if (!smtpId) return;
    const useDefaultFrom = !!item.querySelector('input[data-smtp-use-default-from]')?.checked;
    const fromEmail = String(item.querySelector('input[data-smtp-from-email]')?.value || '').trim();
    const useGlobalName = !!item.querySelector('input[data-smtp-use-global-name]')?.checked;
    const fromName = String(item.querySelector('input[data-smtp-from-name]')?.value || '').trim();
    out[smtpId] = {
      use_default_from: useDefaultFrom,
      from_email: fromEmail,
      use_global_name: useGlobalName,
      from_name: fromName
    };
  });
  return out;
}

function renderSmtpSenderOverridesList(preferredMap = null) {
  const wrap = document.getElementById('smtpSenderOverridesList');
  if (!wrap) return;
  const ids = getSenderRoutingSmtpIds();
  const remembered = preferredMap && typeof preferredMap === 'object'
    ? preferredMap
    : collectSmtpPerSenderMapFromUi();
  const senderMode = document.getElementById('smtpSenderMode')?.value === 'per_smtp' ? 'per_smtp' : 'default';
  const nameMode = document.getElementById('smtpFromNameMode')?.value === 'per_smtp' ? 'per_smtp' : 'global';
  if (ids.length === 0) {
    wrap.innerHTML = '<p class="field-hint">Select SMTP to configure sender routing.</p>';
    return;
  }
  wrap.innerHTML = ids.map(id => {
    const smtp = (state.smtpConfigs || []).find(s => String(s.id) === String(id));
    const label = escHtml(smtp ? (smtp.name || smtp.host || ('Config ' + id)) : id);
    const override = remembered && typeof remembered === 'object' ? (remembered[id] || {}) : {};
    const useDefaultFrom = override.use_default_from !== false;
    const useGlobalName = override.use_global_name !== false;
    const fromEmail = escAttr(override.from_email || '');
    const fromName = escAttr(override.from_name || '');
    const emailInputDisabled = senderMode !== 'per_smtp' || useDefaultFrom ? ' disabled' : '';
    const nameInputDisabled = nameMode !== 'per_smtp' || useGlobalName ? ' disabled' : '';
    return `
      <div class="smtp-sender-override-item" data-smtp-sender-item data-smtp-id="${escAttr(id)}">
        <div class="smtp-sender-override-head">
          <span class="smtp-sender-override-title">${label}</span>
          <div class="smtp-sender-override-toggles">
            <label class="smtp-sender-override-toggle" data-smtp-use-default-from-toggle>
              <input type="checkbox" data-smtp-use-default-from${useDefaultFrom ? ' checked' : ''}${senderMode !== 'per_smtp' ? ' disabled' : ''}>
              <span>Use default From email</span>
            </label>
            <label class="smtp-sender-override-toggle">
              <input type="checkbox" data-smtp-use-global-name${useGlobalName ? ' checked' : ''}${nameMode !== 'per_smtp' ? ' disabled' : ''}>
              <span>Use global sender name</span>
            </label>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group${senderMode !== 'per_smtp' ? ' hidden' : ''}" data-smtp-from-email-group>
            <label>From email override</label>
            <input type="email" data-smtp-from-email placeholder="sender@domain.com" value="${fromEmail}"${emailInputDisabled}>
          </div>
          <div class="form-group${nameMode !== 'per_smtp' ? ' hidden' : ''}" data-smtp-from-name-group>
            <label>From name override</label>
            <input type="text" data-smtp-from-name placeholder="Optional" value="${fromName}"${nameInputDisabled}>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function syncSmtpSenderOverridesDisabledState() {
  const senderMode = document.getElementById('smtpSenderMode')?.value === 'per_smtp' ? 'per_smtp' : 'default';
  const nameMode = document.getElementById('smtpFromNameMode')?.value === 'per_smtp' ? 'per_smtp' : 'global';
  const wrap = document.getElementById('smtpSenderOverridesList');
  if (!wrap) return;
  wrap.querySelectorAll('[data-smtp-sender-item]').forEach(item => {
    const useDefaultFromEl = item.querySelector('input[data-smtp-use-default-from]');
    const useGlobalNameEl = item.querySelector('input[data-smtp-use-global-name]');
    const fromEmailEl = item.querySelector('input[data-smtp-from-email]');
    const fromNameEl = item.querySelector('input[data-smtp-from-name]');
    const useDefaultFromToggle = item.querySelector('[data-smtp-use-default-from-toggle]');
    const fromEmailGroupEl = item.querySelector('[data-smtp-from-email-group]');
    const fromNameGroupEl = item.querySelector('[data-smtp-from-name-group]');
    if (useDefaultFromEl) useDefaultFromEl.disabled = senderMode !== 'per_smtp';
    if (useGlobalNameEl) useGlobalNameEl.disabled = nameMode !== 'per_smtp';
    if (fromEmailEl) fromEmailEl.disabled = senderMode !== 'per_smtp' || !!useDefaultFromEl?.checked;
    if (fromNameEl) fromNameEl.disabled = nameMode !== 'per_smtp' || !!useGlobalNameEl?.checked;
    if (useDefaultFromToggle) useDefaultFromToggle.classList.toggle('hidden', senderMode !== 'per_smtp');
    if (fromEmailGroupEl) fromEmailGroupEl.classList.toggle('hidden', senderMode !== 'per_smtp');
    if (fromNameGroupEl) fromNameGroupEl.classList.toggle('hidden', nameMode !== 'per_smtp');
  });
}

function setSenderRoutingUiFromConfig(cfg = {}) {
  const senderModeEl = document.getElementById('smtpSenderMode');
  const fromNameModeEl = document.getElementById('smtpFromNameMode');
  if (senderModeEl) senderModeEl.value = cfg.smtp_sender_mode === 'per_smtp' ? 'per_smtp' : 'default';
  if (fromNameModeEl) fromNameModeEl.value = cfg.smtp_from_name_mode === 'per_smtp' ? 'per_smtp' : 'global';
  renderSmtpSenderOverridesList(cfg.smtp_per_smtp && typeof cfg.smtp_per_smtp === 'object' ? cfg.smtp_per_smtp : {});
  syncSmtpSenderOverridesDisabledState();
}

function renderSmtpRotationChecklist(preferredIds = []) {
  const wrap = document.getElementById('smtpRotationSelect');
  if (!wrap) return;
  const preferred = new Set((preferredIds || []).map(String));
  wrap.innerHTML = (state.smtpConfigs || []).map(s => {
    const id = String(s.id || '');
    const label = escHtml(s.name || s.host || ('Config ' + id));
    const checked = preferred.has(id) ? ' checked' : '';
    return `
      <label class="smtp-rotation-check-item">
        <input type="checkbox" data-smtp-id="${escAttr(id)}"${checked}>
        <span class="smtp-rotation-check-label">${label}</span>
      </label>
    `;
  }).join('');
}

function updateSmtpSelectionUiMode() {
  const enabled = !!document.getElementById('smtpRotationEnabled')?.checked;
  const primaryGroup = document.getElementById('smtpPrimaryConfigGroup');
  if (primaryGroup) primaryGroup.classList.toggle('hidden', enabled);
}

function syncRotationSelectionWithPrimarySmtp() {
  const enabled = !!document.getElementById('smtpRotationEnabled')?.checked;
  if (enabled) {
    const primary = document.getElementById('smtpConfigSelect')?.value;
    const ids = getSelectedSmtpRotationIds();
    if (ids.length > 0) {
      const sel = document.getElementById('smtpConfigSelect');
      if (sel && ids[0] !== '__new__') sel.value = ids[0];
      toggleCampaignSmtpNewPanel(false);
    } else if (primary && primary !== '__new__') {
      setSelectedSmtpRotationIds([primary]);
    }
  }
  renderSmtpSenderOverridesList();
  syncSmtpSenderOverridesDisabledState();
}

function setSmtpRotationUiFromConfig(cfg = {}) {
  const enabled = !!cfg.smtp_rotation_enabled;
  const enabledEl = document.getElementById('smtpRotationEnabled');
  const panel = document.getElementById('smtpRotationPanel');
  if (enabledEl) enabledEl.checked = enabled;
  if (panel) panel.classList.toggle('hidden', !enabled);
  updateSmtpSelectionUiMode();
  const everyEl = document.getElementById('smtpRotationEvery');
  if (everyEl) everyEl.value = String(Math.max(1, parseInt(cfg.smtp_rotation_every, 10) || 1));
  const modeEl = document.getElementById('smtpRotationMode');
  if (modeEl) modeEl.value = cfg.smtp_rotation_mode === 'parallel' ? 'parallel' : 'sequential';
  const ids = Array.isArray(cfg.smtp_rotation_ids) ? cfg.smtp_rotation_ids : [];
  setSelectedSmtpRotationIds(ids.map(String));
  syncRotationSelectionWithPrimarySmtp();
}

function formatSmtpRoutingLabel(cfg = {}) {
  const ids = Array.isArray(cfg.smtp_rotation_ids) ? cfg.smtp_rotation_ids.map(String).filter(Boolean) : [];
  if (cfg.smtp_rotation_enabled && ids.length > 0) {
    const labels = ids.map(id => smtpLabelForId(id));
    const mode = cfg.smtp_rotation_mode === 'parallel' ? 'Parallèle' : 'Séquentiel';
    const every = Math.max(1, parseInt(cfg.smtp_rotation_every, 10) || 1);
    return `Rotation ${mode} (x${labels.length}, tous les ${every} e-mail(s)) : ${labels.join(', ')}`;
  }
  return smtpLabelForId(cfg.smtp_config_id);
}

function listSmtpIdsFromConfig(cfg = {}) {
  if (cfg.smtp_rotation_enabled && Array.isArray(cfg.smtp_rotation_ids) && cfg.smtp_rotation_ids.length > 0) {
    return cfg.smtp_rotation_ids.map(String).filter(Boolean);
  }
  if (cfg.smtp_config_id) return [String(cfg.smtp_config_id)];
  return [];
}

function getSmtpConfigById(id) {
  return (state.smtpConfigs || []).find(s => String(s.id) === String(id)) || null;
}

function getImplicitFromEmailForSmtpConfig(smtpConfig) {
  if (!smtpConfig || typeof smtpConfig !== 'object') return '';
  const provider = String(smtpConfig.provider || '').toLowerCase();
  if (provider !== 'smtp' && provider !== 'office365') return '';
  return String(smtpConfig.username || '').trim();
}

function canAutoResolveDefaultFromFromSmtp(config = {}) {
  if (!config.smtp_rotation_enabled) return false;
  if (config.smtp_sender_mode === 'per_smtp') return false;
  const ids = listSmtpIdsFromConfig(config);
  if (ids.length === 0) return false;
  return ids.every(id => getImplicitFromEmailForSmtpConfig(getSmtpConfigById(id)) !== '');
}

function syncCampaignFromEmailVisibility(config = null) {
  const group = document.getElementById('fromEmailGroup');
  if (!group) return;
  const cfg = config && typeof config === 'object' ? config : collectCampaignConfig();
  group.classList.toggle('hidden', canAutoResolveDefaultFromFromSmtp(cfg));
}

function hasUsableFromEmail(config = {}) {
  const globalFrom = String(config.from_email || '').trim();
  if (globalFrom) return true;
  const ids = listSmtpIdsFromConfig(config);
  if (ids.length === 0) return false;
  if (config.smtp_sender_mode !== 'per_smtp') {
    return ids.every(id => getImplicitFromEmailForSmtpConfig(getSmtpConfigById(id)) !== '');
  }
  const per = config.smtp_per_smtp && typeof config.smtp_per_smtp === 'object' ? config.smtp_per_smtp : {};
  return ids.every(id => {
    const row = per[id];
    if (!row || typeof row !== 'object') return false;
    if (row.use_default_from !== false) {
      return getImplicitFromEmailForSmtpConfig(getSmtpConfigById(id)) !== '';
    }
    return String(row.from_email || '').trim() !== '';
  });
}

function formatSenderRoutingLabel(cfg = {}) {
  const base = cfg.from_name
    ? `${String(cfg.from_name)} <${String(cfg.from_email || '')}>`
    : String(cfg.from_email || '—');
  const senderMode = cfg.smtp_sender_mode === 'per_smtp' ? 'per SMTP from email' : 'default from email';
  const fromNameMode = cfg.smtp_from_name_mode === 'per_smtp' ? 'per SMTP sender name' : 'global sender name';
  return `${base} (${senderMode}, ${fromNameMode})`;
}

function setCampaignFormEditMode(isEdit) {
  const banner = document.getElementById('campaignEditBanner');
  const title = document.getElementById('campaignFormTitle');
  const sub = document.getElementById('campaignFormSubtitle');
  const sendBtn = document.getElementById('sendBtn');
  if (banner) banner.classList.toggle('hidden', !isEdit);
  if (title) title.textContent = isEdit ? 'Modifier la campagne' : 'Nouvelle campagne';
  if (sub) {
    sub.textContent = isEdit
      ? 'Ajustez la liste, l’expéditeur, le SMTP ou les templates, enregistrez puis lancez l’envoi pour appliquer les changements.'
      : 'Importez une liste, choisissez vos templates, configurez l’expéditeur et le SMTP, puis analysez ou envoyez.';
  }
  if (sendBtn) {
    const label = isEdit ? 'Enregistrer & lancer l’envoi' : 'Lancer l’envoi';
    sendBtn.innerHTML = tyI('send', 20) + '<span class="ty-btn-txt">' + escHtml(label) + '</span>';
  }
}

function resetNewCampaignForm() {
  state.editingCampaignId = null;
  setCampaignFormEditMode(false);
  const ids = ['campaignName', 'fromName', 'domainFilterInput'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  applyCampaignFromEmailBlockedMode('Choisissez d’abord une configuration SMTP.');
  const delayMin = document.getElementById('delayMin');
  const delayMax = document.getElementById('delayMax');
  if (delayMin) delayMin.value = '1';
  if (delayMax) delayMax.value = '3';
  const gmail = document.getElementById('gmailLastToggle');
  if (gmail) gmail.checked = false;
  const keepDup = document.getElementById('campaignKeepDuplicateEmails');
  if (keepDup) keepDup.checked = false;
  const rot = document.getElementById('rotationFrequency');
  if (rot) rot.value = '1';
  const smtp = document.getElementById('smtpConfigSelect');
  if (smtp) smtp.value = '';
  setSmtpRotationUiFromConfig({
    smtp_rotation_enabled: false,
    smtp_rotation_ids: [],
    smtp_rotation_every: 1,
    smtp_rotation_mode: 'sequential'
  });
  setSenderRoutingUiFromConfig({
    smtp_sender_mode: 'default',
    smtp_from_name_mode: 'global',
    smtp_per_smtp: {}
  });
  const campPanel = document.getElementById('campaignSmtpNewPanel');
  if (campPanel) campPanel.classList.add('hidden');
  clearCampSmtpForm();
  const fileInput = document.getElementById('recipientsFile');
  if (fileInput) fileInput.value = '';
  state.uploadedFilePath = null;
  state.uploadedFileType = null;
  state.uploadedTotal = 0;
  state.csvHeaders = [];
  clearCsvCustomVarRows();
  showCsvMappingPanel(false);
  setCsvMappingWarning('');
  ['csvEmailColumn', 'csvFirstNameColumn', 'csvLastNameColumn', 'csvFullNameColumn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<option value="">' + (id === 'csvEmailColumn' ? '— Choisir —' : '— Ignorer —') + '</option>';
  });
  updateUploadFileHint();
  document.querySelectorAll('.template-chip.selected').forEach(c => c.classList.remove('selected'));
  const summaryEl = document.getElementById('domainSummary');
  if (summaryEl) {
    summaryEl.textContent = '';
    summaryEl.classList.add('hidden');
  }
  const filtersEl = document.getElementById('domainFilters');
  if (filtersEl) filtersEl.classList.add('hidden');
  const scoreDisplay = document.getElementById('scoreDisplay');
  if (scoreDisplay) {
    scoreDisplay.classList.add('hidden');
    scoreDisplay.innerHTML = '';
  }
  const sendBtn = document.getElementById('sendBtn');
  const forceLink = document.getElementById('forceSendLink');
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.classList.add('btn-disabled');
  }
  if (forceLink) forceLink.classList.add('hidden');
  state.scoreData = null;
}

async function backToCampaignListFromForm() {
  if (state.editingCampaignId) {
    const nameEl = document.getElementById('campaignName');
    const name = nameEl ? nameEl.value.trim() : 'Campagne';
    const config = mergeSafeCampaignConfigForPut();
    const putRes = await api(
      'campaign&id=' + encodeURIComponent(state.editingCampaignId),
      'PUT',
      { name, config }
    );
    if (!putRes.success) {
      alert('Impossible d’enregistrer la campagne : ' + (putRes.error || ''));
      return;
    }
  }

  document.getElementById('campaignForm').classList.add('hidden');
  document.getElementById('campaignsList').classList.remove('hidden');
  document.getElementById('newCampaignBtn').classList.remove('hidden');
  resetNewCampaignForm();
  loadCampaigns();
}

function initUploadDragDrop() {
  const zone = document.getElementById('uploadZone');
  const input = document.getElementById('recipientsFile');
  if (!zone || !input) return;

  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  ['dragenter', 'dragover'].forEach(ev => {
    zone.addEventListener(ev, (e) => {
      stop(e);
      zone.classList.add('drag-active');
    });
  });

  ['dragleave', 'drop'].forEach(ev => {
    zone.addEventListener(ev, (e) => {
      stop(e);
      zone.classList.remove('drag-active');
    });
  });

  zone.addEventListener('drop', (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    const dt = new DataTransfer();
    dt.items.add(files[0]);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function openEditCampaign(campaignId) {
  const res = await api('campaign&id=' + encodeURIComponent(campaignId));
  if (!res.success || !res.data) {
    alert('Impossible de charger la campagne.');
    return;
  }
  const c = res.data;
  if (c.status === 'running') {
    alert('Impossible de modifier une campagne en cours. Mettez-la en pause ou arrêtez-la d’abord.');
    return;
  }

  state.scoreData = null;
  state.editingCampaignId = campaignId;
  setCampaignFormEditMode(true);

  const list = document.getElementById('campaignsList');
  const form = document.getElementById('campaignForm');
  const detail = document.getElementById('campaignDetail');
  const newBtn = document.getElementById('newCampaignBtn');
  if (list) list.classList.add('hidden');
  if (detail) detail.classList.add('hidden');
  if (form) form.classList.remove('hidden');
  if (newBtn) newBtn.classList.add('hidden');
  document.getElementById('campaignsEmptyState')?.classList.add('hidden');
  stopCampaignMonitor();

  const cfg = c.config || {};
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v != null && v !== '' ? v : '';
  };

  setVal('campaignName', c.name || '');
  setVal('fromName', cfg.from_name || '');
  setVal('delayMin', cfg.delay_min != null ? cfg.delay_min : 1);
  setVal('delayMax', cfg.delay_max != null ? cfg.delay_max : 3);
  const gmailEl = document.getElementById('gmailLastToggle');
  if (gmailEl) gmailEl.checked = !!cfg.gmail_last;
  const keepDupEl = document.getElementById('campaignKeepDuplicateEmails');
  if (keepDupEl) keepDupEl.checked = cfg.deduplicate_recipients === false;
  const rot = document.getElementById('rotationFrequency');
  if (rot) rot.value = String(cfg.template_rotation_frequency || 1);
  setSmtpRotationUiFromConfig(cfg);

  const df = cfg.domain_filters || [];
  const domainInput = document.getElementById('domainFilterInput');
  if (domainInput) {
    domainInput.value = Array.isArray(df) && df.length
      ? df.map(d => (String(d).startsWith('@') ? d : '@' + d)).join(', ')
      : '';
  }

  await populateTemplateChips();
  await populateSmtpSelect(cfg.smtp_config_id || null, {
    preferredFromEmail: cfg.from_email || '',
    preferredRotationIds: Array.isArray(cfg.smtp_rotation_ids) ? cfg.smtp_rotation_ids : [],
    preferredSenderMap: cfg.smtp_per_smtp && typeof cfg.smtp_per_smtp === 'object' ? cfg.smtp_per_smtp : {}
  });
  setSenderRoutingUiFromConfig(cfg);
  document.getElementById('campaignSmtpNewPanel')?.classList.add('hidden');

  const templateIds = (cfg.template_ids || []).map(String);
  document.querySelectorAll('.template-chip').forEach(chip => {
    chip.classList.toggle('selected', templateIds.includes(String(chip.dataset.id)));
  });

  state.uploadedFilePath = cfg.file_path || null;
  state.uploadedFileType = cfg.file_type || 'csv';
  state.uploadedTotal = cfg.total_recipients || 0;

  if (state.uploadedFilePath) {
    if (state.uploadedFileType === 'csv') {
      const peekRes = await api('parse_recipients', 'POST', {
        file_path: state.uploadedFilePath,
        file_type: 'csv'
      });
      if (!peekRes.success) {
        state.uploadedFilePath = null;
        state.uploadedTotal = 0;
        alert('Le fichier d’origine est introuvable. Importez une nouvelle liste.');
      } else {
        state.csvHeaders = peekRes.data.headers || [];
        showCsvMappingPanel(state.csvHeaders.length > 0);
        populateCsvColumnSelects();
        if (cfg.column_mapping && typeof cfg.column_mapping === 'object') {
          applyColumnMappingToForm(cfg.column_mapping);
        } else {
          const guess = inferEmailColumnFromHeaders(state.csvHeaders);
          const em = document.getElementById('csvEmailColumn');
          if (em && guess && [...em.options].some(o => o.value === guess)) em.value = guess;
        }
        await reparseRecipientsWithCurrentMapping();
      }
    } else {
      showCsvMappingPanel(false);
      clearCsvCustomVarRows();
      state.csvHeaders = [];
      setCsvMappingWarning('');
      const parseRes = await api('parse_recipients', 'POST', {
        file_path: state.uploadedFilePath,
        file_type: 'txt'
      });
      if (parseRes.success) {
        state.uploadedTotal = parseRes.data.total || state.uploadedTotal;
        const domains = parseRes.data.domains || {};
        const summaryEl = document.getElementById('domainSummary');
        if (summaryEl) {
          const parts = Object.entries(domains)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([domain, count]) => `${capitalize(domain)}: ${count.toLocaleString()}`);
          summaryEl.textContent = parts.join(' | ') + ` (Total: ${state.uploadedTotal.toLocaleString()})`;
          summaryEl.classList.toggle('hidden', state.uploadedTotal === 0);
        }
        document.getElementById('domainFilters')?.classList.toggle('hidden', state.uploadedTotal === 0);
      } else {
        state.uploadedFilePath = null;
        state.uploadedTotal = 0;
        alert('Le fichier d’origine est introuvable. Importez une nouvelle liste.');
      }
    }
  } else {
    state.csvHeaders = [];
    clearCsvCustomVarRows();
    showCsvMappingPanel(false);
    setCsvMappingWarning('');
    const summaryEl = document.getElementById('domainSummary');
    if (summaryEl) {
      summaryEl.classList.add('hidden');
      summaryEl.textContent = '';
    }
    document.getElementById('domainFilters')?.classList.add('hidden');
  }

  updateUploadFileHint();
  refreshCampaignSendButtonState();
  const sendBtnAfterLoad = document.getElementById('sendBtn');
  if (state.editingCampaignId && sendBtnAfterLoad && !sendBtnAfterLoad.disabled) {
    openCampaignFormAccordionSection('analyze');
  }
}

function setSmtpApiKeyUiForProvider(provider, labelId, inputId) {
  const label = document.getElementById(labelId);
  const input = document.getElementById(inputId);
  if (!label || !input) return;
  const map = {
    brevo: { t: 'Clé API', ph: 'xkeysib-…' },
    sendgrid: { t: 'Clé API SendGrid', ph: 'SG.xxx…' },
    postmark: { t: 'Jeton serveur Postmark', ph: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    mailgun: { t: 'Clé API privée Mailgun', ph: 'key-…' }
  };
  const m = map[provider] || { t: 'Clé API', ph: '…' };
  label.textContent = m.t;
  input.placeholder = m.ph;
}

function applyMicrosoft365SmtpDefaults(hostId, portId, userId) {
  const host = document.getElementById(hostId);
  const port = document.getElementById(portId);
  const user = userId ? document.getElementById(userId) : null;
  if (host && !String(host.value || '').trim()) host.value = 'smtp.office365.com';
  const pv = port ? String(port.value || '').trim() : '';
  if (port && (!pv || pv === '0')) port.value = '587';
  if (user) user.placeholder = 'adresse@domaine.com (compte Microsoft 365)';
}

function toggleCampSmtpFields(provider) {
  const apiKeyGroup = document.getElementById('campSmtpApiKeyGroup');
  const sesGroup = document.getElementById('campSmtpSesGroup');
  const o365 = document.getElementById('campSmtpOffice365Group');
  const credFields = document.querySelectorAll('.camp-smtp-credentials');
  const isSes = provider === 'ses';
  const isSmtpLike = provider === 'smtp' || provider === 'office365';

  if (sesGroup) sesGroup.classList.toggle('hidden', !isSes);
  if (o365) o365.classList.toggle('hidden', provider !== 'office365');
  if (apiKeyGroup) apiKeyGroup.classList.toggle('hidden', isSes || isSmtpLike);
  credFields.forEach(el => el.classList.toggle('hidden', !isSmtpLike));

  if (!isSes && !isSmtpLike) {
    setSmtpApiKeyUiForProvider(provider, 'campSmtpApiKeyLabel', 'campSmtpApiKey');
  }
  const cu = document.getElementById('campSmtpUser');
  if (cu) {
    if (provider === 'office365') cu.placeholder = 'adresse@domaine.com (compte Microsoft 365)';
    else if (provider === 'smtp') cu.placeholder = 'login SMTP';
  }
}

function clearCampSmtpForm() {
  ['campSmtpName', 'campSmtpApiKey', 'campSmtpHost', 'campSmtpUser', 'campSmtpPass', 'campAwsAccessKey', 'campAwsSecretKey'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const port = document.getElementById('campSmtpPort');
  if (port) port.value = '587';
  const awsReg = document.getElementById('campAwsRegion');
  if (awsReg) awsReg.value = 'eu-west-3';
  const prov = document.getElementById('campSmtpProvider');
  if (prov) {
    prov.value = 'brevo';
    toggleCampSmtpFields('brevo');
  }
  const tr = document.getElementById('campSmtpTestResult');
  if (tr) {
    tr.textContent = '';
    tr.classList.add('hidden');
  }
}

function toggleCampaignSmtpNewPanel(show) {
  const p = document.getElementById('campaignSmtpNewPanel');
  if (p) p.classList.toggle('hidden', !show);
  if (show) {
    clearCampSmtpForm();
    const prov = document.getElementById('campSmtpProvider');
    if (prov) toggleCampSmtpFields(prov.value);
    if (typeof tyHydrateIcons === 'function') tyHydrateIcons(p);
  }
}

function onCampaignSmtpSelectChange() {
  const sel = document.getElementById('smtpConfigSelect');
  if (!sel) return;
  if (document.getElementById('smtpRotationEnabled')?.checked && sel.value && sel.value !== '__new__') {
    setSelectedSmtpRotationIds([sel.value, ...getSelectedSmtpRotationIds()]);
  }
  if (sel.value === '__new__') {
    toggleCampaignSmtpNewPanel(true);
  } else {
    toggleCampaignSmtpNewPanel(false);
  }
  syncRotationSelectionWithPrimarySmtp();
  syncCampaignFromEmailVisibility();
  refreshCampaignSendButtonState();
  void refreshCampaignVerifiedSenders({ silent: true });
}

function collectCampSmtpData() {
  const get = id => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };
  const provider = get('campSmtpProvider') || 'brevo';
  const base = {
    name: get('campSmtpName'),
    provider,
    api_key: get('campSmtpApiKey'),
    host: get('campSmtpHost'),
    port: get('campSmtpPort'),
    username: get('campSmtpUser'),
    password: get('campSmtpPass')
  };
  if (provider === 'ses') {
    base.access_key = get('campAwsAccessKey');
    base.secret_key = get('campAwsSecretKey');
    const regEl = document.getElementById('campAwsRegion');
    base.region = regEl && regEl.value ? regEl.value.trim() : 'eu-west-3';
    base.api_key = '';
  }
  if (provider === 'office365') {
    base.encryption = 'tls';
    if (!base.host) base.host = 'smtp.office365.com';
    if (!base.port) base.port = '587';
  }
  return base;
}

async function testCampSmtpInline() {
  let from = getFromEmailValue();
  if (!from) from = 'test@example.com';
  const res = await api('test_smtp', 'POST', { ...collectCampSmtpData(), from_email: from });
  const tr = document.getElementById('campSmtpTestResult');
  if (tr) {
    const err = res.error || 'Échec';
    tr.innerHTML = res.success
      ? tyI('check', 16) + ' <span>Connexion réussie</span>'
      : tyI('x-circle', 16) + ' <span>' + escHtml(err) + '</span>';
    tr.style.color = res.success ? '#22c55e' : '#ef4444';
    tr.classList.remove('hidden');
  }
}

async function saveCampSmtpAndUse() {
  const data = collectCampSmtpData();
  if (!data.name) return alert('Indiquez un nom pour cette configuration SMTP.');
  if (data.provider === 'office365') {
    if (!data.username) return alert('Microsoft 365 : l’utilisateur SMTP doit être l’adresse e-mail complète du compte.');
    if (!data.password) return alert('Microsoft 365 : le mot de passe (ou mot de passe d’application) est requis.');
  }
  if (data.provider === 'ses') {
    if (!data.access_key || !data.secret_key) {
      return alert('Amazon SES : renseignez l’Access Key ID et la Secret Access Key IAM (les deux sont obligatoires).');
    }
  }
  const res = await api('smtp_configs', 'POST', data);
  if (!res.success) return alert('Erreur : ' + (res.error || ''));
  const newId = res.data && res.data.id;
  if (!newId) return alert('Réponse serveur inattendue.');
  await populateSmtpSelect(newId);
  toggleCampaignSmtpNewPanel(false);
  const tr = document.getElementById('campSmtpTestResult');
  if (tr) {
    tr.classList.add('hidden');
    tr.textContent = '';
  }
  const campSes = document.getElementById('campSesInspectResult');
  if (campSes) {
    campSes.classList.add('hidden');
    campSes.innerHTML = '';
  }
}

function initCampaignSmtpInline() {
  const form = document.getElementById('campaignForm');
  if (!form || form.dataset.smtpInlineInit === '1') return;
  form.dataset.smtpInlineInit = '1';

  ensureFromEmailSelectChangeHook();
  document.getElementById('fromEmail')?.addEventListener('input', refreshCampaignSendButtonState);

  const prov = document.getElementById('campSmtpProvider');
  if (prov) {
    prov.addEventListener('change', () => {
      toggleCampSmtpFields(prov.value);
      if (prov.value === 'office365') {
        applyMicrosoft365SmtpDefaults('campSmtpHost', 'campSmtpPort', 'campSmtpUser');
      }
      void refreshCampaignVerifiedSenders({ silent: true });
    });
    toggleCampSmtpFields(prov.value);
  }

  const sel = document.getElementById('smtpConfigSelect');
  if (sel) sel.addEventListener('change', onCampaignSmtpSelectChange);
  const rotEnabled = document.getElementById('smtpRotationEnabled');
  const rotPanel = document.getElementById('smtpRotationPanel');
  if (rotEnabled) {
    rotEnabled.addEventListener('change', () => {
      if (rotPanel) rotPanel.classList.toggle('hidden', !rotEnabled.checked);
      updateSmtpSelectionUiMode();
      syncRotationSelectionWithPrimarySmtp();
      syncCampaignFromEmailVisibility();
      void refreshCampaignVerifiedSenders({ silent: true });
      refreshCampaignSendButtonState();
    });
  }
  document.getElementById('smtpRotationSelect')?.addEventListener('change', () => {
    syncRotationSelectionWithPrimarySmtp();
    syncCampaignFromEmailVisibility();
    void refreshCampaignVerifiedSenders({ silent: true });
    refreshCampaignSendButtonState();
  });
  document.getElementById('smtpRotationEvery')?.addEventListener('input', refreshCampaignSendButtonState);
  document.getElementById('smtpRotationMode')?.addEventListener('change', refreshCampaignSendButtonState);
  document.getElementById('smtpSenderMode')?.addEventListener('change', () => {
    syncSmtpSenderOverridesDisabledState();
    syncCampaignFromEmailVisibility();
    refreshCampaignSendButtonState();
  });
  document.getElementById('smtpFromNameMode')?.addEventListener('change', () => {
    syncSmtpSenderOverridesDisabledState();
    refreshCampaignSendButtonState();
  });
  document.getElementById('smtpSenderOverridesList')?.addEventListener('change', () => {
    syncSmtpSenderOverridesDisabledState();
    refreshCampaignSendButtonState();
  });
  document.getElementById('smtpSenderOverridesList')?.addEventListener('input', refreshCampaignSendButtonState);

  document.getElementById('refreshVerifiedSendersBtn')?.addEventListener('click', () => {
    void refreshCampaignVerifiedSenders({ silent: false });
    if (typeof tyHydrateIcons === 'function') tyHydrateIcons(form);
  });

  document.getElementById('campAwsRegion')?.addEventListener('change', () => {
    const smtpSel = document.getElementById('smtpConfigSelect');
    if (smtpSel && smtpSel.value === '__new__') void refreshCampaignVerifiedSenders({ silent: true });
  });
  ['campAwsAccessKey', 'campAwsSecretKey'].forEach(id => {
    document.getElementById(id)?.addEventListener('blur', () => {
      const smtpSel = document.getElementById('smtpConfigSelect');
      if (smtpSel && smtpSel.value === '__new__') void refreshCampaignVerifiedSenders({ silent: true });
    });
  });
  document.getElementById('campSmtpApiKey')?.addEventListener('blur', () => {
    const smtpSel = document.getElementById('smtpConfigSelect');
    if (smtpSel && smtpSel.value === '__new__') {
      const d = collectCampSmtpData();
      if (d.provider === 'brevo' && d.api_key) void refreshCampaignVerifiedSenders({ silent: true });
    }
  });

  document.getElementById('campSmtpSaveBtn')?.addEventListener('click', saveCampSmtpAndUse);
  document.getElementById('campSmtpTestBtn')?.addEventListener('click', testCampSmtpInline);
  document.getElementById('campSesInspectBtn')?.addEventListener('click', () => runSesInspect('camp'));
  document.getElementById('campSesProbeAllBtn')?.addEventListener('click', () => runSesProbeAllRegions('camp'));
  if (rotPanel && rotEnabled) rotPanel.classList.toggle('hidden', !rotEnabled.checked);
  updateSmtpSelectionUiMode();
  renderSmtpSenderOverridesList();
  syncSmtpSenderOverridesDisabledState();
  syncCampaignFromEmailVisibility();
}

// ============================================
// NAVIGATION
// ============================================

function updateSidebarPanelToggleUI(expanded) {
  const toggle = document.getElementById('sidebarPanelToggle');
  const iconSpan = document.getElementById('sidebarPanelToggleIcon');
  if (iconSpan) {
    iconSpan.setAttribute('data-ty-icon', expanded ? 'chevron-left' : 'chevron-right');
    if (typeof tyHydrateIconEl === 'function') tyHydrateIconEl(iconSpan);
  }
  if (toggle) {
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    toggle.title = expanded ? 'Réduire le panneau' : 'Afficher le panneau';
  }
}

function applySidebarPanelFromStorage() {
  const panel = document.getElementById('sidebarPanel');
  if (!panel) return;
  let expanded = true;
  try {
    if (localStorage.getItem(SIDEBAR_PANEL_EXPANDED_KEY) === '0') expanded = false;
  } catch {
    /* private mode */
  }
  panel.classList.toggle('collapsed', !expanded);
  updateSidebarPanelToggleUI(expanded);
}

function toggleSidebarPanel() {
  const panel = document.getElementById('sidebarPanel');
  if (!panel) return;
  panel.classList.toggle('collapsed');
  const nowExpanded = !panel.classList.contains('collapsed');
  try {
    localStorage.setItem(SIDEBAR_PANEL_EXPANDED_KEY, nowExpanded ? '1' : '0');
  } catch {
    /* private mode */
  }
  updateSidebarPanelToggleUI(nowExpanded);
}

function showSection(section) {
  // If leaving campaigns page with detail open, reset it
  if (state.currentSection === 'campaigns' && section !== 'campaigns') {
    const detail = document.getElementById('campaignDetail');
    const list = document.getElementById('campaignsList');
    const newBtn = document.getElementById('newCampaignBtn');
    if (detail && !detail.classList.contains('hidden')) {
      detail.classList.add('hidden');
      if (list) list.classList.remove('hidden');
      if (newBtn) newBtn.classList.remove('hidden');
    }
    stopCampaignMonitor();
  }

  state.currentSection = section;

  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('page-' + section);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-icon[data-section], .nav-item[data-section]').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  if (section === 'testing') {
    void refreshTestingPage();
  }

  if (!uiStateRestoreInProgress) persistUiState();
}

function initNavigation() {
  document.querySelectorAll('.nav-icon[data-section], .nav-item[data-section]').forEach(el => {
    el.addEventListener('click', () => {
      showSection(el.dataset.section);
    });
  });

  const panelToggle = document.getElementById('sidebarPanelToggle');
  if (panelToggle) {
    panelToggle.addEventListener('click', e => {
      e.stopPropagation();
      toggleSidebarPanel();
    });
  }
}

// ============================================
// DASHBOARD
// ============================================

async function initDashboard() {
  const res = await api('dashboard');
  if (!res.success) return;

  const { campaigns = [], templates = [] } = res.data;

  // Stats
  const totalCampaigns = campaigns.length;
  const totalSent = campaigns.reduce((sum, c) => sum + ((c.stats && c.stats.sent) || 0), 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'running').length;
  const totalTemplates = templates.length;

  const statsEl = document.getElementById('dashboardStats');
  if (statsEl) {
    statsEl.innerHTML = [
      { val: totalCampaigns,          lbl: 'Campagnes',      section: 'campaigns', cls: '' },
      { val: totalSent.toLocaleString('fr-FR'), lbl: 'Emails envoyés', section: 'campaigns', cls: 'success' },
      { val: activeCampaigns,         lbl: 'En cours',       section: 'campaigns', cls: activeCampaigns > 0 ? 'success' : '' },
      { val: totalTemplates,          lbl: 'Templates',      section: 'templates', cls: '' }
    ].map(s => `
      <div class="stat-card" onclick="showSection('${s.section}')" style="cursor:pointer">
        <div class="stat-val ${s.cls}">${s.val}</div>
        <div class="stat-lbl">${s.lbl}</div>
      </div>
    `).join('');
  }

  const dashEmpty = document.getElementById('dashboardEmptyState');
  if (dashEmpty) {
    if (totalCampaigns === 0 && totalTemplates === 0) {
      dashEmpty.classList.remove('hidden');
      dashEmpty.innerHTML = `
        <div class="empty-state-card dashboard-empty-inner">
          <div class="empty-state-icon">${tyI('hexagon', 44)}</div>
          <h2 class="empty-state-title">Bienvenue sur ChadMailer</h2>
          <p class="empty-state-text">Par où commencer ? Créez un template de courriel, puis une campagne avec votre liste de contacts.</p>
          <div class="dashboard-empty-actions">
            <button type="button" class="btn-primary btn-with-icon" id="dashEmptyTemplates">${tyI('mail', 18)} Créer un template</button>
            <button type="button" class="btn-secondary btn-with-icon" id="dashEmptyCampaigns">${tyI('clipboard-list', 18)} Nouvelle campagne</button>
          </div>
        </div>`;
      document.getElementById('dashEmptyTemplates')?.addEventListener('click', () => {
        showSection('templates');
        document.getElementById('newTemplateBtn')?.click();
      });
      document.getElementById('dashEmptyCampaigns')?.addEventListener('click', () => {
        showSection('campaigns');
        document.getElementById('newCampaignBtn')?.click();
      });
      if (typeof tyHydrateIcons === 'function') tyHydrateIcons(dashEmpty);
    } else {
      dashEmpty.classList.add('hidden');
      dashEmpty.innerHTML = '';
    }
  }

  // Recent campaigns (last 5)
  const recent = [...campaigns].slice(-5).reverse();
  const listEl = document.getElementById('recentCampaigns');
  if (listEl) {
    if (recent.length === 0) {
      listEl.innerHTML =
        '<div class="recent-empty-hint"><span class="recent-empty-icon" aria-hidden="true">' +
        tyI('clipboard-list', 22) +
        '</span><p>Aucune campagne récente. Les dernières campagnes apparaîtront ici.</p></div>';
    } else {
      listEl.innerHTML = recent.map(c => {
        const stats = c.stats || {};
        const statusColor = c.status === 'running' ? '#22c55e' : c.status === 'done' ? '#64748b' : '#f59e0b';
        return `
          <div class="campaign-row">
            <span class="status-dot" style="background:${statusColor};width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:8px"></span>
            <span style="flex:1;font-weight:500">${escHtml(c.name || 'Sans nom')}</span>
            <span class="recent-list-meta ty-inline-row">
              ${tyI('check', 14)} <span>${stats.sent || 0}</span>
              <span style="opacity:0.5;margin:0 0.15em">·</span>
              ${tyI('x-circle', 14)} <span>${stats.failed || 0}</span>
              <span style="opacity:0.5;margin:0 0.25em">/</span>
              <span>${stats.total || 0}</span>
            </span>
          </div>
        `;
      }).join('');
    }
  }

  // Active campaign widget
  const running = campaigns.find(c => c.status === 'running');
  const widgetEl = document.getElementById('activeCampaignWidget');
  if (widgetEl) {
    if (running) {
      widgetEl.classList.remove('hidden');
      widgetEl.innerHTML = `
        <strong>${escHtml(running.name)}</strong> est en cours.
        <button class="btn btn-sm" onclick="goToMonitoring('${running.id}')">Voir le monitoring</button>
      `;
    } else {
      widgetEl.classList.add('hidden');
    }
  }
}

function goToMonitoring(campaignId) {
  showSection('campaigns');
  showCampaignDetail(campaignId);
}

// ============================================
// TEMPLATES
// ============================================

const TEMPLATE_PREVIEW_SAMPLES = {
  prenom: 'María',
  nom: 'García López',
  email: 'maria.garcia@example.com',
  ville: 'Madrid',
  entreprise: 'Ejemplo S.L.',
  url_primaria: 'https://www.example.com/expediente',
  url_secundaria: 'https://www.example.com/ayuda',
  url_aviso: 'https://www.example.com/aviso-legal',
  rotate_url: 'https://www.example.com/lien-rotatif',
  url_rotate: 'https://www.example.com/lien-rotatif'
};

/** Règles HTMLHint assouplies pour fragments e-mail (Handlebars, guillemets simples, etc.) */
const TEMPLATE_HTMLHINT_RULES = {
  'tagname-lowercase': false,
  'attr-lowercase': false,
  'attr-value-double-quotes': false,
  'doctype-first': false,
  'tag-pair': true,
  'spec-char-escape': true,
  'id-unique': true,
  'src-not-empty': true,
  'attr-no-duplication': true
};

let templatePreviewDebounceTimer = null;
let templateCodeMirror = null;
let templateCmResizeTimer = null;
/** Snapshot JSON de l’état enregistré (ou à l’ouverture) pour détecter les changements */
let templateEditorSavedSnapshot = null;
let templateSaveToastTimer = null;

function getTemplateRotateUrlsFromTextarea() {
  const ta = document.getElementById('templateRotateUrls');
  if (!ta || !String(ta.value).trim()) return [];
  return String(ta.value)
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

function templateCombinedContentForVars() {
  const sub = (document.getElementById('templateSubject') || {}).value || '';
  const tx = (document.getElementById('templateText') || {}).value || '';
  return `${sub}\n${tx}\n${getTemplateHtmlValue()}`;
}

function templateUsesRotateUrl() {
  return /\{\{?\s*(rotate_url|url_rotate)\s*\}?\}/i.test(templateCombinedContentForVars());
}

function syncTemplateRotateHint() {
  const hint = document.getElementById('templateRotateDetectHint');
  if (!hint) return;
  const hasUrls = getTemplateRotateUrlsFromTextarea().length > 0;
  hint.classList.toggle('hidden', !templateUsesRotateUrl() || hasUrls);
}

let templateRotateHintTimer = null;
function scheduleTemplateRotateHintSync() {
  if (templateRotateHintTimer) clearTimeout(templateRotateHintTimer);
  templateRotateHintTimer = setTimeout(() => {
    templateRotateHintTimer = null;
    syncTemplateRotateHint();
  }, 200);
}

function getCurrentTemplateEditorState() {
  const getVal = id => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };
  const everyEl = document.getElementById('templateRotateEvery');
  const every = Math.max(1, parseInt(everyEl && everyEl.value, 10) || 1);
  return {
    id: getVal('templateId').trim(),
    name: getVal('templateName').trim(),
    subject: getVal('templateSubject').trim(),
    html: getTemplateHtmlValue().trim(),
    text: getVal('templateText').trim(),
    rotate_urls: getTemplateRotateUrlsFromTextarea(),
    rotate_url_every: every
  };
}

function markTemplateEditorClean() {
  templateEditorSavedSnapshot = JSON.stringify(getCurrentTemplateEditorState());
}

function templateEditorIsDirty() {
  if (templateEditorSavedSnapshot === null) return false;
  return JSON.stringify(getCurrentTemplateEditorState()) !== templateEditorSavedSnapshot;
}

function showTemplateSaveToast(message = 'Template enregistré') {
  const el = document.getElementById('templateSaveToast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('template-save-toast--show');
  clearTimeout(templateSaveToastTimer);
  templateSaveToastTimer = setTimeout(() => {
    el.classList.remove('template-save-toast--show');
  }, 2800);
}

function hideTemplateUnsavedDialog() {
  document.getElementById('templateUnsavedDialog')?.classList.add('hidden');
}

function requestCloseTemplateEditor() {
  const m = document.getElementById('templateEditorModal');
  if (!m || m.classList.contains('hidden')) return;
  if (!templateEditorIsDirty()) {
    forceCloseTemplateEditorModal();
    return;
  }
  document.getElementById('templateUnsavedDialog')?.classList.remove('hidden');
}

function registerHtmlMixedLint() {
  if (typeof CodeMirror === 'undefined') return;
  const lint = CodeMirror.helpers && CodeMirror.helpers.lint;
  if (lint && lint.htmlmixed) return;
  if (lint && lint.html) {
    CodeMirror.registerHelper('lint', 'htmlmixed', lint.html);
    return;
  }
  let HH = typeof window !== 'undefined' ? window.HTMLHint : null;
  if (HH && typeof HH.verify !== 'function') {
    HH = HH.default || HH.HTMLHint || null;
  }
  if (!HH || typeof HH.verify !== 'function') return;
  CodeMirror.registerHelper('lint', 'htmlmixed', function (text, options) {
    const found = [];
    const rules = (options && options.rules) || TEMPLATE_HTMLHINT_RULES;
    const messages = HH.verify(text, rules) || [];
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const line = Math.max(0, (message.line || 1) - 1);
      const col = Math.max(0, (message.col || 1) - 1);
      found.push({
        from: CodeMirror.Pos(line, col),
        to: CodeMirror.Pos(line, col + 1),
        message: message.message,
        severity: message.type === 'warning' ? 'warning' : 'error'
      });
    }
    return found;
  });
}

function isLikelyFullHtmlDocument(html) {
  const s = String(html || '').trim();
  if (!s) return false;
  if (/^\s*<!DOCTYPE/i.test(s)) return true;
  if (/<html[\s>]/i.test(s)) return true;
  return false;
}

/** Iframe + designMode : préserve le HTML e-mail (Quill le détruisait en le normalisant). */
function buildSrcdocForTemplateVisualEdit(html) {
  const raw = html == null ? '' : String(html);
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      srcdoc:
        '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{min-height:100%;margin:0;}body{padding:12px;box-sizing:border-box;font-family:system-ui,sans-serif;background:#fff;color:#111;}</style></head><body><p>&#8203;</p></body></html>',
      isFull: false
    };
  }
  if (isLikelyFullHtmlDocument(raw)) {
    return { srcdoc: raw, isFull: true };
  }
  return {
    srcdoc: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>html,body{min-height:100%;margin:0;}body{padding:12px;box-sizing:border-box;}</style></head><body>${raw}</body></html>`,
    isFull: false
  };
}

function getTemplateVisualIframeHtml() {
  const iframe = document.getElementById('templateVisualIframe');
  if (!iframe) return '';
  const doc = iframe.contentDocument;
  if (!doc || !doc.documentElement) return '';
  if (state.templateVisualIsFullDocument) {
    return doc.documentElement.outerHTML;
  }
  if (doc.body) return doc.body.innerHTML;
  return '';
}

function getTemplateHtmlValue() {
  if (state.templateHtmlEditMode === 'visual') {
    if (state.templateVisualLoading) {
      return templateCodeMirror ? templateCodeMirror.getValue() : document.getElementById('templateHtml')?.value || '';
    }
    return getTemplateVisualIframeHtml();
  }
  if (templateCodeMirror) return templateCodeMirror.getValue();
  const el = document.getElementById('templateHtml');
  return el ? el.value : '';
}

function setTemplateHtmlValue(val) {
  const v = val == null ? '' : String(val);
  if (templateCodeMirror) {
    if (templateCodeMirror.getValue() !== v) {
      templateCodeMirror.setValue(v);
    }
  } else {
    const el = document.getElementById('templateHtml');
    if (el) el.value = v;
  }
  if (state.templateHtmlEditMode === 'visual') {
    const wrap = document.getElementById('templateVisualWrap');
    if (wrap && !wrap.classList.contains('hidden')) {
      openTemplateVisualEditor(v);
    }
  }
  state.templatePreviewUsesRealMerge = false;
  updateTemplatePreviewHintLine();
  scheduleTemplatePreviewUpdate();
}

function destroyTemplateVisualEditor() {
  const iframe = document.getElementById('templateVisualIframe');
  if (iframe && state.templateVisualInputHandler) {
    try {
      const d = iframe.contentDocument;
      if (d) {
        d.removeEventListener('input', state.templateVisualInputHandler);
        d.removeEventListener('keyup', state.templateVisualInputHandler);
      }
    } catch (e) {
      /* iframe déchargée */
    }
    state.templateVisualInputHandler = null;
  }
  if (iframe) {
    iframe.onload = null;
    iframe.removeAttribute('srcdoc');
  }
  state.templateVisualIsFullDocument = false;
  state.templateVisualLoading = false;
}

function openTemplateVisualEditor(html) {
  const iframe = document.getElementById('templateVisualIframe');
  if (!iframe) return;
  destroyTemplateVisualEditor();
  state.templateVisualLoading = true;
  const { srcdoc, isFull } = buildSrcdocForTemplateVisualEdit(html);
  state.templateVisualIsFullDocument = isFull;
  state.templateVisualInputHandler = () => {
    state.templatePreviewUsesRealMerge = false;
    updateTemplatePreviewHintLine();
    scheduleTemplatePreviewUpdate();
    scheduleTemplateRotateHintSync();
  };
  iframe.onload = () => {
    const d = iframe.contentDocument;
    if (d) {
      try {
        d.designMode = 'on';
      } catch (err) {
        /* rare */
      }
      if (state.templateVisualInputHandler) {
        d.addEventListener('input', state.templateVisualInputHandler);
        d.addEventListener('keyup', state.templateVisualInputHandler);
      }
    }
    state.templateVisualLoading = false;
  };
  iframe.srcdoc = srcdoc;
}

function setTemplateHtmlEditMode(mode) {
  const visual = mode === 'visual';
  state.templateHtmlEditMode = visual ? 'visual' : 'code';
  const visualWrap = document.getElementById('templateVisualWrap');
  const codeWrap = document.getElementById('templateCodeEditorWrap');
  const btnV = document.getElementById('templateModeVisualBtn');
  const btnC = document.getElementById('templateModeCodeBtn');
  if (visual) {
    const html = templateCodeMirror ? templateCodeMirror.getValue() : document.getElementById('templateHtml')?.value || '';
    openTemplateVisualEditor(html);
    visualWrap?.classList.remove('hidden');
    codeWrap?.classList.add('hidden');
    visualWrap?.setAttribute('aria-hidden', 'false');
    codeWrap?.setAttribute('aria-hidden', 'true');
  } else {
    let html;
    if (state.templateVisualLoading) {
      html = templateCodeMirror ? templateCodeMirror.getValue() : document.getElementById('templateHtml')?.value || '';
    } else {
      html = getTemplateVisualIframeHtml();
      const cmVal = templateCodeMirror ? templateCodeMirror.getValue() : '';
      if ((!html || !String(html).trim()) && cmVal && String(cmVal).trim()) {
        html = cmVal;
      }
    }
    if (templateCodeMirror) {
      if (templateCodeMirror.getValue() !== html) templateCodeMirror.setValue(html);
    } else {
      const ta = document.getElementById('templateHtml');
      if (ta) ta.value = html;
    }
    destroyTemplateVisualEditor();
    visualWrap?.classList.add('hidden');
    codeWrap?.classList.remove('hidden');
    visualWrap?.setAttribute('aria-hidden', 'true');
    codeWrap?.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      refreshTemplateCodeMirrorLayout();
      templateCodeMirror?.refresh();
    });
  }
  btnV?.classList.toggle('segmented-btn--active', visual);
  btnC?.classList.toggle('segmented-btn--active', !visual);
  btnV?.setAttribute('aria-selected', visual ? 'true' : 'false');
  btnC?.setAttribute('aria-selected', !visual ? 'true' : 'false');
  scheduleTemplatePreviewUpdate();
}

function updateTemplatePreviewHintLine() {
  const el = document.getElementById('templatePreviewHintLine');
  if (!el) return;
  if (state.templatePreviewUsesRealMerge) {
    el.textContent = 'Aperçu avec données réelles — modifiez le HTML puis réappliquez pour mettre à jour.';
  } else {
    el.textContent =
      'Aperçu avec exemples fictifs — choisissez une campagne (ou le brouillon) et cliquez « Appliquer » pour une vraie ligne.';
  }
}

function setTemplatePreviewDevice(device) {
  state.templatePreviewDevice = device === 'mobile' ? 'mobile' : 'desktop';
  const vp = document.getElementById('templatePreviewViewport');
  if (vp) vp.setAttribute('data-device', state.templatePreviewDevice);
  document.getElementById('templatePreviewDeviceDesktop')?.classList.toggle('segmented-btn--active', state.templatePreviewDevice === 'desktop');
  document.getElementById('templatePreviewDeviceMobile')?.classList.toggle('segmented-btn--active', state.templatePreviewDevice === 'mobile');
  document.getElementById('templatePreviewDeviceDesktop')?.setAttribute('aria-selected', state.templatePreviewDevice === 'desktop' ? 'true' : 'false');
  document.getElementById('templatePreviewDeviceMobile')?.setAttribute('aria-selected', state.templatePreviewDevice === 'mobile' ? 'true' : 'false');
}

async function populateTemplatePreviewCampaignSelect() {
  const sel = document.getElementById('templatePreviewCampaignSelect');
  if (!sel) return;
  const draftVal = '__draft__';
  const cur = sel.value;
  const res = await api('campaigns');
  const campaigns = res.success ? res.data || [] : [];
  const opts = [
    `<option value="">— Exemples fictifs —</option>`,
    `<option value="${draftVal}">Brouillon actuel (formulaire campagne)</option>`
  ];
  campaigns.forEach(c => {
    const id = escAttr(c.id);
    opts.push(`<option value="${id}">${escHtml(c.name || c.id)}</option>`);
  });
  sel.innerHTML = opts.join('');
  const allowed = ['', draftVal, ...campaigns.map(c => String(c.id))];
  if (cur && allowed.includes(cur)) sel.value = cur;
}

async function applyTemplateRealDataPreview() {
  const sel = document.getElementById('templatePreviewCampaignSelect');
  const idxEl = document.getElementById('templatePreviewRowIndex');
  const campaignId = sel && sel.value;
  const rowIndex = Math.max(0, parseInt(idxEl && idxEl.value, 10) || 0);
  const templatePayload = {
    html: getTemplateHtmlValue(),
    subject: (document.getElementById('templateSubject') || {}).value || '',
    text: (document.getElementById('templateText') || {}).value || '',
    rotate_urls: getTemplateRotateUrlsFromTextarea(),
    rotate_url_every: Math.max(1, parseInt((document.getElementById('templateRotateEvery') || {}).value, 10) || 1)
  };

  const body = {
    template: templatePayload,
    recipient_index: rowIndex
  };

  if (!campaignId || campaignId === '') {
    return alert('Choisissez une campagne ou « Brouillon actuel ».');
  }
  if (campaignId === '__draft__') {
    const pc = collectPreviewListConfigOnly();
    if (!pc.file_path || !String(pc.file_path).trim()) {
      return alert('Importez d’abord une liste dans le formulaire campagne (brouillon).');
    }
    body.preview_config = pc;
  } else {
    body.campaign_id = campaignId;
  }

  const res = await api('template_preview_merge', 'POST', body);
  if (!res.success) return alert(res.error || 'Erreur prévisualisation');

  const d = res.data || {};
  const subjEl = document.getElementById('templatePreviewSubjectLine');
  if (subjEl) {
    subjEl.textContent = d.subject ? `Objet : ${d.subject}` : '';
    subjEl.classList.toggle('hidden', !d.subject);
  }

  const iframe = document.getElementById('templatePreviewFrame');
  if (iframe) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(d.html || '');
      doc.close();
    } catch (e) {
      console.error(e);
    }
  }
  state.templatePreviewUsesRealMerge = true;
  updateTemplatePreviewHintLine();
}

function initTemplateEditorAdvancedControls() {
  document.getElementById('templateModeVisualBtn')?.addEventListener('click', () => setTemplateHtmlEditMode('visual'));
  document.getElementById('templateModeCodeBtn')?.addEventListener('click', () => setTemplateHtmlEditMode('code'));
  document.getElementById('templatePreviewDeviceDesktop')?.addEventListener('click', () => setTemplatePreviewDevice('desktop'));
  document.getElementById('templatePreviewDeviceMobile')?.addEventListener('click', () => setTemplatePreviewDevice('mobile'));
  document.getElementById('templatePreviewApplyRealBtn')?.addEventListener('click', () => applyTemplateRealDataPreview());
}

function initTemplateCodeMirror() {
  if (templateCodeMirror || typeof CodeMirror === 'undefined') return;
  const ta = document.getElementById('templateHtml');
  if (!ta) return;

  registerHtmlMixedLint();

  const lintOn = !!(typeof window !== 'undefined' && window.HTMLHint);

  templateCodeMirror = CodeMirror.fromTextArea(ta, {
    mode: 'htmlmixed',
    theme: 'material-darker',
    lineNumbers: true,
    lineWrapping: true,
    indentUnit: 2,
    tabSize: 2,
    matchBrackets: true,
    autoRefresh: true,
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-lint-markers'],
    lint: lintOn ? { rules: TEMPLATE_HTMLHINT_RULES } : false,
    extraKeys: {
      Tab: cm => cm.execCommand('indentMore'),
      'Shift-Tab': cm => cm.execCommand('indentLess')
    }
  });

  templateCodeMirror.getWrapperElement().classList.add('template-codemirror-root');
  templateCodeMirror.on('change', () => {
    state.templatePreviewUsesRealMerge = false;
    updateTemplatePreviewHintLine();
    scheduleTemplatePreviewUpdate();
    scheduleTemplateRotateHintSync();
  });
}

function refreshTemplateCodeMirrorLayout() {
  if (!templateCodeMirror) return;
  const h = Math.max(280, window.innerHeight - 150);
  templateCodeMirror.setSize(null, h);
  templateCodeMirror.refresh();
}

function applyTemplatePreviewPlaceholders(html) {
  if (!html || !String(html).trim()) {
    return '<p style="margin:0;padding:28px;font-family:system-ui,sans-serif;font-size:15px;color:#64748b;">Saisissez du HTML à gauche pour afficher l’aperçu ici.</p>';
  }

  let out = String(html);

  out = out.replace(/\{\{?(RANDNUM|RANDALPHANUM|RANDALPHA)-(\d+)\}?\}/gi, (_, type, len) => {
    const n = Math.min(24, Math.max(1, parseInt(len, 10) || 6));
    const t = String(type).toUpperCase();
    if (t === 'RANDNUM') return '482910'.padStart(n, '0').slice(-n);
    if (t === 'RANDALPHA') return ('AperçuABCDEFGHIJKL').slice(0, n);
    return ('a1B2c3D4e5F6g7H8').repeat(2).slice(0, n);
  });

  const replaceKnown = (key) => {
    const k = String(key).toLowerCase();
    if (k === 'date') return new Date().toLocaleDateString('fr-FR');
    if (k === 'time') {
      return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    if (k === 'datetime') return new Date().toLocaleString('fr-FR');
    if (k === 'rotate_url' || k === 'url_rotate') {
      const lines = getTemplateRotateUrlsFromTextarea();
      return lines.length ? lines[0] : TEMPLATE_PREVIEW_SAMPLES.rotate_url;
    }
    if (Object.prototype.hasOwnProperty.call(TEMPLATE_PREVIEW_SAMPLES, k)) {
      return TEMPLATE_PREVIEW_SAMPLES[k];
    }
    return `[${key}]`;
  };

  out = out.replace(/\{\{(\w+)\}\}/g, (_, key) => replaceKnown(key));
  out = out.replace(/\{(\w+)\}/g, (_, key) => replaceKnown(key));

  return out;
}

function updateTemplatePreviewLive() {
  const iframe = document.getElementById('templatePreviewFrame');
  if (!iframe) return;

  if (state.templatePreviewUsesRealMerge) {
    return;
  }

  const subjLine = document.getElementById('templatePreviewSubjectLine');
  if (subjLine) {
    subjLine.classList.add('hidden');
    subjLine.textContent = '';
  }

  const html = applyTemplatePreviewPlaceholders(getTemplateHtmlValue());
  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
  } catch (err) {
    console.error('Aperçu template', err);
  }
}

function scheduleTemplatePreviewUpdate() {
  if (templatePreviewDebounceTimer) clearTimeout(templatePreviewDebounceTimer);
  templatePreviewDebounceTimer = setTimeout(() => {
    templatePreviewDebounceTimer = null;
    updateTemplatePreviewLive();
  }, 120);
}

function isTemplateCodePhaseActive() {
  const code = document.getElementById('templateEditorPhaseCode');
  return !!(code && !code.classList.contains('hidden'));
}

function setTemplateCodePhase(active) {
  const overlay = document.getElementById('templateEditorModal');
  const inner = document.getElementById('templateEditorModalInner');
  const main = document.getElementById('templateEditorPhaseMain');
  const code = document.getElementById('templateEditorPhaseCode');
  if (!main || !code) return;
  main.classList.toggle('hidden', active);
  main.setAttribute('aria-hidden', active ? 'true' : 'false');
  code.classList.toggle('hidden', !active);
  code.setAttribute('aria-hidden', active ? 'false' : 'true');
  overlay?.classList.toggle('template-editor-overlay--code', active);
  inner?.classList.toggle('modal-template-editor--code', active);
  if (active) {
    state.templateHtmlEditMode = 'code';
    state.templatePreviewUsesRealMerge = false;
    destroyTemplateVisualEditor();
    const qw = document.getElementById('templateVisualWrap');
    const cw = document.getElementById('templateCodeEditorWrap');
    qw?.classList.add('hidden');
    cw?.classList.remove('hidden');
    document.getElementById('templateModeVisualBtn')?.classList.remove('segmented-btn--active');
    document.getElementById('templateModeCodeBtn')?.classList.add('segmented-btn--active');
    initTemplateCodeMirror();
    populateTemplatePreviewCampaignSelect();
    setTemplatePreviewDevice('desktop');
    updateTemplatePreviewHintLine();
    scheduleTemplatePreviewUpdate();
    requestAnimationFrame(() => {
      refreshTemplateCodeMirrorLayout();
      requestAnimationFrame(() => {
        templateCodeMirror?.refresh();
        templateCodeMirror?.focus();
      });
    });
  } else {
    destroyTemplateVisualEditor();
    requestAnimationFrame(() => {
      const m = document.getElementById('templateEditorModal');
      if (m && !m.classList.contains('hidden')) {
        document.getElementById('templateName')?.focus();
      }
    });
  }
}

function openTemplateEditorModal() {
  const modal = document.getElementById('templateEditorModal');
  const titleEl = document.getElementById('templateEditorModalTitle');
  const idEl = document.getElementById('templateId');
  const id = idEl && idEl.value;
  if (titleEl) titleEl.textContent = id ? 'Modifier le template' : 'Nouveau template';
  setTemplateCodePhase(false);
  if (modal) {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
  }
  const guideBtn = document.getElementById('templateVarsGuideBtn');
  const guidePanel = document.getElementById('templateVarsGuidePanel');
  if (guideBtn && guidePanel) {
    guideBtn.setAttribute('aria-expanded', 'false');
    guidePanel.classList.add('hidden');
  }
  markTemplateEditorClean();
  requestAnimationFrame(() => {
    updateTemplatePreviewLive();
    scheduleTemplateRotateHintSync();
    document.getElementById('templateName')?.focus();
  });
}

function forceCloseTemplateEditorModal() {
  hideTemplateUnsavedDialog();
  destroyTemplateVisualEditor();
  setTemplateCodePhase(false);
  const modal = document.getElementById('templateEditorModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
  templateEditorSavedSnapshot = null;
}

async function initTemplates() {
  await loadTemplates();

  const newBtn = document.getElementById('newTemplateBtn');
  if (newBtn) {
    newBtn.addEventListener('click', () => {
      clearTemplateForm();
      openTemplateEditorModal();
    });
  }

  const newFolderBtn = document.getElementById('newFolderBtn');
  if (newFolderBtn) {
    newFolderBtn.addEventListener('click', () => openFolderEditDialog(null));
  }

  initFolderEditDialog();

  const breadcrumbRoot = document.getElementById('templatesBreadcrumbRoot');
  if (breadcrumbRoot) {
    breadcrumbRoot.addEventListener('click', () => {
      enterTemplateFolder('');
    });
  }

  const saveBtn = document.getElementById('saveTemplateBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveTemplate);
  }

  const cancelBtn = document.getElementById('cancelTemplateBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => requestCloseTemplateEditor());
  }

  document.getElementById('openTemplateCodeEditorBtn')?.addEventListener('click', () => setTemplateCodePhase(true));
  initTemplateEditorAdvancedControls();

  const templateVarsGuideBtn = document.getElementById('templateVarsGuideBtn');
  const templateVarsGuidePanel = document.getElementById('templateVarsGuidePanel');
  if (templateVarsGuideBtn && templateVarsGuidePanel) {
    templateVarsGuideBtn.addEventListener('click', () => {
      const isOpen = templateVarsGuideBtn.getAttribute('aria-expanded') === 'true';
      const willOpen = !isOpen;
      templateVarsGuideBtn.setAttribute('aria-expanded', String(willOpen));
      templateVarsGuidePanel.classList.toggle('hidden', isOpen);
      if (willOpen) {
        requestAnimationFrame(() => {
          templateVarsGuidePanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      }
    });
  }

  document.getElementById('backTemplateCodeEditorBtn')?.addEventListener('click', () => setTemplateCodePhase(false));

  document.getElementById('closeTemplateEditorModal')?.addEventListener('click', () => requestCloseTemplateEditor());

  document.getElementById('closeTemplateCodeEditorModal')?.addEventListener('click', () => requestCloseTemplateEditor());

  const editorModal = document.getElementById('templateEditorModal');
  if (editorModal) {
    editorModal.addEventListener('click', e => {
      if (e.target !== editorModal) return;
      if (isTemplateCodePhaseActive()) {
        setTemplateCodePhase(false);
      } else {
        requestCloseTemplateEditor();
      }
    });
  }

  const unsavedDlg = document.getElementById('templateUnsavedDialog');
  if (unsavedDlg) {
    unsavedDlg.addEventListener('click', e => {
      if (e.target === unsavedDlg) hideTemplateUnsavedDialog();
    });
    document.getElementById('templateUnsavedCancel')?.addEventListener('click', () => hideTemplateUnsavedDialog());
    document.getElementById('templateUnsavedDiscard')?.addEventListener('click', () => {
      hideTemplateUnsavedDialog();
      forceCloseTemplateEditorModal();
    });
    document.getElementById('templateUnsavedSave')?.addEventListener('click', () => {
      saveTemplate({ closeAfter: true, showToast: true });
    });
  }

  document.getElementById('templateHtml')?.addEventListener('input', scheduleTemplatePreviewUpdate);

  window.addEventListener('resize', () => {
    if (!isTemplateCodePhaseActive() || !templateCodeMirror) return;
    clearTimeout(templateCmResizeTimer);
    templateCmResizeTimer = setTimeout(refreshTemplateCodeMirrorLayout, 120);
  });

  document.addEventListener(
    'keydown',
    e => {
      const unsavedOpen = document.getElementById('templateUnsavedDialog');
      if (unsavedOpen && !unsavedOpen.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          hideTemplateUnsavedDialog();
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          e.stopPropagation();
          saveTemplate();
        }
        return;
      }

      const m = document.getElementById('templateEditorModal');
      if (!m || m.classList.contains('hidden')) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        saveTemplate();
        return;
      }

      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (isTemplateCodePhaseActive()) {
        setTemplateCodePhase(false);
      } else {
        requestCloseTemplateEditor();
      }
    },
    true
  );

  document.getElementById('templateSubject')?.addEventListener('input', scheduleTemplateRotateHintSync);
  document.getElementById('templateText')?.addEventListener('input', scheduleTemplateRotateHintSync);
  document.getElementById('templateRotateUrls')?.addEventListener('input', scheduleTemplateRotateHintSync);
  document.getElementById('templateRotateEvery')?.addEventListener('input', scheduleTemplateRotateHintSync);
}

async function loadTemplates() {
  const [tplRes, folderRes] = await Promise.all([
    api('templates'),
    api('template_folders')
  ]);
  if (tplRes && tplRes.success) state.templates = tplRes.data || [];
  if (folderRes && folderRes.success) state.templateFolders = folderRes.data || [];
  renderTemplates(state.templates);
}

/**
 * Vue racine : dossiers de niveau 0 + templates sans dossier.
 * Vue dossier : breadcrumb + sous-dossiers + templates du dossier courant.
 */
function renderTemplates(templates) {
  const list = document.getElementById('templatesList');
  const emptyEl = document.getElementById('templatesEmptyState');
  const breadcrumb = document.getElementById('templatesBreadcrumb');
  if (!list) return;

  const folders = state.templateFolders || [];
  const currentFolderId = state.currentTemplateFolderId || '';

  // Si on est dans un dossier qui n'existe plus, on ressort automatiquement.
  if (currentFolderId && !folders.some(f => f.id === currentFolderId)) {
    state.currentTemplateFolderId = '';
    return renderTemplates(templates);
  }

  // Index dossiers par id (pour parent chain).
  const folderById = new Map();
  for (const f of folders) folderById.set(f.id, f);

  // Templates par dossier.
  const tplsByFolder = new Map();
  const rootTemplates = [];
  for (const t of templates) {
    const fid = t.folder_id || '';
    if (fid) {
      if (!tplsByFolder.has(fid)) tplsByFolder.set(fid, []);
      tplsByFolder.get(fid).push(t);
    } else {
      rootTemplates.push(t);
    }
  }

  // Sous-dossiers directs par parent_id.
  const subfoldersByParent = new Map();
  for (const f of folders) {
    const pid = f.parent_id || '';
    if (!subfoldersByParent.has(pid)) subfoldersByParent.set(pid, []);
    subfoldersByParent.get(pid).push(f);
  }

  // Rendu du breadcrumb (chemin complet).
  renderTemplatesBreadcrumb(breadcrumb, currentFolderId, folderById);

  // Empty state — racine vide (ni dossiers, ni templates)
  const rootFolders = subfoldersByParent.get('') || [];
  if (!currentFolderId && rootFolders.length === 0 && rootTemplates.length === 0) {
    list.innerHTML = '';
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      emptyEl.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-icon" aria-hidden="true">${tyI('mail', 40)}</div>
          <h2 class="empty-state-title">Aucun modèle pour l’instant</h2>
          <p class="empty-state-text">Créez un premier template : sujet, HTML, variables <code>{{prenom}}</code>, etc.</p>
          <button type="button" class="btn-primary btn-with-icon" id="emptyStateNewTemplateBtn">${tyI('plus', 18)} Nouveau template</button>
        </div>`;
      document.getElementById('emptyStateNewTemplateBtn')?.addEventListener('click', () => {
        document.getElementById('newTemplateBtn')?.click();
      });
      if (typeof tyHydrateIcons === 'function') tyHydrateIcons(emptyEl);
    }
    return;
  }

  if (emptyEl) {
    emptyEl.classList.add('hidden');
    emptyEl.innerHTML = '';
  }

  let displayTemplates;
  let displayFolders;
  if (currentFolderId) {
    displayTemplates = tplsByFolder.get(currentFolderId) || [];
    displayFolders = subfoldersByParent.get(currentFolderId) || [];
  } else {
    displayTemplates = rootTemplates;
    displayFolders = rootFolders;
  }

  const folderCardsHtml = displayFolders.map(f => {
    const items = tplsByFolder.get(f.id) || [];
    const subFolders = subfoldersByParent.get(f.id) || [];
    const preview = items.slice(0, 3);
    const totalCount = items.length + subFolders.length;
    const stackItems = [];
    if (subFolders.length > 0) {
      const previewSubs = subFolders.slice(0, 2);
      for (const sf of previewSubs) {
        stackItems.push(`<div class="folder-card-stack-item is-subfolder" title="Sous-dossier">${tyI('folder', 12)} ${escHtml(sf.name)}</div>`);
      }
    }
    for (const t of preview) {
      if (stackItems.length >= 3) break;
      stackItems.push(`<div class="folder-card-stack-item" title="${escAttr(t.subject || '')}">${escHtml(t.name)}</div>`);
    }
    const stackHtml = stackItems.length === 0
      ? `<div class="folder-card-stack-empty">Glissez un template ou un dossier ici</div>`
      : stackItems.join('');

    const colorHex = folderColorHex(f.color);
    return `
      <div class="folder-card" data-folder-id="${escAttr(f.id)}" data-color="${escAttr(f.color || 'violet')}" style="--folder-color:${colorHex}" draggable="true" tabindex="0" role="button" aria-label="Ouvrir le dossier ${escAttr(f.name)}">
        <div class="folder-card-head">
          <span class="folder-card-icon">${tyI('folder', 18)}</span>
          <span class="folder-card-name">${escHtml(f.name)}</span>
          <span class="folder-card-count">${totalCount}</span>
          <button type="button" class="folder-card-menu" data-folder-edit="${escAttr(f.id)}" aria-label="Modifier le dossier" title="Modifier le dossier">
            ${tyI('more-horizontal', 16)}
          </button>
        </div>
        <div class="folder-card-stack">${stackHtml}</div>
      </div>
    `;
  }).join('');

  const templateCardsHtml = displayTemplates.map(t => `
    <div class="template-card" data-id="${escAttr(t.id)}" draggable="true" data-merge-label="Créer un dossier">
      <div class="template-card-header">
        <strong>${escHtml(t.name)}</strong>
      </div>
      <div class="template-card-sub">${escHtml(t.subject || '')}</div>
      <div class="template-card-actions">
        <button type="button" class="btn btn-sm btn-with-icon" onclick="editTemplate('${t.id}')">${tyI('pencil', 15)} Modifier</button>
        <button type="button" class="btn btn-sm btn-danger btn-with-icon" onclick="deleteTemplate('${t.id}')">${tyI('trash', 15)} Supprimer</button>
      </div>
    </div>
  `).join('');

  // Dans un dossier vide, on affiche un petit hint de drop.
  const emptyFolderHint = (currentFolderId && displayTemplates.length === 0)
    ? `<div class="empty-state-card" style="grid-column: 1 / -1;">
         <div class="empty-state-icon" aria-hidden="true">${tyI('folder-open', 40)}</div>
         <h2 class="empty-state-title">Ce dossier est vide</h2>
         <p class="empty-state-text">Retournez à « Tous les templates » puis glissez des letters ici.</p>
       </div>`
    : '';

  list.innerHTML = folderCardsHtml + templateCardsHtml + emptyFolderHint;

  if (typeof tyHydrateIcons === 'function') tyHydrateIcons(list);

  bindTemplateDragAndDrop(list);
  bindFolderCardInteractions(list);
}

/**
 * Construit le fil d'Ariane (chemin du dossier courant, cliquable, cibles de drop).
 * @param {HTMLElement|null} breadcrumb
 * @param {string} currentFolderId
 * @param {Map<string, any>} folderById
 */
function renderTemplatesBreadcrumb(breadcrumb, currentFolderId, folderById) {
  if (!breadcrumb) return;
  if (!currentFolderId) {
    breadcrumb.classList.add('hidden');
    breadcrumb.innerHTML = '';
    return;
  }

  // Remonter la chaîne des parents jusqu'à la racine.
  const chain = [];
  let cur = folderById.get(currentFolderId);
  const guard = new Set();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    chain.unshift(cur);
    cur = cur.parent_id ? folderById.get(cur.parent_id) : null;
  }

  let html = `
    <button type="button" class="templates-breadcrumb-root" id="templatesBreadcrumbRoot" data-drop-folder="">
      ${tyI('arrow-left', 16)}
      <span>Tous les templates</span>
    </button>
  `;
  chain.forEach((f, idx) => {
    const isLast = idx === chain.length - 1;
    html += `<span class="templates-breadcrumb-sep" aria-hidden="true">/</span>`;
    if (isLast) {
      html += `<span class="templates-breadcrumb-current" id="templatesBreadcrumbCurrent" style="--folder-color:${folderColorHex(f.color)}">${escHtml(f.name)}</span>`;
    } else {
      html += `<button type="button" class="templates-breadcrumb-crumb" data-folder-id="${escAttr(f.id)}" data-drop-folder="${escAttr(f.id)}" style="--folder-color:${folderColorHex(f.color)}">${escHtml(f.name)}</button>`;
    }
  });
  html += `<span class="templates-breadcrumb-hint" id="templatesBreadcrumbHint">Glissez un élément ici pour le déplacer</span>`;

  breadcrumb.innerHTML = html;
  breadcrumb.classList.remove('hidden');
  if (typeof tyHydrateIcons === 'function') tyHydrateIcons(breadcrumb);

  const rootBtn = breadcrumb.querySelector('#templatesBreadcrumbRoot');
  if (rootBtn) rootBtn.addEventListener('click', () => enterTemplateFolder(''));

  breadcrumb.querySelectorAll('.templates-breadcrumb-crumb').forEach(btn => {
    btn.addEventListener('click', () => enterTemplateFolder(btn.dataset.folderId || ''));
  });
}

/** Palette prédéfinie de couleurs de dossier. */
const FOLDER_COLOR_PRESETS = {
  violet: '#7c3aed',
  blue:   '#3b82f6',
  cyan:   '#06b6d4',
  green:  '#10b981',
  amber:  '#f59e0b',
  rose:   '#f43f5e',
  slate:  '#64748b'
};

/** Retourne une couleur hex à partir d'une valeur stockée (nom de preset ou hex). */
function folderColorHex(value) {
  if (!value) return FOLDER_COLOR_PRESETS.violet;
  const raw = String(value).trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)) return raw;
  return FOLDER_COLOR_PRESETS[raw] || FOLDER_COLOR_PRESETS.violet;
}

/**
 * Active le drag & drop natif sur toutes les cartes rendues.
 * - Glisser un template sur un dossier = le déplacer dedans
 * - Glisser un template sur un autre template (600 ms) = créer un dossier qui contient les deux
 * - Glisser un template vers la breadcrumb (mode dossier) = le sortir du dossier
 */
function bindTemplateDragAndDrop(list) {
  const cards = list.querySelectorAll('.template-card');
  const folders = list.querySelectorAll('.folder-card');
  const breadcrumb = document.getElementById('templatesBreadcrumb');

  const clearMerge = () => {
    if (state.templateDnd.hoverMergeTimer) {
      clearTimeout(state.templateDnd.hoverMergeTimer);
      state.templateDnd.hoverMergeTimer = null;
    }
    if (state.templateDnd.hoverMergeId) {
      const prev = list.querySelector(`.template-card[data-id="${cssEsc(state.templateDnd.hoverMergeId)}"]`);
      if (prev) prev.classList.remove('merge-target');
      state.templateDnd.hoverMergeId = null;
    }
  };

  const resetDrag = () => {
    state.templateDnd.draggingId = null;
    state.templateDnd.draggingKind = null;
    clearMerge();
    list.querySelectorAll('.drop-hover').forEach(el => el.classList.remove('drop-hover'));
    if (breadcrumb) {
      breadcrumb.classList.remove('drop-hover');
      breadcrumb.querySelectorAll('.drop-hover').forEach(el => el.classList.remove('drop-hover'));
    }
  };

  cards.forEach(card => {
    card.addEventListener('dragstart', e => {
      state.templateDnd.draggingId = card.dataset.id;
      state.templateDnd.draggingKind = 'template';
      card.classList.add('is-dragging');
      list.classList.add('has-dragging');
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.id || '');
      } catch (_) { /* safari */ }
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      list.classList.remove('has-dragging');
      resetDrag();
    });

    // Hover sur un autre template → timer pour créer un dossier.
    card.addEventListener('dragover', e => {
      const dragging = state.templateDnd.draggingId;
      const kind = state.templateDnd.draggingKind;
      if (!dragging || kind !== 'template' || dragging === card.dataset.id) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

      if (state.templateDnd.hoverMergeId !== card.dataset.id) {
        clearMerge();
        state.templateDnd.hoverMergeId = card.dataset.id;
        state.templateDnd.hoverMergeTimer = setTimeout(() => {
          card.classList.add('merge-target');
        }, 420);
      }
    });

    card.addEventListener('dragleave', e => {
      if (e.currentTarget.contains(e.relatedTarget)) return;
      if (state.templateDnd.hoverMergeId === card.dataset.id) {
        clearMerge();
      }
    });

    card.addEventListener('drop', async e => {
      e.preventDefault();
      const sourceId = state.templateDnd.draggingId;
      const kind = state.templateDnd.draggingKind;
      const targetId = card.dataset.id;
      const hadMergeHover = card.classList.contains('merge-target');
      clearMerge();
      if (!sourceId || kind !== 'template' || !targetId || sourceId === targetId) return;
      if (!hadMergeHover) return;
      await createFolderFromMerge(sourceId, targetId);
    });
  });

  folders.forEach(folder => {
    folder.addEventListener('dragstart', e => {
      state.templateDnd.draggingId = folder.dataset.folderId;
      state.templateDnd.draggingKind = 'folder';
      folder.classList.add('is-dragging');
      list.classList.add('has-dragging');
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', folder.dataset.folderId || '');
      } catch (_) { /* safari */ }
    });

    folder.addEventListener('dragend', () => {
      folder.classList.remove('is-dragging');
      list.classList.remove('has-dragging');
      resetDrag();
    });

    folder.addEventListener('dragover', e => {
      const dragging = state.templateDnd.draggingId;
      const kind = state.templateDnd.draggingKind;
      if (!dragging) return;
      // Un dossier ne peut pas être glissé sur lui-même.
      if (kind === 'folder' && dragging === folder.dataset.folderId) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      folder.classList.add('drop-hover');
    });
    folder.addEventListener('dragleave', e => {
      if (folder.contains(e.relatedTarget)) return;
      folder.classList.remove('drop-hover');
    });
    folder.addEventListener('drop', async e => {
      e.preventDefault();
      folder.classList.remove('drop-hover');
      const sourceId = state.templateDnd.draggingId;
      const kind = state.templateDnd.draggingKind;
      const targetId = folder.dataset.folderId || null;
      if (!sourceId) return;
      if (kind === 'folder') {
        if (sourceId === targetId) return;
        await moveFolderToFolder(sourceId, targetId);
      } else {
        await moveTemplateToFolder(sourceId, targetId);
      }
    });
  });

  if (breadcrumb) {
    const dropTargets = breadcrumb.querySelectorAll('[data-drop-folder]');
    dropTargets.forEach(el => {
      el.addEventListener('dragover', e => {
        const dragging = state.templateDnd.draggingId;
        if (!dragging) return;
        const targetId = el.dataset.dropFolder || '';
        // Pas de sens de déposer un dossier sur lui-même.
        if (state.templateDnd.draggingKind === 'folder' && dragging === targetId) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        el.classList.add('drop-hover');
      });
      el.addEventListener('dragleave', ev => {
        if (el.contains(ev.relatedTarget)) return;
        el.classList.remove('drop-hover');
      });
      el.addEventListener('drop', async e => {
        e.preventDefault();
        el.classList.remove('drop-hover');
        const sourceId = state.templateDnd.draggingId;
        const kind = state.templateDnd.draggingKind;
        if (!sourceId) return;
        const targetId = el.dataset.dropFolder || '';
        const parentId = targetId === '' ? null : targetId;
        if (kind === 'folder') {
          if (sourceId === targetId) return;
          await moveFolderToFolder(sourceId, parentId);
        } else {
          await moveTemplateToFolder(sourceId, parentId);
        }
      });
    });
  }
}

function bindFolderCardInteractions(list) {
  list.querySelectorAll('.folder-card').forEach(folder => {
    folder.addEventListener('click', e => {
      // Ignorer le clic s'il provenait du bouton de menu
      if (e.target.closest('[data-folder-edit]')) return;
      enterTemplateFolder(folder.dataset.folderId);
    });

    folder.addEventListener('dblclick', e => {
      if (e.target.closest('[data-folder-edit]')) return;
      const fid = folder.dataset.folderId;
      const f = (state.templateFolders || []).find(x => x.id === fid);
      if (f) openFolderEditDialog(f);
    });

    folder.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        enterTemplateFolder(folder.dataset.folderId);
      }
    });

    const menuBtn = folder.querySelector('[data-folder-edit]');
    if (menuBtn) {
      menuBtn.addEventListener('click', e => {
        e.stopPropagation();
        const fid = menuBtn.dataset.folderEdit;
        const f = (state.templateFolders || []).find(x => x.id === fid);
        if (f) openFolderEditDialog(f);
      });
    }
  });
}

function enterTemplateFolder(folderId) {
  state.currentTemplateFolderId = folderId || '';
  renderTemplates(state.templates);
}

async function moveTemplateToFolder(templateId, folderId) {
  const res = await api('template_move', 'POST', {
    template_id: templateId,
    folder_id: folderId || null
  });
  if (!res.success) {
    alert('Impossible de déplacer le template : ' + (res.error || 'erreur inconnue'));
    return;
  }
  await loadTemplates();
}

async function moveFolderToFolder(folderId, parentId) {
  if (!folderId) return;
  const res = await api('template_folder_move', 'POST', {
    folder_id: folderId,
    parent_id: parentId || null
  });
  if (!res.success) {
    alert('Impossible de déplacer le dossier : ' + (res.error || 'erreur inconnue'));
    return;
  }
  await loadTemplates();
}

async function createFolderFromMerge(templateAId, templateBId) {
  const a = (state.templates || []).find(x => String(x.id) === String(templateAId));
  const b = (state.templates || []).find(x => String(x.id) === String(templateBId));
  const defaultName = a && b ? `Dossier ${a.name} & ${b.name}`.slice(0, 40) : 'Nouveau dossier';
  const name = prompt('Nom du nouveau dossier :', defaultName);
  if (name === null) return;
  const trimmed = name.trim();
  if (!trimmed) return;

  const parentId = state.currentTemplateFolderId || null;
  const createRes = await api('template_folders', 'POST', { name: trimmed, color: 'violet', parent_id: parentId });
  if (!createRes.success || !createRes.data || !createRes.data.id) {
    alert('Erreur création dossier : ' + (createRes.error || ''));
    return;
  }
  const newFolderId = createRes.data.id;
  await Promise.all([
    api('template_move', 'POST', { template_id: templateAId, folder_id: newFolderId }),
    api('template_move', 'POST', { template_id: templateBId, folder_id: newFolderId })
  ]);
  await loadTemplates();
}

// ----- Folder edit dialog ---------------------------------------------------

let _folderEditCtx = null;

function initFolderEditDialog() {
  const dlg = document.getElementById('folderEditDialog');
  if (!dlg || dlg.dataset.initialized === '1') return;
  dlg.dataset.initialized = '1';

  dlg.addEventListener('click', e => {
    if (e.target === dlg) closeFolderEditDialog();
  });

  document.getElementById('folderEditCancel')?.addEventListener('click', closeFolderEditDialog);
  document.getElementById('folderEditSave')?.addEventListener('click', handleFolderEditSave);
  document.getElementById('folderEditDelete')?.addEventListener('click', handleFolderEditDelete);

  document.getElementById('folderColorPicker')?.addEventListener('click', e => {
    const btn = e.target.closest('.folder-color-swatch');
    if (!btn) return;
    selectFolderColorSwatch(btn.dataset.color || 'violet');
  });

  const customInput = document.getElementById('folderColorCustom');
  if (customInput) {
    const handler = () => selectFolderColorSwatch(customInput.value || '#7c3aed');
    customInput.addEventListener('input', handler);
    customInput.addEventListener('change', handler);
  }

  dlg.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeFolderEditDialog();
    if (e.key === 'Enter' && e.target && e.target.id === 'folderEditName') handleFolderEditSave();
  });
}

function selectFolderColorSwatch(color) {
  const isHex = typeof color === 'string' && color.startsWith('#');
  document.querySelectorAll('#folderColorPicker .folder-color-swatch').forEach(el => {
    el.classList.toggle('is-selected', !isHex && el.dataset.color === color);
  });
  const customLabel = document.querySelector('#folderColorPicker .folder-color-custom');
  const customInput = document.getElementById('folderColorCustom');
  if (customLabel) {
    customLabel.classList.toggle('is-selected', isHex);
    customLabel.style.setProperty('--swatch', isHex ? color : (customInput ? customInput.value : '#7c3aed'));
  }
  if (customInput && isHex && customInput.value.toLowerCase() !== color.toLowerCase()) {
    customInput.value = color;
  }
  if (_folderEditCtx) _folderEditCtx.color = color;
}

function openFolderEditDialog(folder) {
  initFolderEditDialog();
  const dlg = document.getElementById('folderEditDialog');
  if (!dlg) return;
  _folderEditCtx = {
    id: folder ? folder.id : '',
    color: folder ? (folder.color || 'violet') : 'violet'
  };
  const title = document.getElementById('folderEditDialogTitle');
  if (title) title.textContent = folder ? 'Renommer le dossier' : 'Nouveau dossier';
  const nameInput = document.getElementById('folderEditName');
  if (nameInput) {
    nameInput.value = folder ? folder.name : '';
    setTimeout(() => nameInput.focus(), 40);
  }
  // Pré-remplir le color-picker natif avec la couleur hex équivalente.
  const customInput = document.getElementById('folderColorCustom');
  if (customInput) customInput.value = folderColorHex(_folderEditCtx.color);
  selectFolderColorSwatch(_folderEditCtx.color);
  const delBtn = document.getElementById('folderEditDelete');
  if (delBtn) delBtn.classList.toggle('hidden', !folder);
  dlg.classList.remove('hidden');
  dlg.setAttribute('aria-hidden', 'false');
  if (typeof tyHydrateIcons === 'function') tyHydrateIcons(dlg);
}

function closeFolderEditDialog() {
  const dlg = document.getElementById('folderEditDialog');
  if (!dlg) return;
  dlg.classList.add('hidden');
  dlg.setAttribute('aria-hidden', 'true');
  _folderEditCtx = null;
}

async function handleFolderEditSave() {
  if (!_folderEditCtx) return;
  const name = (document.getElementById('folderEditName') || {}).value || '';
  const trimmed = name.trim();
  if (!trimmed) {
    alert('Le nom du dossier est requis.');
    return;
  }
  const payload = {
    name: trimmed,
    color: _folderEditCtx.color || 'violet'
  };
  if (_folderEditCtx.id) {
    payload.id = _folderEditCtx.id;
  } else {
    // À la création, ancrer le nouveau dossier dans le dossier courant.
    payload.parent_id = state.currentTemplateFolderId || null;
  }
  const res = await api('template_folders', 'POST', payload);
  if (!res.success) {
    alert('Erreur sauvegarde : ' + (res.error || ''));
    return;
  }
  closeFolderEditDialog();
  await loadTemplates();
}

async function handleFolderEditDelete() {
  if (!_folderEditCtx || !_folderEditCtx.id) return;
  if (!confirm('Supprimer ce dossier ? Les templates qu’il contient retourneront à la racine.')) return;
  const res = await api('template_folder&id=' + encodeURIComponent(_folderEditCtx.id), 'DELETE');
  if (!res.success) {
    alert('Erreur suppression : ' + (res.error || ''));
    return;
  }
  // Si on était à l'intérieur de ce dossier, remonter à la racine.
  if (state.currentTemplateFolderId === _folderEditCtx.id) {
    state.currentTemplateFolderId = '';
  }
  closeFolderEditDialog();
  await loadTemplates();
}

function cssEsc(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, ch => '\\' + ch);
}

function clearTemplateForm() {
  destroyTemplateVisualEditor();
  state.templateHtmlEditMode = 'code';
  document.getElementById('templateVisualWrap')?.classList.add('hidden');
  document.getElementById('templateCodeEditorWrap')?.classList.remove('hidden');
  document.getElementById('templateModeVisualBtn')?.classList.remove('segmented-btn--active');
  document.getElementById('templateModeCodeBtn')?.classList.add('segmented-btn--active');
  ['templateId', 'templateName', 'templateSubject', 'templateText'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  setTemplateHtmlValue('');
  const ru = document.getElementById('templateRotateUrls');
  if (ru) ru.value = '';
  const re = document.getElementById('templateRotateEvery');
  if (re) re.value = '1';
  syncTemplateRotateHint();
}

async function editTemplate(id) {
  const res = await api('template&id=' + id);
  if (!res.success) return alert('Impossible de charger le template.');
  const t = res.data;
  const setVal = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
  setVal('templateId', t.id);
  setVal('templateName', t.name);
  setVal('templateSubject', t.subject);
  setTemplateHtmlValue(t.html || '');
  setVal('templateText', t.text);
  const ru = document.getElementById('templateRotateUrls');
  if (ru) {
    ru.value = Array.isArray(t.rotate_urls) ? t.rotate_urls.join('\n') : '';
  }
  const re = document.getElementById('templateRotateEvery');
  if (re) re.value = String(Math.max(1, parseInt(t.rotate_url_every, 10) || 1));
  openTemplateEditorModal();
  scheduleTemplateRotateHintSync();
}

async function saveTemplate(options = {}) {
  const closeAfter = options.closeAfter === true;
  const showToast = options.showToast !== false;

  const getVal = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const id = getVal('templateId');
  const name = getVal('templateName');
  const subject = getVal('templateSubject');
  const html = getTemplateHtmlValue().trim();
  const text = getVal('templateText');
  const rotate_urls = getTemplateRotateUrlsFromTextarea();
  const rotate_url_every = Math.max(1, parseInt((document.getElementById('templateRotateEvery') || {}).value, 10) || 1);

  if (!name) return alert('Le nom du template est requis.');

  // Détermine le dossier cible :
  //  - En édition : on conserve le folder_id actuel du template (ne pas le remettre à la racine)
  //  - En création : si l'utilisateur est dans un dossier, on y crée le nouveau template
  let folderId = null;
  if (id) {
    const existing = (state.templates || []).find(t => String(t.id) === String(id));
    folderId = (existing && existing.folder_id) ? existing.folder_id : null;
  } else {
    folderId = state.currentTemplateFolderId || null;
  }

  const body = { name, subject, html, text, rotate_urls, rotate_url_every, folder_id: folderId };
  let res;
  if (id) {
    res = await api('templates', 'POST', { ...body, id });
  } else {
    res = await api('templates', 'POST', body);
  }

  if (!res.success) return alert('Erreur lors de la sauvegarde : ' + (res.error || ''));

  const savedId = res.data && res.data.id;
  if (savedId) {
    const hid = document.getElementById('templateId');
    if (hid) hid.value = savedId;
    const titleEl = document.getElementById('templateEditorModalTitle');
    if (titleEl) titleEl.textContent = 'Modifier le template';
  }

  markTemplateEditorClean();
  await loadTemplates();

  if (showToast) showTemplateSaveToast();

  if (closeAfter) {
    hideTemplateUnsavedDialog();
    forceCloseTemplateEditorModal();
  }
}

async function deleteTemplate(id) {
  if (!confirm('Supprimer ce template ?')) return;
  const res = await api('template&id=' + id, 'DELETE');
  if (!res.success) return alert('Erreur lors de la suppression.');
  await loadTemplates();
}

// ============================================
// CAMPAIGNS
// ============================================

async function initCampaigns() {
  await loadCampaigns();

  const newBtn = document.getElementById('newCampaignBtn');
  if (newBtn) {
    newBtn.addEventListener('click', async () => {
      resetNewCampaignForm();
      document.getElementById('campaignForm').classList.remove('hidden');
      document.getElementById('campaignsList').classList.add('hidden');
      document.getElementById('campaignsEmptyState')?.classList.add('hidden');
      populateTemplateChips();
      await populateSmtpSelect();
    });
  }

  const cancelFormBtn = document.getElementById('cancelCampaignFormBtn');
  if (cancelFormBtn) cancelFormBtn.addEventListener('click', backToCampaignListFromForm);

  const exitEditBtn = document.getElementById('exitEditCampaignBtn');
  if (exitEditBtn) exitEditBtn.addEventListener('click', backToCampaignListFromForm);

  initUploadDragDrop();
  initCampaignSmtpInline();

  // Accordion
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const body = header.nextElementSibling;
      const isOpen = !body.classList.contains('hidden');

      // Close all
      document.querySelectorAll('.accordion-body').forEach(b => b.classList.add('hidden'));
      document.querySelectorAll('.accordion-chevron').forEach(c => tySetAccordionChevron(c, false));

      if (!isOpen) {
        body.classList.remove('hidden');
        const chevron = header.querySelector('.accordion-chevron');
        if (chevron) tySetAccordionChevron(chevron, true);
      }
    });
  });

  // File upload
  const fileInput = document.getElementById('recipientsFile');
  if (fileInput) {
    fileInput.addEventListener('change', handleFileUpload);
  }

  // Analyze button
  const analyzeBtn = document.getElementById('analyzeBtn');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', handleAnalyze);
  }

  // Send button → résumé puis confirmation
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => openSendSummaryModal(false));
  }

  document.getElementById('sendSummaryCancel')?.addEventListener('click', closeSendSummaryModal);
  document.getElementById('sendSummaryConfirm')?.addEventListener('click', () => confirmSendSummaryAndRun());
  document.getElementById('sendSummaryModal')?.addEventListener('click', e => {
    if (e.target && e.target.id === 'sendSummaryModal') closeSendSummaryModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const sm = document.getElementById('sendSummaryModal');
    if (sm && !sm.classList.contains('hidden')) closeSendSummaryModal();
  });

  // Force send → même résumé avec avertissement score
  const forceSendLink = document.getElementById('forceSendLink');
  if (forceSendLink) {
    forceSendLink.addEventListener('click', e => {
      e.preventDefault();
      openSendSummaryModal(true);
    });
  }

  const confirmForce = document.getElementById('confirmForceSend');
  if (confirmForce) {
    confirmForce.addEventListener('click', () => {
      const modal = document.getElementById('forceSendModal');
      if (modal) modal.classList.add('hidden');
      openSendSummaryModal(true);
    });
  }

  const cancelForce = document.getElementById('cancelForceSend');
  if (cancelForce) {
    cancelForce.addEventListener('click', () => {
      const modal = document.getElementById('forceSendModal');
      if (modal) modal.classList.add('hidden');
    });
  }

  initCsvMappingUI();
}

async function loadCampaigns() {
  const res = await api('campaigns');
  if (!res.success) return;
  renderCampaignsList(res.data || []);
}

function renderCampaignsList(campaigns) {
  const list = document.getElementById('campaignsList');
  const emptyEl = document.getElementById('campaignsEmptyState');
  if (!list) return;

  if (campaigns.length === 0) {
    list.innerHTML = '';
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      emptyEl.innerHTML = `
        <div class="empty-state-card">
          <div class="empty-state-icon" aria-hidden="true">${tyI('clipboard-list', 40)}</div>
          <h2 class="empty-state-title">Aucune campagne</h2>
          <p class="empty-state-text">Importez une liste CSV ou TXT, choisissez des templates et un SMTP, puis lancez l’envoi.</p>
          <button type="button" class="btn-primary btn-with-icon" id="emptyStateNewCampaignBtn">${tyI('plus', 18)} Nouvelle campagne</button>
        </div>`;
      document.getElementById('emptyStateNewCampaignBtn')?.addEventListener('click', () => {
        document.getElementById('newCampaignBtn')?.click();
      });
      if (typeof tyHydrateIcons === 'function') tyHydrateIcons(emptyEl);
    }
    return;
  }

  if (emptyEl) {
    emptyEl.classList.add('hidden');
    emptyEl.innerHTML = '';
  }

  const statusMeta = {
    running:     { icon: 'activity', text: 'En cours', cls: 'running' },
    completed:   { icon: 'check-circle', text: 'Terminée', cls: 'done' },
    done:        { icon: 'check-circle', text: 'Terminée', cls: 'done' },
    failed:      { icon: 'x-circle', text: 'Échouée', cls: 'failed' },
    stopped:     { icon: 'square', text: 'Arrêtée', cls: 'done' },
    interrupted: { icon: 'alert-triangle', text: 'Interrompue', cls: 'failed' },
    pending:     { icon: 'clock', text: 'En attente', cls: 'pending' },
  };

  list.innerHTML = campaigns.map(c => {
    const stats = c.stats || {};
    const sm = statusMeta[c.status] || { icon: null, text: c.status || 'Inconnue', cls: 'done' };
    const date = c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    const pct = stats.total > 0 ? Math.round((stats.sent || 0) / stats.total * 100) : 0;
    const id = escAttr(c.id);
    return `
      <div class="campaign-card" onclick="showCampaignDetail('${id}')">
        <div class="campaign-card-top">
          <div class="campaign-card-info">
            <span class="campaign-status-badge ${sm.cls}">${sm.icon ? tyI(sm.icon, 14) : ''}<span>${escHtml(sm.text)}</span></span>
            <div class="campaign-card-name">${escHtml(c.name || 'Sans nom')}</div>
            <div class="campaign-card-date">${date}</div>
          </div>
          <div class="campaign-card-stats">
            <div class="campaign-stat-item">
              <span class="campaign-stat-val success">${(stats.sent || 0).toLocaleString('fr-FR')}</span>
              <span class="campaign-stat-lbl">Envoyés</span>
            </div>
            <div class="campaign-stat-item">
              <span class="campaign-stat-val danger">${(stats.failed || 0).toLocaleString('fr-FR')}</span>
              <span class="campaign-stat-lbl">Échecs</span>
            </div>
            <div class="campaign-stat-item">
              <span class="campaign-stat-val muted">${(stats.total || 0).toLocaleString('fr-FR')}</span>
              <span class="campaign-stat-lbl">Total</span>
            </div>
            ${stats.total > 0 ? `
            <div class="campaign-stat-item">
              <span class="campaign-stat-val accent">${pct}%</span>
              <span class="campaign-stat-lbl">Progression</span>
            </div>` : ''}
          </div>
        </div>
        <div class="campaign-card-footer" onclick="event.stopPropagation()">
          <button type="button" class="btn btn-sm btn-with-icon" onclick="showCampaignDetail('${id}')">
            ${c.status === 'running' ? tyI('radio', 16) + ' Monitoring live' : tyI('list', 16) + ' Voir les logs'}
          </button>
          ${c.status !== 'running' ? `<button type="button" class="btn btn-sm btn-primary btn-with-icon" onclick="event.stopPropagation(); openEditCampaign('${id}')">${tyI('pencil', 15)} Modifier</button>
          <button type="button" class="btn btn-sm btn-with-icon" onclick="event.stopPropagation(); relaunchCampaign('${id}')">${tyI('refresh-cw', 15)} Relancer</button>` : ''}
          <span class="btn-spacer"></span>
          <button type="button" class="btn btn-sm btn-danger btn-with-icon" title="Supprimer" aria-label="Supprimer la campagne" onclick="deleteCampaignCard('${id}')">${tyI('trash', 16)}</button>
        </div>
      </div>
    `;
  }).join('');
}

async function populateTemplateChips() {
  const container = document.getElementById('templateSelector');
  if (!container) return;

  const res = await api('templates');
  if (!res.success) return;
  const templates = res.data || [];

  container.innerHTML = templates.map(t => `
    <div class="template-chip" data-id="${t.id}" data-subject="${escAttr(t.subject || '')}">
      ${escHtml(t.name)}
    </div>
  `).join('');

  container.querySelectorAll('.template-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
      refreshCampaignSendButtonState();
    });
  });
}

async function populateSmtpSelect(preferId = null, options = {}) {
  const select = document.getElementById('smtpConfigSelect');
  if (!select) return;

  const preferredFromEmail = options.preferredFromEmail != null ? options.preferredFromEmail : '';
  const preferredRotationIds = Array.isArray(options.preferredRotationIds) ? options.preferredRotationIds.map(String) : [];
  const preferredSenderMap = options.preferredSenderMap && typeof options.preferredSenderMap === 'object'
    ? options.preferredSenderMap
    : null;

  const keep =
    preferId != null && preferId !== ''
      ? String(preferId)
      : (select.value && select.value !== '__new__' ? select.value : '');

  const res = await api('smtp_configs');
  if (!res.success) return;
  state.smtpConfigs = res.data || [];

  const opts = [
    '<option value="">— Choisir un SMTP —</option>',
    '<option value="__new__">+ Nouveau SMTP (créer et utiliser)</option>',
    ...state.smtpConfigs.map(s => {
      const id = String(s.id).replace(/"/g, '&quot;');
      return `<option value="${id}">${escHtml(s.name || s.host || 'Config ' + s.id)}</option>`;
    })
  ];
  select.innerHTML = opts.join('');

  const rotSelect = document.getElementById('smtpRotationSelect');
  if (rotSelect) {
    renderSmtpRotationChecklist(preferredRotationIds);
  }

  const optValues = [...select.options].map(o => o.value);
  if (keep && optValues.includes(keep)) {
    select.value = keep;
    toggleCampaignSmtpNewPanel(false);
  } else if (select.value === '__new__') {
    toggleCampaignSmtpNewPanel(true);
  } else {
    toggleCampaignSmtpNewPanel(false);
  }

  syncRotationSelectionWithPrimarySmtp();
  renderSmtpSenderOverridesList(preferredSenderMap);
  syncSmtpSenderOverridesDisabledState();
  syncCampaignFromEmailVisibility();

  await refreshCampaignVerifiedSenders({ silent: true, preferredEmail: preferredFromEmail });
}

async function handleFileUpload() {
  const input = document.getElementById('recipientsFile');
  if (!input || !input.files[0]) return;

  const file = input.files[0];
  const ext = file.name.split('.').pop().toLowerCase();
  if (['xlsx', 'xls'].includes(ext)) {
    alert('Les fichiers Excel ne sont pas pris en charge. Exportez votre table en CSV (une ligne d’en-têtes + une ligne par contact).');
    input.value = '';
    return;
  }
  const fileType = ext === 'txt' ? 'txt' : 'csv';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('file_type', fileType);

  try {
    const res = await fetch('index.php?action=upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (!data.success) return alert('Erreur upload: ' + (data.error || ''));

    state.uploadedFilePath = data.data.filepath;
    state.uploadedFileType = data.data.file_type || fileType;

    if (fileType === 'txt') {
      showCsvMappingPanel(false);
      clearCsvCustomVarRows();
      state.csvHeaders = [];
      setCsvMappingWarning('');
      const parseRes = await api('parse_recipients', 'POST', {
        file_path: state.uploadedFilePath,
        file_type: 'txt'
      });
      if (!parseRes.success) return alert('Erreur parsing: ' + (parseRes.error || ''));

      state.uploadedTotal = parseRes.data.total || 0;
      const domains = parseRes.data.domains || {};
      const summaryEl = document.getElementById('domainSummary');
      if (summaryEl) {
        const parts = Object.entries(domains)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([domain, count]) => `${capitalize(domain)}: ${count.toLocaleString()}`);
        summaryEl.textContent = parts.join(' | ') + ` (Total: ${state.uploadedTotal.toLocaleString()})`;
        summaryEl.classList.toggle('hidden', state.uploadedTotal === 0);
      }
      document.getElementById('domainFilters')?.classList.toggle('hidden', state.uploadedTotal === 0);
    } else {
      const headers = (data.data.validation && data.data.validation.headers) || [];
      state.csvHeaders = Array.isArray(headers) ? headers : [];
      clearCsvCustomVarRows();
      showCsvMappingPanel(state.csvHeaders.length > 0);
      populateCsvColumnSelects();
      const emailGuess = inferEmailColumnFromHeaders(state.csvHeaders);
      const em = document.getElementById('csvEmailColumn');
      if (em && emailGuess && [...em.options].some(o => o.value === emailGuess)) {
        em.value = emailGuess;
      } else if (em) {
        em.value = '';
      }
      await reparseRecipientsWithCurrentMapping();
    }

    updateUploadFileHint();
    refreshCampaignSendButtonState();
  } catch (err) {
    alert('Erreur lors de l\'upload: ' + err.message);
  }
}

async function handleAnalyze() {
  const cfg = collectCampaignConfig();
  if (cfg.template_ids.length === 0) return alert('Sélectionnez au moins un template.');
  if (!hasUsableFromEmail(cfg)) return alert('Choisissez un email expéditeur.');

  const res = await api('score', 'POST', {
    template_ids: cfg.template_ids,
    campaign: { from_email: cfg.from_email, unsubscribe_url: cfg.unsubscribe_url }
  });

  if (!res.success) return alert('Erreur analyse: ' + (res.error || ''));

  state.scoreData = res.data;

  const displayEl = document.getElementById('scoreDisplay');
  if (displayEl) {
    displayEl.classList.remove('hidden');
    renderScore(res.data, displayEl);
  }

  refreshCampaignSendButtonState();
}

function validateCampaignBeforeSend(force = false) {
  const config = collectCampaignConfig({ force_send: force });
  if (config.template_ids.length === 0) return 'Sélectionnez au moins un template.';
  if (config.smtp_rotation_enabled) {
    if (!Array.isArray(config.smtp_rotation_ids) || config.smtp_rotation_ids.length === 0) {
      return 'Sélectionnez au moins un SMTP pour la rotation.';
    }
  } else if (!config.smtp_config_id) {
    const sel = document.getElementById('smtpConfigSelect');
    if (sel && sel.value === '__new__') {
      return 'Enregistrez d’abord le nouveau SMTP (« Enregistrer & utiliser pour cette campagne »), ou sélectionnez une configuration existante.';
    }
    return 'Choisissez une configuration SMTP.';
  }
  if (!hasUsableFromEmail(config)) return 'Choisissez un email expéditeur (liste API ou saisie libre selon le fournisseur).';
  if (config.smtp_sender_mode === 'per_smtp') {
    const per = config.smtp_per_smtp && typeof config.smtp_per_smtp === 'object' ? config.smtp_per_smtp : {};
    const ids = listSmtpIdsFromConfig(config);
    for (const id of ids) {
      const row = per[id];
      if (!row || typeof row !== 'object') {
        return 'Configurez le sender par SMTP, ou repassez en sender par défaut.';
      }
      if (row.use_default_from === false && !String(row.from_email || '').trim()) {
        return `Renseignez un From email pour le SMTP ${smtpLabelForId(id)} (ou cochez "Use default From email").`;
      }
    }
  }
  if (!config.file_path) return 'Importez une liste de destinataires (ou rouvrez la campagne si le fichier a été perdu).';
  if (!state.editingCampaignId) {
    if (!force && (!state.scoreData || state.scoreData.score < 50)) {
      return 'Lancez d’abord l’analyse de délivrabilité, ou utilisez « Envoyer quand même » si vous acceptez le risque.';
    }
  }
  return null;
}

function formatEtaSeconds(sec) {
  if (sec == null || sec <= 0 || !Number.isFinite(sec)) return '—';
  if (sec < 90) return `≈ ${Math.max(1, Math.ceil(sec))} s`;
  if (sec < 3600) return `≈ ${Math.ceil(sec / 60)} min`;
  const h = Math.floor(sec / 3600);
  const m = Math.ceil((sec % 3600) / 60);
  return `≈ ${h} h ${m} min`;
}

function estimateEtaSeconds(totalOrRemaining, cfg = {}) {
  const count = Math.max(0, Number(totalOrRemaining) || 0);
  const dmin = Math.max(0, parseFloat(String(cfg.delay_min ?? 1).replace(',', '.')) || 0);
  const dmax = Math.max(dmin, parseFloat(String(cfg.delay_max ?? dmin).replace(',', '.')) || dmin);
  const mode = cfg.smtp_rotation_mode === 'parallel' ? 'parallel' : 'sequential';
  const smtpCount = cfg.smtp_rotation_enabled && Array.isArray(cfg.smtp_rotation_ids)
    ? Math.max(1, cfg.smtp_rotation_ids.filter(Boolean).length)
    : 1;
  if (mode !== 'parallel' || smtpCount <= 1) {
    return { low: count * dmin, high: count * dmax };
  }
  const perLane = Math.ceil(count / smtpCount);
  return { low: perLane * dmin, high: perLane * dmax };
}

function stopCampaignCompletionWatch() {
  if (state.completionWatchTimer != null) {
    clearInterval(state.completionWatchTimer);
    state.completionWatchTimer = null;
  }
  state.completionWatchCampaignId = null;
  state.completionWatchName = null;
}

function showCampaignDoneNotification(name, status) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const labels = {
    completed: 'terminée avec succès',
    failed: 'en échec',
    stopped: 'arrêtée',
    interrupted: 'interrompue'
  };
  const body = `« ${name || 'Campagne'} » : ${labels[status] || status}.`;
  try {
    new Notification('ChadMailer — Envoi terminé', { body, tag: 'tydra-end-' + status, requireInteraction: false });
  } catch (e) {
    /* ignore */
  }
}

function startCampaignCompletionWatch(campaignId, displayName) {
  stopCampaignCompletionWatch();
  if (!campaignId) return;
  state.completionWatchCampaignId = campaignId;
  state.completionWatchName = displayName || '';
  state.completionWatchTimer = setInterval(async () => {
    if (state.completionWatchCampaignId !== campaignId) {
      stopCampaignCompletionWatch();
      return;
    }
    const res = await api('campaign&id=' + encodeURIComponent(campaignId));
    if (!res.success || !res.data) return;
    const st = res.data.status;
    if (!['completed', 'failed', 'stopped', 'interrupted'].includes(st)) return;
    stopCampaignCompletionWatch();
    showCampaignDoneNotification(res.data.name || state.completionWatchName, st);
  }, 3200);
}

async function openSendSummaryModal(forceSend = false) {
  await ensureSmtpConfigs();
  await loadTemplates();
  const err = validateCampaignBeforeSend(forceSend);
  if (err) return alert(err);

  const nameEl = document.getElementById('campaignName');
  const name = nameEl && nameEl.value.trim() ? nameEl.value.trim() : 'Campagne ' + Date.now();
  const config = collectCampaignConfig({ force_send: forceSend });
  const chips = Array.from(document.querySelectorAll('.template-chip.selected'));
  const templateNames = chips.map(ch => {
    const id = ch.dataset.id;
    const t = (state.templates || []).find(x => String(x.id) === String(id));
    return t ? t.name : id;
  });

  const total = state.uploadedTotal || config.total_recipients || 0;
  const delayMin = config.delay_min ?? 1;
  const delayMax = config.delay_max ?? 3;
  const avgDelay = (delayMin + delayMax) / 2;
  const eta = estimateEtaSeconds(total, config);
  const etaLow = eta.low;
  const etaHigh = eta.high;

  const scoreBlock =
    state.scoreData && typeof state.scoreData.score === 'number'
      ? `<div class="send-summary-score ${state.scoreData.score < 50 ? 'send-summary-score--warn' : ''}">Score délivrabilité : <strong>${state.scoreData.score}</strong>/100</div>`
      : state.editingCampaignId
        ? '<p class="send-summary-note">Campagne existante — score non recalculé dans ce résumé.</p>'
        : '';

  const forceWarn = forceSend && state.scoreData && state.scoreData.score < 50
    ? '<p class="send-summary-warning"><strong>Envoi forcé</strong> : le score est sous le seuil recommandé.</p>'
    : '';

  const notifyHint = document.getElementById('sendSummaryNotifyHint');
  if (notifyHint) {
    const p = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
    notifyHint.classList.toggle('hidden', p === 'granted');
  }

  const body = document.getElementById('sendSummaryBody');
  if (body) {
    body.innerHTML = `
      ${forceWarn}
      ${scoreBlock}
      <ul class="send-summary-list">
        <li><span>Nom</span><strong>${escHtml(name)}</strong></li>
        <li><span>Destinataires (fichier)</span><strong>${total.toLocaleString('fr-FR')}</strong></li>
        <li><span>Templates</span><strong>${templateNames.length ? escHtml(templateNames.join(', ')) : '—'}</strong></li>
        <li><span>Expéditeur</span><strong>${escHtml(formatSenderRoutingLabel(config))}</strong></li>
        <li><span>SMTP</span><strong>${escHtml(formatSmtpRoutingLabel(config))}</strong></li>
        <li><span>Délai entre e-mails</span><strong>${delayMin}–${delayMax} s (moy. ${avgDelay.toFixed(1)} s${config.smtp_rotation_enabled && config.smtp_rotation_mode === 'parallel' ? ', par SMTP' : ''})</strong></li>
        <li><span>Durée estimée (ordre de grandeur)</span><strong>${formatEtaSeconds(etaLow)} — ${formatEtaSeconds(etaHigh)}</strong></li>
        <li><span>Rotation templates</span><strong>tous les ${config.template_rotation_frequency || 1} e-mail(s)</strong></li>
        <li><span>Fichier liste</span><strong>${escHtml((config.file_path || '').split('/').pop() || '—')}</strong></li>
      </ul>
    `;
  }

  state.sendSummaryPending = { forceSend, name, config };
  document.getElementById('sendSummaryModal')?.classList.remove('hidden');
  document.getElementById('sendSummaryModal')?.setAttribute('aria-hidden', 'false');
}

function closeSendSummaryModal() {
  document.getElementById('sendSummaryModal')?.classList.add('hidden');
  document.getElementById('sendSummaryModal')?.setAttribute('aria-hidden', 'true');
  state.sendSummaryPending = null;
}

async function confirmSendSummaryAndRun() {
  const pending = state.sendSummaryPending;
  if (!pending) return;

  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (e) {
      /* ignore */
    }
  }

  const { forceSend, name, config } = pending;
  closeSendSummaryModal();

  let campaignId;
  if (state.editingCampaignId) {
    const putRes = await api('campaign&id=' + encodeURIComponent(state.editingCampaignId), 'PUT', { name, config });
    if (!putRes.success) return alert('Erreur mise à jour campagne : ' + (putRes.error || ''));
    campaignId = state.editingCampaignId;
  } else {
    const createRes = await api('campaigns', 'POST', { name, config });
    if (!createRes.success) return alert('Erreur création campagne : ' + (createRes.error || ''));
    campaignId = createRes.data && createRes.data.id;
    if (!campaignId) return alert('Impossible de récupérer l\'ID de campagne.');
  }

  state.currentCampaignId = campaignId;
  const sendRes = await api('send', 'POST', { campaign_id: campaignId });
  if (!sendRes.success) return alert('Erreur envoi : ' + (sendRes.error || ''));

  startCampaignCompletionWatch(campaignId, name);

  state.editingCampaignId = null;
  setCampaignFormEditMode(false);
  document.getElementById('campaignForm')?.classList.add('hidden');
  showCampaignDetail(campaignId);
}

// ============================================
// CAMPAIGN DETAIL VIEW
// ============================================

async function showCampaignDetail(campaignId) {
  state.currentCampaignId = campaignId;
  state.editingCampaignId = null;
  setCampaignFormEditMode(false);

  // Hide list and form, show detail
  const list = document.getElementById('campaignsList');
  const form = document.getElementById('campaignForm');
  const detail = document.getElementById('campaignDetail');
  const newBtn = document.getElementById('newCampaignBtn');
  if (list) list.classList.add('hidden');
  if (form) form.classList.add('hidden');
  if (newBtn) newBtn.classList.add('hidden');
  if (detail) detail.classList.remove('hidden');

  // Clear logs
  const logsContainer = document.getElementById('detailLogsContainer');
  if (logsContainer) logsContainer.innerHTML = '<div class="log-line info">Chargement...</div>';

  // Load campaign with logs
  const res = await api('campaign&id=' + campaignId + '&with_logs');
  if (!res.success || !res.data) {
    if (logsContainer) logsContainer.innerHTML = '<div class="log-line failed">Impossible de charger la campagne.</div>';
    return;
  }

  const campaign = res.data;
  const stats = campaign.stats || {};
  state.configCacheForDetailEta = campaign.config || {};

  // Header
  const nameEl = document.getElementById('detailCampaignName');
  if (nameEl) nameEl.textContent = campaign.name || 'Campagne';

  const statusMeta = {
    running:     { icon: 'activity', text: 'En cours', color: '#22c55e' },
    completed:   { icon: 'check-circle', text: 'Terminée', color: '#64748b' },
    done:        { icon: 'check-circle', text: 'Terminée', color: '#64748b' },
    failed:      { icon: 'x-circle', text: 'Échouée', color: '#ef4444' },
    stopped:     { icon: 'square', text: 'Arrêtée', color: '#f59e0b' },
    interrupted: { icon: 'alert-triangle', text: 'Interrompue', color: '#f59e0b' },
    pending:     { icon: 'clock', text: 'En attente', color: '#64748b' },
  };
  const sm = statusMeta[campaign.status] || { icon: null, text: campaign.status, color: '#64748b' };
  const badgeEl = document.getElementById('detailStatusBadge');
  if (badgeEl) {
    badgeEl.style.color = sm.color;
    badgeEl.innerHTML =
      (sm.icon ? tyI(sm.icon, 16) : '') + '<span>' + escHtml(sm.text) + '</span>';
  }

  await ensureSmtpConfigs();
  const cfg = campaign.config || {};
  const metaBar = document.getElementById('detailMetaBar');
  if (metaBar) {
    const fromLine = escHtml(formatSenderRoutingLabel(cfg));
    metaBar.innerHTML = `
      <span><strong>De :</strong> ${fromLine}</span>
      <span><strong>SMTP :</strong> ${escHtml(formatSmtpRoutingLabel(cfg))}</span>
      <span><strong>Liste :</strong> ${escHtml((cfg.file_path || '').split('/').pop() || '—')}</span>
    `;
    metaBar.classList.remove('hidden');
  }

  const editHint = document.getElementById('detailEditHint');
  if (editHint) {
    if (campaign.status === 'running') {
      editHint.classList.add('hidden');
    } else {
      editHint.textContent = 'Pour changer la liste, l’expéditeur ou le SMTP avant un nouvel envoi, utilisez « Modifier la campagne ».';
      editHint.classList.remove('hidden');
    }
  }

  updateDetailStatsFromServer(stats, campaign.status);

  // Action buttons
  const actionsEl = document.getElementById('detailActions');
  const cid = escAttr(campaignId);
  if (actionsEl) {
    if (campaign.status === 'running') {
      actionsEl.innerHTML = `
        <button type="button" class="btn-warning btn-with-icon" id="detailPauseBtn">${tyI('pause', 16)} Pause</button>
        <button type="button" class="btn-danger btn-with-icon" id="detailStopBtn">${tyI('square', 16)} Stop</button>
      `;
      document.getElementById('detailPauseBtn').addEventListener('click', handlePause);
      document.getElementById('detailStopBtn').addEventListener('click', handleStop);
    } else {
      actionsEl.innerHTML = `
        <button type="button" class="btn-primary btn-with-icon" onclick="openEditCampaign('${cid}')">${tyI('pencil', 16)} Modifier la campagne</button>
        <button type="button" class="btn-secondary btn-with-icon" onclick="relaunchCampaign('${cid}')">${tyI('refresh-cw', 16)} Relancer tel quel</button>
      `;
    }
  }

  // Logs indicator
  const indicator = document.getElementById('detailLogsIndicator');
  if (indicator) {
    if (campaign.status === 'running') {
      indicator.innerHTML = tyI('activity', 12) + ' <span>live</span>';
      indicator.style.color = '#22c55e';
    } else {
      indicator.innerHTML = tyI('check', 12) + ' <span>' + (stats.sent || 0) + ' envoyés</span>';
      indicator.style.color = '#64748b';
    }
  }

  // Populate logs from API
  // Le serveur renvoie désormais `logs_total` (compteur monotone du fichier complet)
  // en plus des 500 dernières lignes, afin de permettre un streaming incrémental.
  const logsTotal = Number.isFinite(campaign.logs_total)
    ? campaign.logs_total
    : ((campaign.logs || []).length);
  if (logsContainer) {
    const logs = campaign.logs || [];
    if (logs.length === 0 && campaign.status !== 'running') {
      logsContainer.innerHTML = '<div class="log-line info" style="color:#64748b">Aucun log disponible pour cette campagne.</div>';
    } else {
      logsContainer.innerHTML = '';
      logs.forEach(line => {
        const div = document.createElement('div');
        // Detect status from log content
        const lower = line.toLowerCase();
        div.className = 'log-line ' + (lower.includes('erreur') || lower.includes('error') || lower.includes('failed') ? 'failed' : lower.includes('envoyé') || lower.includes('sent') || lower.includes('ok') ? 'ok' : 'info');
        div.textContent = line;
        logsContainer.appendChild(div);
      });
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }
  }

  // Polling court : compatible php -S (une seule requête à la fois ; le SSE bloquait tout le serveur)
  if (campaign.status === 'running' || campaign.status === 'pending') {
    startCampaignPolling(campaignId, logsTotal);
  } else {
    stopCampaignMonitor();
  }
}

function backToCampaignList() {
  stopCampaignMonitor();
  state.paused = false;

  const detail = document.getElementById('campaignDetail');
  const list = document.getElementById('campaignsList');
  const newBtn = document.getElementById('newCampaignBtn');
  if (detail) detail.classList.add('hidden');
  if (list) list.classList.remove('hidden');
  if (newBtn) newBtn.classList.remove('hidden');

  loadCampaigns();
}

async function relaunchCampaign(campaignId) {
  if (!confirm('Relancer l’envoi avec les paramètres actuellement enregistrés sur cette campagne ? (Utilisez « Modifier la campagne » pour les changer.)')) return;

  const res = await api('send', 'POST', { campaign_id: campaignId });
  if (!res.success) return alert('Erreur lors du relancement : ' + (res.error || ''));

  const campRes = await api('campaign&id=' + encodeURIComponent(campaignId));
  startCampaignCompletionWatch(campaignId, campRes.data?.name || '');
  showCampaignDetail(campaignId);
}

async function deleteCampaignCard(campaignId) {
  if (!confirm('Supprimer définitivement cette campagne ?')) return;
  const res = await api('campaign&id=' + campaignId, 'DELETE');
  if (!res.success) return alert('Erreur lors de la suppression.');
  await loadCampaigns();
}

async function handlePause() {
  if (!state.currentCampaignId) return;
  const pauseBtn = document.getElementById('detailPauseBtn');

  if (!state.paused) {
    await api('pause', 'POST', { campaign_id: state.currentCampaignId });
    state.paused = true;
    if (pauseBtn) pauseBtn.innerHTML = tyI('play', 16) + ' Reprendre';
  } else {
    await api('resume', 'POST', { campaign_id: state.currentCampaignId });
    state.paused = false;
    if (pauseBtn) pauseBtn.innerHTML = tyI('pause', 16) + ' Pause';
  }
}

async function handleStop() {
  if (!state.currentCampaignId) return;
  if (!confirm('Arrêter définitivement la campagne ?')) return;
  await api('stop', 'POST', { campaign_id: state.currentCampaignId });
  // Repart sur le curseur actuellement connu pour ne pas re-streamer d'anciens logs.
  const cursor = typeof state.campaignLogCursor === 'number'
    ? state.campaignLogCursor
    : document.querySelectorAll('#detailLogsContainer .log-line').length;
  startCampaignPolling(state.currentCampaignId, cursor);
}

// ============================================
// Suivi campagne (polling — compatible php -S)
// ============================================

function stopCampaignMonitor() {
  if (state.campaignPollTimer != null) {
    clearInterval(state.campaignPollTimer);
    state.campaignPollTimer = null;
  }
}

function logLineClassFromContent(line) {
  const lower = String(line).toLowerCase();
  if (lower.includes('erreur') || lower.includes('error') || lower.includes('failed') || lower.includes('échec')) return 'failed';
  if (lower.includes('envoyé') || lower.includes('sent')) return 'ok';
  return 'info';
}

function updateDetailStatsFromServer(stats, status) {
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const sent = stats.sent || 0;
  const failed = stats.failed || 0;
  const total = stats.total || 0;
  const remaining = Math.max(0, total - sent - failed);
  setText('detailSent', sent.toLocaleString('fr-FR'));
  setText('detailFailed', failed.toLocaleString('fr-FR'));
  setText('detailTotal', total.toLocaleString('fr-FR'));
  setText('detailRemaining', status === 'running' ? remaining.toLocaleString('fr-FR') : '—');
  const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
  setText('detailPercent', pct + '%');
  const circumference = 201;
  const ring = document.getElementById('detailRingFill');
  if (ring) ring.style.strokeDashoffset = circumference * (1 - pct / 100);

  const etaEl = document.getElementById('detailEta');
  if (etaEl) {
    if (status === 'running' && remaining > 0 && state.configCacheForDetailEta) {
      const cfg = state.configCacheForDetailEta;
      const eta = estimateEtaSeconds(remaining, cfg);
      etaEl.textContent = formatEtaSeconds((eta.low + eta.high) / 2);
    } else {
      etaEl.textContent = '—';
    }
  }
}

/**
 * Polling incrémental des logs d'une campagne.
 *
 * @param {string} campaignId
 * @param {number} initialCursor  position du curseur (logs_total déjà affichés).
 *                                Le backend renvoie ensuite uniquement les lignes
 *                                postérieures à ce curseur, ce qui évite le blocage
 *                                historique qui survenait au-delà de 500 lignes.
 */
function startCampaignPolling(campaignId, initialCursor = 0) {
  stopCampaignMonitor();
  let cursor = typeof initialCursor === 'number' && initialCursor >= 0 ? initialCursor : 0;
  state.campaignLogCursor = cursor;

  const tick = async () => {
    if (state.currentCampaignId !== campaignId) {
      stopCampaignMonitor();
      return;
    }
    const res = await api(
      'campaign&id=' + encodeURIComponent(campaignId) +
      '&with_logs&log_offset=' + encodeURIComponent(String(cursor))
    );
    if (!res.success || !res.data) return;

    const camp = res.data;
    const stats = camp.stats || {};
    updateDetailStatsFromServer(stats, camp.status);

    const newLines = Array.isArray(camp.logs) ? camp.logs : [];
    const serverTotal = Number.isFinite(camp.logs_total) ? camp.logs_total : (cursor + newLines.length);
    const container = document.getElementById('detailLogsContainer');

    if (container && newLines.length > 0) {
      // Retirer un éventuel placeholder "Aucun log disponible" au premier ajout.
      container.querySelectorAll('.log-line').forEach(el => {
        const txt = (el.textContent || '').trim();
        if (txt.startsWith('Aucun log disponible') || txt === 'Chargement...') {
          el.remove();
        }
      });
      const frag = document.createDocumentFragment();
      newLines.forEach(raw => {
        const div = document.createElement('div');
        div.className = 'log-line ' + logLineClassFromContent(raw);
        div.textContent = raw;
        frag.appendChild(div);
      });
      container.appendChild(frag);
      container.scrollTop = container.scrollHeight;
    }

    // Le curseur suit toujours le total serveur, même sans nouvelle ligne.
    cursor = serverTotal;
    state.campaignLogCursor = cursor;

    const indicator = document.getElementById('detailLogsIndicator');
    const terminal = ['completed', 'failed', 'stopped', 'interrupted'].includes(camp.status);
    if (indicator) {
      if (terminal) {
        indicator.innerHTML = tyI('check-circle', 12) + ' <span>terminé</span>';
        indicator.style.color = '#64748b';
      } else if (camp.status === 'running') {
        indicator.innerHTML = tyI('activity', 12) + ' <span>live (rafraîchissement auto)</span>';
        indicator.style.color = '#22c55e';
      } else if (camp.status === 'paused') {
        indicator.innerHTML = tyI('pause', 12) + ' <span>en pause</span>';
        indicator.style.color = '#f59e0b';
      } else {
        indicator.innerHTML = tyI('clock', 12) + ' <span>en attente du worker…</span>';
        indicator.style.color = '#f59e0b';
      }
    }

    if (terminal) {
      stopCampaignMonitor();
      await showCampaignDetail(campaignId);
    }
  };

  tick();
  state.campaignPollTimer = setInterval(tick, 1500);
}

// ============================================
// SCORE PAGE
// ============================================

async function initScore() {
  const select = document.getElementById('scoreCampaignSelect');
  const scoreEmpty = document.getElementById('scorePageEmptyState');
  if (select) {
    const res = await api('campaigns');
    if (res.success) {
      const campaigns = res.data || [];
      select.innerHTML = '<option value="">-- Choisir une campagne --</option>' +
        campaigns.map(c => `<option value="${c.id}">${escHtml(c.name || 'Campagne ' + c.id)}</option>`).join('');
      if (scoreEmpty) {
        if (campaigns.length === 0) {
          scoreEmpty.classList.remove('hidden');
          scoreEmpty.innerHTML = `
            <div class="empty-state-card empty-state-card--compact">
              <p class="empty-state-text">Créez d’abord une campagne (même brouillon) pour lancer une analyse de score depuis ses templates.</p>
              <button type="button" class="btn-secondary btn-sm" id="scoreEmptyGoCampaigns">Aller aux campagnes</button>
            </div>`;
          document.getElementById('scoreEmptyGoCampaigns')?.addEventListener('click', () => showSection('campaigns'));
          if (typeof tyHydrateIcons === 'function') tyHydrateIcons(scoreEmpty);
        } else {
          scoreEmpty.classList.add('hidden');
          scoreEmpty.innerHTML = '';
        }
      }
    }
  }

  const runBtn = document.getElementById('runScoreBtn');
  if (runBtn) {
    runBtn.addEventListener('click', async () => {
      const campaignId = select ? select.value : '';
      if (!campaignId) return alert('Sélectionnez une campagne.');

      const campaignRes = await api('campaigns');
      if (!campaignRes.success) return alert('Erreur chargement campagnes.');
      const campaign = (campaignRes.data || []).find(c => String(c.id) === String(campaignId));
      if (!campaign) return alert('Campagne introuvable.');

      const config = campaign.config || {};
      const templateIds = config.template_ids || [];

      const scoreRes = await api('score', 'POST', {
        template_ids: templateIds,
        campaign: {
          from_email: config.from_email || '',
          unsubscribe_url: config.unsubscribe_url || localStorage.getItem('tydra_unsub_url') || ''
        }
      });

      if (!scoreRes.success) return alert('Erreur score: ' + (scoreRes.error || ''));

      const container = document.getElementById('scoreResult');
      if (container) {
        container.classList.remove('hidden');
        renderScore(scoreRes.data, container);
      }
    });
  }
}

// ============================================
// LAB — TESTING PAGE
// ============================================

const TESTING_IDENTITY_SELECT_PROVIDERS = new Set(['brevo', 'ses', 'amazonses', 'sendgrid']);

/** @type {Map<string, { email: string, name: string, label: string }>} */
let testingMailFromIdentityMeta = new Map();

async function refreshTestingMailFromIdentities() {
  const selSmtp = document.getElementById('testingMailSmtpSelect');
  const wrapSel = document.getElementById('testingMailFromSelectWrap');
  const wrapInp = document.getElementById('testingMailFromInputWrap');
  const hintEl = document.getElementById('testingMailFromIdentityHint');
  const hintNo = document.getElementById('testingMailFromNoConfigHint');
  const fs = document.getElementById('testingMailFromSelect');
  const fromInput = document.getElementById('testingMailFrom');
  const id = selSmtp?.value?.trim();
  if (!id) {
    if (wrapSel) wrapSel.classList.add('hidden');
    if (wrapInp) wrapInp.classList.add('hidden');
    if (hintEl) {
      hintEl.textContent = '';
      hintEl.classList.add('hidden');
    }
    if (hintNo) {
      hintNo.textContent = 'Choisissez une configuration SMTP ci-dessus pour charger l’expéditeur.';
      hintNo.classList.remove('hidden');
    }
    testingMailFromIdentityMeta = new Map();
    return;
  }
  if (hintNo) hintNo.classList.add('hidden');
  const cfg = (state.smtpConfigs || []).find(s => String(s.id) === id);
  const p = cfg ? String(cfg.provider || '').toLowerCase() : '';
  if (!TESTING_IDENTITY_SELECT_PROVIDERS.has(p)) {
    if (wrapSel) wrapSel.classList.add('hidden');
    if (wrapInp) wrapInp.classList.remove('hidden');
    const smtpUsername = String(cfg?.username || '').trim();
    const shouldAutofillFrom = (p === 'smtp' || p === 'office365') && smtpUsername !== '';
    const previousAuto = String(fromInput?.dataset?.autoFromValue || '').trim();
    const currentFrom = String(fromInput?.value || '').trim();
    if (fromInput) {
      if (shouldAutofillFrom) {
        if (currentFrom === '' || currentFrom === previousAuto) {
          fromInput.value = smtpUsername;
        }
        fromInput.dataset.autoFromValue = smtpUsername;
      } else if (fromInput.dataset.autoFromValue) {
        delete fromInput.dataset.autoFromValue;
      }
    }
    if (hintEl) {
      hintEl.textContent = shouldAutofillFrom
        ? 'Adresse From préremplie depuis le username SMTP (modifiable).'
        : 'Fournisseur générique : saisie manuelle de l’adresse From.';
      hintEl.classList.remove('hidden');
    }
    if (fs) fs.innerHTML = '<option value="">—</option>';
    testingMailFromIdentityMeta = new Map();
    return;
  }
  if (wrapSel) wrapSel.classList.remove('hidden');
  if (wrapInp) wrapInp.classList.add('hidden');
  if (hintEl) {
    hintEl.textContent = 'Chargement des identités…';
    hintEl.classList.remove('hidden');
  }
  const res = await api('verified_senders', 'POST', { smtp_config_id: id });
  if (!fs) return;
  if (!res.success) {
    testingMailFromIdentityMeta = new Map();
    fs.innerHTML = '<option value="">— Erreur —</option>';
    if (hintEl) {
      hintEl.textContent = 'Impossible de charger les identités : ' + (res.error || '');
      hintEl.classList.remove('hidden');
    }
    return;
  }
  const senders = (res.data && res.data.senders) || [];
  testingMailFromIdentityMeta = new Map();
  fs.innerHTML =
    '<option value="">' +
    (senders.length ? '— Choisir une identité —' : '— Aucune identité listée —') +
    '</option>' +
    senders
      .map(s => {
        const email = (s.email || '').trim();
        const name = (s.name != null && String(s.name).trim()) || '';
        const label = (s.label && String(s.label).trim()) || (name ? name + ' <' + email + '>' : email);
        if (email) {
          testingMailFromIdentityMeta.set(email.toLowerCase(), { email, name, label });
        }
        return email ? `<option value="${escAttr(email)}">${escHtml(label)}</option>` : '';
      })
      .join('');
  if (hintEl) {
    if (senders.length === 0) {
      hintEl.textContent =
        'Aucune identité vérifiée pour ce compte. Créez une identité expéditeur dans Brevo, SendGrid (Sender Authentication) ou SES.';
    } else {
      hintEl.textContent =
        'Identités autorisées par l’API : sélection obligatoire (pas de saisie manuelle pour ce fournisseur).';
    }
    hintEl.classList.remove('hidden');
  }
}

function populateTestingSelects() {
  const ids = ['testingInspectSmtpSelect', 'testingConnSmtpSelect', 'testingMailSmtpSelect'];
  const list = state.smtpConfigs || [];
  const html =
    '<option value="">— Choisir —</option>' +
    list
      .map(c => {
        const id = escAttr(c.id);
        return `<option value="${id}">${escHtml(c.name || c.host || c.id)}</option>`;
      })
      .join('');
  ids.forEach(selId => {
    const el = document.getElementById(selId);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = html;
    if (cur && [...el.options].some(o => o.value === cur)) el.value = cur;
  });

  // Select dédié SendGrid Activity : uniquement les configs SendGrid.
  const sgSel = document.getElementById('sgActivitySmtpSelect');
  if (sgSel) {
    const sgList = list.filter(c => String(c.provider || '').toLowerCase() === 'sendgrid');
    const sgHtml =
      '<option value="">— Choisir —</option>' +
      sgList
        .map(c => `<option value="${escAttr(c.id)}">${escHtml(c.name || c.host || c.id)}</option>`)
        .join('');
    const cur = sgSel.value;
    sgSel.innerHTML = sgHtml;
    if (cur && [...sgSel.options].some(o => o.value === cur)) sgSel.value = cur;
  }

  void refreshTestingMailFromIdentities();
}

async function refreshTestingPage() {
  const res = await api('smtp_configs');
  if (res.success) state.smtpConfigs = res.data || [];
  populateTestingSelects();

  const tplRes = await api('templates');
  const sel = document.getElementById('testingMailTemplateSelect');
  if (sel && tplRes.success) {
    const cur = sel.value;
    const tpls = tplRes.data || [];
    sel.innerHTML =
      '<option value="">— Choisir —</option>' +
      tpls
        .map(t => `<option value="${escAttr(t.id)}">${escHtml(t.name || t.id)}</option>`)
        .join('');
    if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
  }

  if (typeof tyHydrateIcons === 'function') tyHydrateIcons(document.getElementById('page-testing'));
}

async function fetchProviderInspectAndCacheSmtp(smtpId) {
  const res = await api('provider_inspect', 'POST', { smtp_config_id: smtpId });
  if (!res.success) throw new Error(res.error || 'Échec introspection');
  setSmtpInspectCacheEntry(smtpId, res.data);
  if (res.data && res.data.remote_snapshot) {
    mergeSmtpRemoteSnapshotIntoState(smtpId, res.data.remote_snapshot);
    patchSmtpRowExtrasFromState(smtpId);
  }
  return res.data;
}

function initTesting() {
  const page = document.getElementById('page-testing');
  if (!page) return;

  document.getElementById('testingInspectSource')?.addEventListener('change', () => {
    const manual = document.getElementById('testingInspectSource')?.value === 'manual';
    document.getElementById('testingInspectSavedBlock')?.classList.toggle('hidden', manual);
    document.getElementById('testingInspectManualBlock')?.classList.toggle('hidden', !manual);
  });

  const syncManualPanels = () => {
    const p = document.getElementById('testingInspectManualProvider')?.value || 'brevo';
    document.getElementById('testingManualBrevoWrap')?.classList.toggle('hidden', p !== 'brevo');
    document.getElementById('testingManualSesWrap')?.classList.toggle('hidden', p !== 'ses');
    document.getElementById('testingManualSgWrap')?.classList.toggle('hidden', p !== 'sendgrid');
  };
  document.getElementById('testingInspectManualProvider')?.addEventListener('change', syncManualPanels);
  syncManualPanels();

  document.getElementById('testingInspectRunBtn')?.addEventListener('click', async () => {
    const status = document.getElementById('testingInspectStatus');
    const out = document.getElementById('testingInspectOutput');
    const src = document.getElementById('testingInspectSource')?.value;
    let body = null;

    if (src === 'saved') {
      const id = document.getElementById('testingInspectSmtpSelect')?.value?.trim();
      if (!id) return alert('Choisissez une configuration SMTP.');
      const cfg = (state.smtpConfigs || []).find(s => String(s.id) === id);
      if (!cfg || !INSPECTABLE_SMTP_PROVIDERS.has(String(cfg.provider || '').toLowerCase())) {
        return alert('Choisissez une configuration Brevo, Amazon SES ou SendGrid.');
      }
      body = { smtp_config_id: id };
    } else {
      const p = document.getElementById('testingInspectManualProvider')?.value;
      if (p === 'brevo') {
        const k = document.getElementById('testingManualBrevoKey')?.value?.trim();
        if (!k) return alert('Clé API Brevo requise.');
        body = { provider: 'brevo', api_key: k };
      } else if (p === 'ses') {
        const ak = document.getElementById('testingManualSesAk')?.value?.trim();
        const sk = document.getElementById('testingManualSesSk')?.value?.trim();
        const reg = document.getElementById('testingSesRegion')?.value || 'eu-west-3';
        if (!ak || !sk) return alert('Access Key ID et Secret Access Key requis pour SES.');
        body = { provider: 'ses', access_key: ak, secret_key: sk, region: reg };
      } else {
        const k = document.getElementById('testingManualSendgridKey')?.value?.trim();
        if (!k) return alert('Clé API SendGrid requise.');
        const sgr = document.getElementById('testingManualSendgridRegion')?.value?.trim() || '';
        body = { provider: 'sendgrid', api_key: k };
        if (sgr) body.sendgrid_region = sgr;
      }
    }

    if (status) {
      status.textContent = 'Interrogation des API en cours…';
      status.classList.remove('hidden');
    }
    const res = await api('provider_inspect', 'POST', body);
    if (status) status.classList.add('hidden');
    if (!res.success) {
      alert(res.error || 'Erreur');
      return;
    }
    if (body.smtp_config_id) {
      setSmtpInspectCacheEntry(body.smtp_config_id, res.data);
      if (res.data.remote_snapshot) {
        mergeSmtpRemoteSnapshotIntoState(body.smtp_config_id, res.data.remote_snapshot);
      }
      renderSmtpList(state.smtpConfigs || []);
    }
    if (out) {
      out.classList.remove('hidden');
      out.innerHTML = buildInspectPreHtml(res.data.fetched_at, res.data.inspect);
    }
  });

  document.getElementById('testingConnRunBtn')?.addEventListener('click', async () => {
    const id = document.getElementById('testingConnSmtpSelect')?.value?.trim();
    const rEl = document.getElementById('testingConnResult');
    if (!id) return alert('Choisissez une configuration.');
    const res = await api('test_smtp', 'POST', { smtp_config_id: id, from_email: 'test@example.com' });
    if (rEl) {
      rEl.classList.remove('hidden');
      rEl.textContent = res.success ? 'Connexion réussie.' : 'Échec : ' + (res.error || '');
      rEl.style.color = res.success ? '#22c55e' : '#ef4444';
    }
  });

  const syncMailMode = () => {
    const m = document.getElementById('testingMailContentMode')?.value;
    document.getElementById('testingMailSimpleFields')?.classList.toggle('hidden', m === 'template');
    document.getElementById('testingMailHtmlFields')?.classList.toggle('hidden', m !== 'html');
    document.getElementById('testingMailTemplateFields')?.classList.toggle('hidden', m !== 'template');
  };
  document.getElementById('testingMailContentMode')?.addEventListener('change', syncMailMode);
  syncMailMode();

  document.getElementById('testingMailSmtpSelect')?.addEventListener('change', () => {
    void refreshTestingMailFromIdentities();
  });
  document.getElementById('testingMailFromSelect')?.addEventListener('change', () => {
    const v = document.getElementById('testingMailFromSelect')?.value?.trim();
    if (!v) return;
    const m = testingMailFromIdentityMeta.get(v.toLowerCase());
    const nameEl = document.getElementById('testingMailFromName');
    if (m && nameEl) nameEl.value = m.name || '';
  });
  void refreshTestingMailFromIdentities();

  document.getElementById('testingMailSendBtn')?.addEventListener('click', async () => {
    const smtpId = document.getElementById('testingMailSmtpSelect')?.value?.trim();
    const to = document.getElementById('testingMailTo')?.value?.trim();
    const cfg = smtpId ? (state.smtpConfigs || []).find(s => String(s.id) === smtpId) : null;
    const prov = cfg ? String(cfg.provider || '').toLowerCase() : '';
    const from =
      TESTING_IDENTITY_SELECT_PROVIDERS.has(prov)
        ? document.getElementById('testingMailFromSelect')?.value?.trim() || ''
        : document.getElementById('testingMailFrom')?.value?.trim() || '';
    if (!smtpId || !to || !from) return alert('Configuration SMTP, destinataire et expéditeur (From) sont requis.');
    const mode = document.getElementById('testingMailContentMode')?.value;
    const payload = {
      smtp_config_id: smtpId,
      to,
      from_email: from,
      from_name: document.getElementById('testingMailFromName')?.value?.trim() || ''
    };
    if (mode === 'template') {
      const tid = document.getElementById('testingMailTemplateSelect')?.value?.trim();
      if (!tid) return alert('Choisissez un template.');
      payload.template_id = tid;
    } else {
      payload.subject = document.getElementById('testingMailSubject')?.value?.trim() || 'Test ChadMailer';
      payload.body = document.getElementById('testingMailBody')?.value ?? '';
      if (mode === 'html') {
        payload.body_html = document.getElementById('testingMailHtml')?.value ?? '';
      }
    }
    const rEl = document.getElementById('testingMailResult');
    const pendingLine = appendTestingMailLog(rEl, to, 'pending');
    try {
      const res = await api('send_test_email', 'POST', payload);
      if (res.success) {
        updateTestingMailLog(pendingLine, to, 'ok');
      } else {
        updateTestingMailLog(pendingLine, to, 'failed', res.error || 'Échec');
      }
    } catch (e) {
      updateTestingMailLog(pendingLine, to, 'failed', (e && e.message) || 'Erreur réseau');
    }
  });

  initSendgridActivityCard();
}

function formatTestingMailTime(date) {
  const d = date instanceof Date ? date : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function appendTestingMailLog(container, to, state) {
  if (!container) return null;
  container.classList.remove('hidden');
  const MAX_LINES = 50;
  while (container.childElementCount >= MAX_LINES) {
    container.removeChild(container.firstElementChild);
  }
  const line = document.createElement('div');
  line.className = 'log-line';
  const time = document.createElement('span');
  time.className = 'log-time';
  time.textContent = formatTestingMailTime();
  const msg = document.createElement('span');
  msg.className = 'log-msg';
  line.appendChild(time);
  line.appendChild(msg);
  container.appendChild(line);
  container.scrollTop = container.scrollHeight;
  updateTestingMailLog(line, to, state || 'pending');
  return line;
}

function updateTestingMailLog(line, to, state, errorMessage) {
  if (!line) return;
  line.classList.remove('ok', 'failed', 'info', 'retry');
  const msg = line.querySelector('.log-msg');
  if (!msg) return;
  msg.innerHTML = '';
  const target = document.createElement('span');
  target.className = 'log-target';
  target.textContent = to || '(destinataire inconnu)';

  if (state === 'ok') {
    line.classList.add('ok');
    msg.append('Email envoyé à ', target);
  } else if (state === 'failed') {
    line.classList.add('failed');
    msg.append('Échec pour ', target);
    if (errorMessage) msg.append(' — ' + errorMessage);
  } else {
    line.classList.add('info');
    msg.append('Envoi en cours vers ', target, '…');
  }
}

// ----- SendGrid Activity (Lab) ------------------------------------------------

function initSendgridActivityCard() {
  const srcSel = document.getElementById('sgActivitySource');
  if (!srcSel) return;

  const syncSource = () => {
    const manual = srcSel.value === 'manual';
    document.getElementById('sgActivitySavedWrap')?.classList.toggle('hidden', manual);
    document.getElementById('sgActivityManualWrap')?.classList.toggle('hidden', !manual);
  };
  srcSel.addEventListener('change', syncSource);
  syncSource();

  document.getElementById('sgActivityRunBtn')?.addEventListener('click', async () => {
    const hint = document.getElementById('sgActivityStatusHint');
    const out = document.getElementById('sgActivityOutput');
    const setHint = (msg, color) => {
      if (!hint) return;
      hint.textContent = msg;
      hint.classList.remove('hidden');
      if (color) hint.style.color = color;
      else hint.style.removeProperty('color');
    };

    const body = {
      limit: parseInt(document.getElementById('sgActivityLimit')?.value || '25', 10),
      status: document.getElementById('sgActivityStatus')?.value || '',
      to_email: document.getElementById('sgActivityTo')?.value?.trim() || ''
    };
    if (srcSel.value === 'saved') {
      const id = document.getElementById('sgActivitySmtpSelect')?.value?.trim();
      if (!id) return alert('Choisissez une configuration SendGrid enregistrée.');
      body.smtp_config_id = id;
    } else {
      const k = document.getElementById('sgActivityManualKey')?.value?.trim();
      if (!k) return alert('Clé API SendGrid requise.');
      body.api_key = k;
      const sgr = document.getElementById('sgActivityManualRegion')?.value?.trim();
      if (sgr) body.sendgrid_region = sgr;
    }

    setHint('Interrogation de /v3/messages…');
    const res = await api('sendgrid_activity', 'POST', body);
    if (!res.success) {
      setHint('Erreur : ' + (res.error || ''), '#ef4444');
      if (out) { out.classList.add('hidden'); out.innerHTML = ''; }
      return;
    }
    const data = res.data || {};
    const messages = Array.isArray(data.messages) ? data.messages : [];
    setHint(
      messages.length + ' message(s) retourné(s) — source : ' +
      (data.base_used || 'SendGrid') + ' — ' + (data.fetched_at || ''),
      messages.length === 0 ? '#64748b' : '#22c55e'
    );
    if (out) {
      out.classList.remove('hidden');
      out.innerHTML = renderSendgridActivityTable(messages);
    }
  });
}

function renderSendgridActivityTable(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return '<p class="field-hint">Aucun message correspondant. Essayez d’élargir les filtres ou de charger un nombre plus élevé.</p>';
  }
  const rows = messages.map(m => {
    const status = String(m.status || '').toLowerCase();
    const statusLabel = {
      delivered: 'Delivered',
      not_delivered: 'Not delivered',
      processed: 'Processed',
      processing: 'Processing'
    }[status] || (m.status || '—');
    const badgeClass = {
      delivered: 'sg-status-delivered',
      not_delivered: 'sg-status-failed',
      processed: 'sg-status-processed',
      processing: 'sg-status-processed'
    }[status] || 'sg-status-unknown';

    const when = m.last_event_time ? new Date(m.last_event_time) : null;
    const whenLabel = when && !isNaN(when.getTime())
      ? when.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })
      : (m.last_event_time || '—');

    return `
      <tr>
        <td class="sg-activity-cell-time" title="${escAttr(m.last_event_time || '')}">${escHtml(whenLabel)}</td>
        <td><span class="sg-activity-badge ${badgeClass}">${escHtml(statusLabel)}</span></td>
        <td class="sg-activity-cell-email" title="${escAttr(m.to_email || '')}">${escHtml(m.to_email || '—')}</td>
        <td class="sg-activity-cell-email" title="${escAttr(m.from_email || '')}">${escHtml(m.from_email || '—')}</td>
        <td class="sg-activity-cell-subject" title="${escAttr(m.subject || '')}">${escHtml(m.subject || '—')}</td>
        <td class="sg-activity-cell-num">${Number(m.opens_count || 0)}</td>
        <td class="sg-activity-cell-num">${Number(m.clicks_count || 0)}</td>
        <td class="sg-activity-cell-id" title="${escAttr(m.msg_id || '')}">${escHtml((m.msg_id || '').slice(0, 16))}${m.msg_id && m.msg_id.length > 16 ? '…' : ''}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="sg-activity-table-wrap">
      <table class="sg-activity-table">
        <thead>
          <tr>
            <th>Dernier événement</th>
            <th>Statut</th>
            <th>À</th>
            <th>De</th>
            <th>Sujet</th>
            <th title="Ouvertures">Opens</th>
            <th title="Clics">Clicks</th>
            <th>Message ID</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ============================================
// CONFIG PAGE
// ============================================

async function initConfig() {
  await loadSmtpConfigs();

  const smtpListEl = document.getElementById('smtpList');
  if (smtpListEl) {
    smtpListEl.addEventListener('click', async e => {
      const wrap = e.target.closest('.smtp-config-wrap');
      if (!wrap) return;
      const sid = wrap.getAttribute('data-smtp-id');
      if (!sid) return;

      if (e.target.closest('.js-smtp-edit')) {
        e.preventDefault();
        editSmtpConfig(sid);
        return;
      }
      if (e.target.closest('.js-smtp-test')) {
        e.preventDefault();
        testSavedSmtpConfig(sid);
        return;
      }
      if (e.target.closest('.js-smtp-delete')) {
        e.preventDefault();
        deleteSmtpConfig(sid);
        return;
      }
      if (e.target.closest('.js-smtp-fetch-inspect')) {
        e.preventDefault();
        e.stopPropagation();
        const cfg = (state.smtpConfigs || []).find(s => String(s.id) === sid);
        if (!cfg || !INSPECTABLE_SMTP_PROVIDERS.has(String(cfg.provider || '').toLowerCase())) return;
        const btn = e.target.closest('.js-smtp-fetch-inspect');
        const out = wrap.querySelector('.smtp-config-inspect-output');
        const prevHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = tyI('activity', 16) + ' …';
        try {
          const data = await fetchProviderInspectAndCacheSmtp(sid);
          if (out) out.innerHTML = buildInspectPreHtml(data.fetched_at, data.inspect);
        } catch (err) {
          alert(err.message || String(err));
        } finally {
          btn.disabled = false;
          btn.innerHTML = prevHtml;
          if (typeof tyHydrateIcons === 'function') tyHydrateIcons(btn);
        }
        return;
      }

      if (e.target.closest('.smtp-config-row-actions')) return;

      wrap.classList.toggle('is-open');
      const det = wrap.querySelector('.smtp-config-detail');
      if (det) det.classList.toggle('hidden');
    });
  }

  // Add SMTP button
  const addSmtpBtn = document.getElementById('addSmtpBtn');
  if (addSmtpBtn) {
    addSmtpBtn.addEventListener('click', () => {
      clearSmtpForm();
      const form = document.getElementById('smtpForm');
      if (form) form.classList.remove('hidden');
    });
  }

  // Provider select
  const providerSelect = document.getElementById('smtpProvider');
  if (providerSelect) {
    providerSelect.addEventListener('change', () => {
      toggleSmtpFields(providerSelect.value);
      if (providerSelect.value === 'office365') {
        applyMicrosoft365SmtpDefaults('smtpHost', 'smtpPort', 'smtpUser');
      }
    });
    toggleSmtpFields(providerSelect.value);
  }

  // Save SMTP
  const saveSmtpBtn = document.getElementById('saveSmtpBtn');
  if (saveSmtpBtn) {
    saveSmtpBtn.addEventListener('click', saveSmtpConfig);
  }

  // Cancel SMTP
  const cancelSmtpBtn = document.getElementById('cancelSmtpBtn');
  if (cancelSmtpBtn) {
    cancelSmtpBtn.addEventListener('click', () => {
      clearSmtpForm();
      const form = document.getElementById('smtpForm');
      if (form) form.classList.add('hidden');
    });
  }

  // Test SMTP
  const testSmtpBtn = document.getElementById('testSmtpBtn');
  if (testSmtpBtn) {
    testSmtpBtn.addEventListener('click', async () => {
      const existingId = document.getElementById('smtpConfigId')?.value?.trim();
      let res;
      if (existingId) {
        res = await api('test_smtp', 'POST', { smtp_config_id: existingId, from_email: 'test@example.com' });
      } else {
        res = await api('test_smtp', 'POST', buildSmtpTestPayloadFromForm());
      }
      const resultEl = document.getElementById('smtpTestResult');
      if (resultEl) {
        const err = res.error || '';
        resultEl.innerHTML = res.success
          ? tyI('check', 16) + ' <span>Connexion réussie</span>'
          : tyI('x-circle', 16) + ' <span>Échec : ' + escHtml(err) + '</span>';
        resultEl.style.color = res.success ? '#22c55e' : '#ef4444';
        resultEl.classList.remove('hidden');
      }
    });
  }

  document.getElementById('smtpSesInspectBtn')?.addEventListener('click', () => runSesInspect('smtp'));
  document.getElementById('smtpSesProbeAllBtn')?.addEventListener('click', () => runSesProbeAllRegions('smtp'));

  // Unsubscribe URL
  const unsubEl = document.getElementById('unsubscribeUrl');
  if (unsubEl) {
    unsubEl.value = localStorage.getItem('tydra_unsub_url') || '';
  }

  const saveUnsubBtn = document.getElementById('saveUnsubBtn');
  if (saveUnsubBtn) {
    saveUnsubBtn.addEventListener('click', () => {
      const val = unsubEl ? unsubEl.value.trim() : '';
      localStorage.setItem('tydra_unsub_url', val);
      alert('URL de désabonnement sauvegardée.');
    });
  }

  // DNS guide
  const showDnsBtn = document.getElementById('showDnsRecordsBtn');
  if (showDnsBtn) {
    showDnsBtn.addEventListener('click', renderDnsGuide);
  }

  const verifyDnsBtn = document.getElementById('verifyDnsBtn');
  if (verifyDnsBtn) {
    verifyDnsBtn.addEventListener('click', verifyDns);
  }
}

async function loadSmtpConfigs() {
  const res = await api('smtp_configs');
  if (!res.success) return;
  state.smtpConfigs = res.data || [];
  renderSmtpList(state.smtpConfigs);
}

function renderSmtpList(configs) {
  const list = document.getElementById('smtpList');
  const emptyEl = document.getElementById('smtpEmptyState');
  if (!list) return;

  if (configs.length === 0) {
    list.innerHTML = '';
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      emptyEl.innerHTML = `
        <div class="empty-state-card empty-state-card--compact">
          <div class="empty-state-icon" aria-hidden="true">${tyI('server', 36)}</div>
          <h2 class="empty-state-title">Aucune configuration SMTP / API</h2>
          <p class="empty-state-text">Ajoutez Brevo, un SMTP générique ou un autre fournisseur pour envoyer des campagnes.</p>
          <button type="button" class="btn-secondary btn-with-icon" id="emptyStateAddSmtpBtn">${tyI('plus', 18)} Ajouter une configuration</button>
        </div>`;
      document.getElementById('emptyStateAddSmtpBtn')?.addEventListener('click', () => {
        document.getElementById('addSmtpBtn')?.click();
      });
      if (typeof tyHydrateIcons === 'function') tyHydrateIcons(emptyEl);
    }
    return;
  }

  if (emptyEl) {
    emptyEl.classList.add('hidden');
    emptyEl.innerHTML = '';
  }

  list.innerHTML = configs
    .map(c => {
      const id = escAttr(c.id);
      const p = String(c.provider || '').toLowerCase();
      const canInspect = INSPECTABLE_SMTP_PROVIDERS.has(p);
      const entry = getSmtpInspectCacheEntry(c.id);
      const inspectBlock =
        entry && entry.inspect
          ? buildInspectPreHtml(entry.fetched_at, entry.inspect)
          : `<p class="field-hint">${canInspect ? 'Aucune donnée en cache pour cette session — cliquez sur « Interroger l’API ».' : 'Introspection API disponible pour Brevo, Amazon SES et SendGrid uniquement.'}</p>`;
      const fetchBtn = canInspect
        ? `<button type="button" class="btn-secondary btn-sm btn-with-icon js-smtp-fetch-inspect">${tyI('refresh-cw', 16)} Interroger l’API</button>`
        : '';
      return `
    <div class="smtp-config-wrap" data-smtp-id="${id}">
      <div class="smtp-config-row smtp-config-row--head">
        <span class="smtp-config-toggle" aria-hidden="true">${tyI('chevron-right', 18)}</span>
        <div class="smtp-config-row-main">
          <span class="smtp-config-row-name">${escHtml(c.name || c.host || 'Config ' + c.id)}</span>
          <span class="smtp-config-row-provider">${escHtml(c.provider || c.host || '')}</span>
        </div>
        <div class="smtp-row-extras-slot">${buildSmtpRemoteRowExtrasHtml(c)}</div>
        <div class="smtp-config-row-actions">
          <button type="button" class="btn btn-sm js-smtp-edit">Modifier</button>
          <button type="button" class="btn btn-sm js-smtp-test">Tester</button>
          <button type="button" class="btn btn-sm btn-danger js-smtp-delete">Supprimer</button>
        </div>
      </div>
      <div class="smtp-config-detail hidden">
        ${renderSmtpDetailMetaHtml(c)}
        <div class="smtp-config-inspect">
          <h4>Données API (cette session)</h4>
          ${fetchBtn}
          <div class="smtp-config-inspect-output">${inspectBlock}</div>
        </div>
      </div>
    </div>`;
    })
    .join('');
  if (typeof tyHydrateIcons === 'function') tyHydrateIcons(list);
}

async function editSmtpConfig(id) {
  const res = await api('smtp_config&id=' + encodeURIComponent(id));
  if (!res.success || !res.data) {
    alert('Configuration introuvable.');
    return;
  }
  const c = res.data;
  showSection('smtp');
  document.getElementById('smtpConfigId').value = c.id || '';
  document.getElementById('smtpName').value = c.name || '';
  const provEl = document.getElementById('smtpProvider');
  if (provEl) {
    provEl.value = c.provider || 'smtp';
    toggleSmtpFields(provEl.value);
  }
  const isSes = (c.provider || '') === 'ses';
  if (isSes) {
    document.getElementById('smtpApiKey').value = '';
    let ak = c.access_key || '';
    if (!ak && c.api_key && String(c.api_key).startsWith('AKIA')) ak = c.api_key;
    document.getElementById('smtpAwsAccessKey').value = ak;
    document.getElementById('smtpAwsSecretKey').value = c.secret_key || c.password || '';
  } else {
    document.getElementById('smtpApiKey').value = c.api_key || '';
    document.getElementById('smtpAwsAccessKey').value = '';
    document.getElementById('smtpAwsSecretKey').value = '';
  }
  const regionCode = (c.region && String(c.region).trim()) || 'eu-west-3';
  ensureAwsRegionInSelect(
    'smtpAwsRegion',
    regionCode,
    c.region && String(c.region).trim() ? labelForAwsRegionCode(String(c.region).trim()) : undefined
  );
  document.getElementById('smtpHost').value = c.host || '';
  document.getElementById('smtpPort').value = c.port != null && c.port !== '' ? c.port : 587;
  document.getElementById('smtpUser').value = c.username || '';
  document.getElementById('smtpPass').value = c.password || '';
  if (String(c.provider || '').toLowerCase() === 'office365') {
    applyMicrosoft365SmtpDefaults('smtpHost', 'smtpPort', 'smtpUser');
  }
  const sgReg = document.getElementById('smtpSendgridRegion');
  if (sgReg) {
    const v = c.sendgrid_region != null && String(c.sendgrid_region).trim() !== '' ? String(c.sendgrid_region).trim() : '';
    sgReg.value = v === 'eu' ? 'eu' : v === 'global' || v === 'us' ? 'global' : '';
  }
  document.getElementById('smtpSecretHint')?.classList.remove('hidden');
  document.getElementById('smtpForm')?.classList.remove('hidden');
  document.getElementById('smtpTestResult')?.classList.add('hidden');
  document.getElementById('smtpForm')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function testSavedSmtpConfig(id) {
  const msg = document.getElementById('smtpListTestMessage');
  if (msg) {
    msg.classList.remove('hidden');
    msg.textContent = 'Test de connexion en cours…';
    msg.style.color = 'var(--text-muted)';
  }
  const res = await api('test_smtp', 'POST', { smtp_config_id: id, from_email: 'test@example.com' });
  if (msg) {
    const name = state.smtpConfigs.find(s => s.id === id)?.name || id;
    msg.innerHTML = res.success
      ? tyI('check', 16) +
        ' <span>Connexion réussie pour « ' +
        escHtml(name) +
        ' »</span>'
      : tyI('x-circle', 16) + ' <span>' + escHtml(res.error || 'Échec du test') + '</span>';
    msg.style.color = res.success ? '#22c55e' : '#ef4444';
  }
}

function clearSmtpForm() {
  ['smtpConfigId', 'smtpName', 'smtpApiKey', 'smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'smtpAwsAccessKey', 'smtpAwsSecretKey'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const sgR = document.getElementById('smtpSendgridRegion');
  if (sgR) sgR.value = '';
  const sreg = document.getElementById('smtpAwsRegion');
  if (sreg) sreg.value = 'eu-west-3';
  const prov = document.getElementById('smtpProvider');
  if (prov) {
    prov.value = 'brevo';
    toggleSmtpFields('brevo');
  }
  document.getElementById('smtpSecretHint')?.classList.add('hidden');
  const resultEl = document.getElementById('smtpTestResult');
  if (resultEl) resultEl.classList.add('hidden');
  const sesInspect = document.getElementById('smtpSesInspectResult');
  if (sesInspect) {
    sesInspect.classList.add('hidden');
    sesInspect.innerHTML = '';
  }
}

function buildSmtpTestPayloadFromForm() {
  const d = collectSmtpFormData();
  const payload = {
    provider: d.provider,
    api_key: d.api_key,
    host: d.host,
    port: d.port,
    username: d.username,
    password: d.password,
    from_email: 'test@example.com'
  };
  if (d.provider === 'ses') {
    payload.access_key = d.access_key;
    payload.secret_key = d.secret_key;
    payload.region = d.region;
  }
  if (d.provider === 'sendgrid' && d.sendgrid_region) {
    payload.sendgrid_region = d.sendgrid_region;
  }
  if (d.provider === 'office365') {
    payload.encryption = d.encryption || 'tls';
    if (!payload.host) payload.host = 'smtp.office365.com';
    if (!payload.port) payload.port = '587';
  }
  return payload;
}

function formatSesQuotaNum(n) {
  if (n == null || n === '') return '—';
  const x = Number(n);
  if (Number.isNaN(x)) return '—';
  return x.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function truncateSesErr(s, max) {
  if (!s) return '';
  const t = String(s);
  return t.length <= max ? t : t.slice(0, max) + '…';
}

function resolveSesInspectPayload(context) {
  if (context === 'smtp') {
    const existingId = document.getElementById('smtpConfigId')?.value?.trim();
    if (existingId) {
      return { payload: { smtp_config_id: existingId, provider: 'ses' }, error: null };
    }
    const d = collectSmtpFormData();
    if (d.provider !== 'ses') return { payload: null, error: 'ses_only' };
    if (!d.access_key || !d.secret_key) return { payload: null, error: 'need_keys' };
    return {
      payload: { provider: 'ses', access_key: d.access_key, secret_key: d.secret_key, region: d.region },
      error: null
    };
  }
  const d = collectCampSmtpData();
  if (d.provider !== 'ses') return { payload: null, error: 'ses_only' };
  if (!d.access_key || !d.secret_key) return { payload: null, error: 'need_keys' };
  return {
    payload: { provider: 'ses', access_key: d.access_key, secret_key: d.secret_key, region: d.region },
    error: null
  };
}

function alertSesInspectError(code) {
  if (code === 'ses_only') alert('Choisissez Amazon SES comme fournisseur.');
  else if (code === 'need_keys') {
    alert(
      'Renseignez l’Access Key ID et la Secret Access Key. AWS n’autorise aucun appel API avec seule la clé visible (AKIA…) : la signature exige la clé secrète.'
    );
  }
}

function attachSesProbeInteractions(container, context) {
  if (container.dataset.sesProbeDelegation === '1') return;
  container.dataset.sesProbeDelegation = '1';
  const selId = context === 'camp' ? 'campAwsRegion' : 'smtpAwsRegion';
  container.addEventListener('click', e => {
    const btn = e.target.closest('.js-ses-pick-region');
    if (!btn) return;
    const r = btn.getAttribute('data-region');
    if (!r) return;
    const lab = btn.getAttribute('data-label');
    ensureAwsRegionInSelect(selId, r, lab || undefined);
    document.getElementById(selId)?.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function renderSesProbeTable(container, data, context) {
  const sum = data.summary || {};
  const regions = data.regions || [];
  let html = '<div class="smtp-ses-probe">';
  html += '<div class="smtp-ses-probe-summary">';
  if ((sum.reachable_count || 0) > 0) {
    html +=
      '<p class="smtp-ses-probe-lead"><strong>' +
      escHtml(String(sum.reachable_count)) +
      '</strong> région(s) répondent avec succès. ';
    if (sum.best_quota_region) {
      html +=
        'Plus haut quota sur 24 h : <strong>' +
        escHtml(sum.best_quota_label || sum.best_quota_region) +
        '</strong> (<code>' +
        escHtml(sum.best_quota_region) +
        '</code>) — ' +
        formatSesQuotaNum(sum.best_max_24h) +
        ' max / 24 h.</p>';
    } else {
      html += '</p>';
    }
  } else {
    html += '<p class="smtp-ses-probe-lead smtp-ses-probe-lead--warn">Aucune région n’a répondu avec succès.</p>';
  }
  if (sum.hint) html += '<p class="field-hint smtp-ses-probe-hint">' + escHtml(sum.hint) + '</p>';
  html += '</div>';

  html += '<div class="smtp-ses-probe-table-wrap"><table class="smtp-ses-probe-table"><thead><tr>';
  ['Région', 'Code', 'Statut', 'Max / 24 h', 'Envoyés / 24 h', 'Débit / s', 'Prod.', 'Envoi', ''].forEach(h => {
    html += '<th>' + escHtml(h) + '</th>';
  });
  html += '</tr></thead><tbody>';

  regions.forEach(r => {
    const ok = !!r.ok;
    let trClass = ok ? 'ses-probe-row--ok' : 'ses-probe-row--bad';
    if (r.matches_form_region) trClass += ' ses-probe-row--picked';
    html += '<tr class="' + trClass + '">';
    html += '<td>' + escHtml(r.label || '') + '</td>';
    html += '<td><code>' + escHtml(r.region || '') + '</code></td>';
    html +=
      '<td class="ses-probe-stat">' +
      (ok ? tyI('check', 14) + ' <span>OK</span>' : tyI('x-circle', 14) + ' <span>—</span>') +
      '</td>';
    html += '<td>' + formatSesQuotaNum(r.max_24h) + '</td>';
    html += '<td>' + formatSesQuotaNum(r.sent_24h) + '</td>';
    html += '<td>' + formatSesQuotaNum(r.max_rate) + '</td>';
    html += '<td>' + (ok ? (r.production_access ? 'Oui' : 'Non') : '—') + '</td>';
    html += '<td>' + (ok ? (r.sending_enabled ? 'Oui' : 'Non') : '—') + '</td>';
    html += '<td class="ses-probe-actions">';
    if (ok) {
      const pickLabel = (r.label || r.region || '') + ' — ' + (r.region || '');
      html +=
        '<button type="button" class="btn btn-sm js-ses-pick-region" data-region="' +
        escAttr(r.region || '') +
        '" data-label="' +
        escAttr(pickLabel) +
        '">Utiliser</button>';
    } else {
      html +=
        '<span class="ses-probe-err" title="' +
        escAttr(r.error || '') +
        '">' +
        escHtml(truncateSesErr(r.error, 48)) +
        '</span>';
    }
    html += '</td></tr>';
  });

  html += '</tbody></table></div></div>';
  container.innerHTML = html;
  attachSesProbeInteractions(container, context);
}

function renderSesInspectResult(container, res, context) {
  if (!container) return;
  container.classList.remove('hidden');
  if (!res.success) {
    container.innerHTML =
      '<p class="smtp-ses-inspect-err">' + tyI('x-circle', 16) + ' ' + escHtml(res.error || 'Erreur') + '</p>';
    return;
  }
  const d = res.data || {};
  if (d.probe_all_regions) {
    renderSesProbeTable(container, d, context);
    return;
  }
  let html = '<div class="smtp-ses-inspect-inner">';
  html += '<p class="smtp-ses-inspect-meta">Région : <code>' + escHtml(d.region || '') + '</code></p>';
  if (d.account) {
    html += '<h4 class="smtp-ses-inspect-h">Compte SES <span class="label-hint">(API GetAccount)</span></h4>';
    html += '<pre class="smtp-ses-inspect-pre" tabindex="0">' + escHtml(JSON.stringify(d.account, null, 2)) + '</pre>';
  }
  if (d.identities) {
    html += '<h4 class="smtp-ses-inspect-h">Identités <span class="label-hint">(première page)</span></h4>';
    html += '<pre class="smtp-ses-inspect-pre" tabindex="0">' + escHtml(JSON.stringify(d.identities, null, 2)) + '</pre>';
  }
  if (d.errors && typeof d.errors === 'object' && Object.keys(d.errors).length) {
    html += '<h4 class="smtp-ses-inspect-h">Erreurs partielles</h4>';
    html += '<pre class="smtp-ses-inspect-pre">' + escHtml(JSON.stringify(d.errors, null, 2)) + '</pre>';
  }
  html += '</div>';
  container.innerHTML = html;
}

async function runSesInspect(context) {
  const resultEl =
    context === 'camp' ? document.getElementById('campSesInspectResult') : document.getElementById('smtpSesInspectResult');
  if (!resultEl) return;

  const resolved = resolveSesInspectPayload(context);
  if (resolved.error) {
    alertSesInspectError(resolved.error);
    return;
  }

  resultEl.innerHTML = '<p class="smtp-ses-inspect-loading">Interrogation de l’API Amazon SES…</p>';
  resultEl.classList.remove('hidden');
  const res = await api('ses_inspect', 'POST', resolved.payload);
  renderSesInspectResult(resultEl, res, context);
}

async function runSesProbeAllRegions(context) {
  const resultEl =
    context === 'camp' ? document.getElementById('campSesInspectResult') : document.getElementById('smtpSesInspectResult');
  if (!resultEl) return;

  const resolved = resolveSesInspectPayload(context);
  if (resolved.error) {
    alertSesInspectError(resolved.error);
    return;
  }

  const payload = { ...resolved.payload, probe_all_regions: true };
  const regEl = document.getElementById(context === 'camp' ? 'campAwsRegion' : 'smtpAwsRegion');
  if (regEl && regEl.value) payload.preferred_region = regEl.value.trim();

  resultEl.innerHTML =
    '<p class="smtp-ses-inspect-loading">Analyse de toutes les régions SES en parallèle (≈ 5–15 s)…</p>';
  resultEl.classList.remove('hidden');
  const res = await api('ses_inspect', 'POST', payload);
  renderSesInspectResult(resultEl, res, context);
}

function toggleSmtpFields(provider) {
  const apiKeyGroup = document.getElementById('smtpApiKeyGroup');
  const sesGroup = document.getElementById('smtpSesGroup');
  const sgRegionGroup = document.getElementById('smtpSendgridGroup');
  const o365 = document.getElementById('smtpOffice365Group');
  const credFields = document.querySelectorAll('.smtp-credentials');
  const isSes = provider === 'ses';
  const isSmtpLike = provider === 'smtp' || provider === 'office365';
  const isSendgrid = provider === 'sendgrid';

  if (sesGroup) sesGroup.classList.toggle('hidden', !isSes);
  if (o365) o365.classList.toggle('hidden', provider !== 'office365');
  if (sgRegionGroup) sgRegionGroup.classList.toggle('hidden', !isSendgrid);
  if (apiKeyGroup) apiKeyGroup.classList.toggle('hidden', isSes || isSmtpLike);
  credFields.forEach(el => el.classList.toggle('hidden', !isSmtpLike));

  if (!isSes && !isSmtpLike) {
    setSmtpApiKeyUiForProvider(provider, 'smtpApiKeyLabel', 'smtpApiKey');
  }
  const smtpUserEl = document.getElementById('smtpUser');
  if (smtpUserEl) {
    if (provider === 'office365') smtpUserEl.placeholder = 'adresse@domaine.com (compte Microsoft 365)';
    else if (provider === 'smtp') smtpUserEl.placeholder = 'user@domain.com';
  }
}

function collectSmtpFormData() {
  const getVal = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const provider = getVal('smtpProvider');
  const data = {
    id: getVal('smtpConfigId') || undefined,
    name: getVal('smtpName'),
    provider,
    api_key: getVal('smtpApiKey'),
    host: getVal('smtpHost'),
    port: getVal('smtpPort'),
    username: getVal('smtpUser'),
    password: getVal('smtpPass')
  };
  if (provider === 'ses') {
    data.access_key = getVal('smtpAwsAccessKey');
    data.secret_key = getVal('smtpAwsSecretKey');
    const regEl = document.getElementById('smtpAwsRegion');
    data.region = regEl && regEl.value ? regEl.value.trim() : 'eu-west-3';
    data.api_key = '';
  }
  if (provider === 'sendgrid') {
    const sgR = document.getElementById('smtpSendgridRegion');
    data.sendgrid_region = sgR && sgR.value != null ? String(sgR.value).trim() : '';
  }
  if (provider === 'office365') {
    data.encryption = 'tls';
    if (!data.host) data.host = 'smtp.office365.com';
    if (!data.port) data.port = '587';
  }
  return data;
}

async function saveSmtpConfig() {
  const data = collectSmtpFormData();
  if (!data.name) return alert('Le nom de la configuration est requis.');
  if (data.provider === 'office365') {
    if (!data.username) {
      return alert('Microsoft 365 : l’utilisateur SMTP doit être l’adresse e-mail complète du compte.');
    }
    if (!data.id && !data.password) {
      return alert('Microsoft 365 : le mot de passe (ou mot de passe d’application) est requis pour une nouvelle configuration.');
    }
  }
  if (data.provider === 'ses') {
    if (!data.access_key) return alert('Amazon SES : l’Access Key ID (AKIA…) est requis.');
    if (!data.id && !data.secret_key) {
      return alert('Amazon SES : la Secret Access Key est requise pour une nouvelle configuration.');
    }
  }

  const res = await api('smtp_configs', 'POST', data);
  if (!res.success) return alert('Erreur sauvegarde SMTP: ' + (res.error || ''));

  const form = document.getElementById('smtpForm');
  if (form) form.classList.add('hidden');
  await loadSmtpConfigs();
}

async function deleteSmtpConfig(id) {
  if (!confirm('Supprimer cette configuration SMTP ?')) return;
  const res = await api('smtp_config&id=' + id, 'DELETE');
  if (!res.success) return alert('Erreur suppression SMTP.');
  removeSmtpInspectCacheEntry(id);
  await loadSmtpConfigs();
}

function renderDnsGuide() {
  const container = document.getElementById('dnsRecords');
  if (!container) return;

  const domainEl = document.getElementById('dnsDomain');
  const domain = domainEl ? domainEl.value.trim() || 'votredomaine.com' : 'votredomaine.com';

  container.innerHTML = `
    <div class="dns-block">
      <div class="dns-block-title">SPF <span style="color:#64748b;font-weight:normal;font-size:12px">@ TXT</span></div>
      <div class="dns-record-value" id="spfValue">v=spf1 include:spf.brevo.com ~all</div>
      <button class="btn btn-sm" onclick="copyText('spfValue')">Copier</button>
    </div>
    <div class="dns-block">
      <div class="dns-block-title">DKIM <span style="color:#64748b;font-weight:normal;font-size:12px">brevo._domainkey TXT</span></div>
      <textarea id="dkimValue" class="dns-record-value" rows="3" placeholder="Collez ici votre valeur DKIM depuis Brevo..." style="width:100%;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px;color:inherit;font-family:monospace;font-size:12px"></textarea>
      <button class="btn btn-sm" onclick="copyText('dkimValue')">Copier</button>
    </div>
    <div class="dns-block">
      <div class="dns-block-title">DMARC <span style="color:#64748b;font-weight:normal;font-size:12px">_dmarc TXT</span></div>
      <div class="dns-record-value" id="dmarcValue">v=DMARC1; p=none; rua=mailto:dmarc@${escHtml(domain)}</div>
      <button class="btn btn-sm" onclick="copyText('dmarcValue')">Copier</button>
    </div>
  `;
  container.classList.remove('hidden');
}

function copyText(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.value || el.textContent;
  navigator.clipboard.writeText(text.trim()).then(() => {
    alert('Copié !');
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text.trim();
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    alert('Copié !');
  });
}

async function verifyDns() {
  const domainEl = document.getElementById('dnsDomain');
  const selectorEl = document.getElementById('dkimSelector');
  const domain = domainEl ? domainEl.value.trim() : '';
  const selector = selectorEl ? selectorEl.value.trim() : 'brevo';

  if (!domain) return alert('Entrez un domaine à vérifier.');

  const res = await api('dns_check', 'POST', { domain, selector });
  const resultsEl = document.getElementById('dnsResults');
  if (!resultsEl) return;

  if (!res.success) {
    resultsEl.innerHTML = '<span style="color:#ef4444">Erreur: ' + escHtml(res.error || '') + '</span>';
    resultsEl.classList.remove('hidden');
    return;
  }

  const d = res.data;
  const renderDnsResult = (label, result) => {
    if (!result) return '';
    const found = result.status === 'found';
    const error = result.status === 'error';
    const iconSvg = found ? tyI('check-circle', 16) : tyI('x-circle', 16);
    const color = found ? '#22c55e' : '#ef4444';
    return `<div class="ty-inline-row" style="margin:6px 0;color:${color}">${iconSvg}<span><strong>${escHtml(label)}:</strong> ${escHtml(result.message || '')}</span></div>`;
  };

  resultsEl.innerHTML = renderDnsResult('SPF', d.spf) + renderDnsResult('DKIM', d.dkim) + renderDnsResult('DMARC', d.dmarc);
  resultsEl.classList.remove('hidden');
}

// ============================================
// SCORE RENDERER
// ============================================

function renderScore(result, container) {
  const pct = result.score;
  const circumference = 201;
  const offset = circumference * (1 - pct / 100);
  const gradeColors = {
    'green-bright': '#22c55e',
    'green': '#84cc16',
    'orange': '#f59e0b',
    'red': '#ef4444'
  };
  const color = gradeColors[(result.grade && result.grade.color)] || '#a78bfa';
  const gradeLabel = (result.grade && result.grade.label) || '';
  const issues = result.issues || [];
  const okList = result.ok || [];
  const warnings = result.warnings || [];

  let html = `
    <div class="score-gauge-wrap">
      <div class="score-circle">
        <svg viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="6"/>
          <circle cx="40" cy="40" r="32" fill="none" stroke="${color}" stroke-width="6"
            stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
            stroke-linecap="round" transform="rotate(-90 40 40)"/>
        </svg>
        <div class="score-number" style="color:${color}">${pct}</div>
      </div>
      <div>
        <div class="score-grade ${result.grade ? result.grade.color : ''}">${escHtml(gradeLabel)}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">${issues.length} problème(s) détecté(s)</div>
      </div>
    </div>
    <div class="score-issues">
  `;

  issues.forEach(issue => {
    html += `
      <div class="issue-item ${escAttr(issue.severity || '')}">
        <div class="issue-severity">${issue.severity === 'critical' ? 'Critique' : 'Avertissement'} — ${issue.score_impact || 0} pts</div>
        <div class="issue-message">${escHtml(issue.message || '')}</div>
        <div class="issue-fix">${tyI('lightbulb', 16)}<span>${escHtml(issue.fix || '')}</span></div>
      </div>
    `;
  });

  warnings.forEach(w => {
    html += `
      <div class="issue-item warning">
        <div class="issue-severity">Avertissement — ${w.score_impact || 0} pts</div>
        <div class="issue-message">${escHtml(w.message || '')}</div>
        <div class="issue-fix">${tyI('lightbulb', 16)}<span>${escHtml(w.fix || '')}</span></div>
      </div>
    `;
  });

  okList.forEach(ok => {
    html += `<div class="issue-item ok"><div class="issue-message ty-inline-row">${tyI('check', 15)}<span>${escHtml(ok.message || '')}</span></div></div>`;
  });

  html += '</div>';
  container.innerHTML = html;
}

// ============================================
// UTILITIES
// ============================================

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

// ============================================
// RESTAURATION UI (après F5 / Ctrl+R)
// ============================================

async function restoreUiStateAfterLoad() {
  let s;
  try {
    const raw = sessionStorage.getItem(UI_STATE_STORAGE_KEY);
    if (!raw) return false;
    s = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!s || s.v !== 1) return false;

  uiStateRestoreInProgress = true;
  try {
  const section = s.section || 'dashboard';
  showSection(section);

  if (s.templateEditorOpen && section === 'templates') {
    await loadTemplates();
    const tid = s.editingTemplateId && String(s.editingTemplateId).trim();
    if (tid) {
      await editTemplate(tid);
    } else {
      clearTemplateForm();
      openTemplateEditorModal();
    }
    if (s.templateCodePhase) {
      setTemplateCodePhase(true);
    }
    return true;
  }

  if (s.campaignDetailOpen && s.campaignDetailId && section === 'campaigns') {
    await loadCampaigns();
    await showCampaignDetail(s.campaignDetailId);
    return true;
  }

  if (s.campaignFormOpen && section === 'campaigns') {
    await loadCampaigns();
    const ecid = s.editingCampaignId && String(s.editingCampaignId).trim();
    if (ecid) {
      await openEditCampaign(ecid);
    } else {
      resetNewCampaignForm();
      const list = document.getElementById('campaignsList');
      const formEl = document.getElementById('campaignForm');
      const newBtn = document.getElementById('newCampaignBtn');
      if (list) list.classList.add('hidden');
      if (formEl) formEl.classList.remove('hidden');
      if (newBtn) newBtn.classList.add('hidden');
      stopCampaignMonitor();
      await populateTemplateChips();
      await populateSmtpSelect();
    }
    return true;
  }

  return section !== 'dashboard';
  } finally {
    uiStateRestoreInProgress = false;
    persistUiState();
  }
}

// ============================================
// INIT
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  installUiTranslationObserver();
  if (typeof tyHydrateIcons === 'function') tyHydrateIcons();
  applySidebarPanelFromStorage();
  populateAwsRegionSelects();

  initNavigation();
  initDashboard();
  initTemplates();
  initCampaigns();
  initScore();
  initConfig();
  initTesting();

  window.addEventListener('pagehide', persistUiState);
  window.addEventListener('beforeunload', persistUiState);

  const restored = await restoreUiStateAfterLoad();
  if (!restored) {
    showSection('dashboard');
  }
});
