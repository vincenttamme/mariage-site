import { dressCodeConfig } from './config.js';
import { evaluateColor, isCompliant } from './colors.js';
import { createComposition, changeColor, changeRole, changeModel, resetComposition, createComparison } from './composition.js';

/** @typedef {import('./config.js').DressCodeConfig} DressCodeConfig */
/** @typedef {import('./config.js').Participant} Participant */
/** @typedef {ReturnType<import('./scene.js').createScene>} SceneAdapter */

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let instanceCount = 0;

/**
 * A static-hosting friendly mount point, also exposed as <wedding-dress-code>.
 * Each mount has its own immutable composition and WebGL lifecycle.
 * @param {HTMLElement} host
 * @param {DressCodeConfig} [config]
 */
export function mountDressCode(host, config = dressCodeConfig) {
  const prefix = `dress-code-${++instanceCount}`;
  const listeners = new AbortController();
  let composition = createComposition(config);
  let selectedId = composition[0]?.id || null;
  /** @type {ReturnType<typeof createComparison> | null} */
  let comparison = null;
  /** @type {'compliant'|'alternative'} */
  let comparisonSide = 'compliant';
  /** @type {SceneAdapter|null} */
  let scene = null;
  let visible = false;
  let disposed = false;
  let loading = false;
  let view = '3d';
  let generation = 0;
  const connection = /** @type {Navigator & {connection?:{saveData?:boolean}}} */ (navigator).connection;
  let autoLoad = !connection?.saveData;
  const isProvisional = config.models.some((model) => model.provisional);
  const hasRecommendations = config.colors.some((color) => config.roles.some((role) => evaluateColor(color, role.id, config).status === 'recommended'));
  const globalRestrictions = config.globalRules.forbidden.map((rule) => rule.familyId
    ? config.families.find((family) => family.id === rule.familyId)?.label
    : rule.colorId ? config.colors.find((color) => color.id === rule.colorId)?.label : rule.hex).filter(Boolean);
  const ruleExplanation = globalRestrictions.length
    ? `À éviter selon les règles globales : ${globalRestrictions.join(' ; ')}. Les statuts affichés tiennent compte des règles et des exceptions explicitement configurées pour chaque rôle.`
    : 'Les statuts affichés tiennent compte des règles et des exceptions explicitement configurées pour chaque rôle.';

  host.classList.add('dc-simulator');
  host.dataset.renderState = 'waiting';
  host.innerHTML = `
    <div class="dc-heading">
      <div><p class="dc-kicker">L’esprit des tenues</p><h2 id="${prefix}-title">${escapeHtml(config.title)}</h2></div>
      <p class="dc-intro">${escapeHtml(config.subtitle)}</p>
    </div>
    <div class="dc-palette-note"><span aria-hidden="true">◇</span><p><strong>${escapeHtml(config.palette.label)}</strong> ${escapeHtml(config.palette.description)}</p></div>
    <div class="dc-toolbar">
      <p class="dc-mode-title" data-mode-title>Votre groupe, vos couleurs</p>
      <div class="dc-toolbar-actions">
        <button type="button" class="dc-button dc-button-primary" data-action="compare" aria-pressed="false"><span aria-hidden="true">◫</span> <span data-compare-label>Comparer les tenues</span></button>
        <button type="button" class="dc-button" data-action="reset">Réinitialiser</button>
      </div>
    </div>
    <div class="dc-comparison-copy" data-comparison-copy hidden>
      <p>Deux variantes de votre groupe, avec le même cadrage et la même lumière. Vos choix sont conservés lorsque vous revenez à la composition.</p>
      <p class="dc-comparison-detail" data-comparison-detail></p>
    </div>
    <div class="dc-workspace">
      <div class="dc-view">
        <div class="dc-comparison-tabs" data-comparison-tabs hidden role="group" aria-label="Variante à afficher">
          <button type="button" data-side="compliant" aria-pressed="true"><span aria-hidden="true">✓</span> Couleurs conformes</button>
          <button type="button" data-side="alternative" aria-pressed="false"><span aria-hidden="true">⊘</span> Couleurs à éviter</button>
        </div>
        <div class="dc-stage" data-stage>
          <div class="dc-canvas-host" data-canvas-host aria-describedby="${prefix}-help"></div>
          <div class="dc-compare-labels" data-compare-labels hidden aria-hidden="true"><span>✓ Couleurs conformes</span><span>⊘ Couleurs à éviter</span></div>
          <div class="dc-flat" data-flat></div>
          <div class="dc-loading" data-loading hidden><span data-progress-label>Préparation des personnages…</span><progress max="${composition.length}" value="0" aria-label="Chargement des personnages"></progress></div>
        </div>
        <div class="dc-view-controls">
          <div class="dc-camera-buttons" role="group" aria-label="Cadrage du groupe">
            <button class="dc-icon-button" type="button" data-action="left" aria-label="Tourner le groupe vers la gauche" title="Tourner vers la gauche">↶</button>
            <button class="dc-icon-button" type="button" data-action="right" aria-label="Tourner le groupe vers la droite" title="Tourner vers la droite">↷</button>
            <button class="dc-icon-button" type="button" data-action="zoom-in" aria-label="Rapprocher la vue" title="Rapprocher la vue">+</button>
            <button class="dc-icon-button" type="button" data-action="zoom-out" aria-label="Éloigner la vue" title="Éloigner la vue">−</button>
            <button class="dc-button dc-group-button" type="button" data-action="group">Vue du groupe</button>
          </div>
          <button class="dc-button dc-view-toggle" type="button" data-action="view">Vue couleurs</button>
        </div>
        <p class="dc-help" id="${prefix}-help">Glissez horizontalement pour tourner. Pincez pour zoomer. Au clavier : flèches, +, − et Origine.</p>
        <p class="dc-engine-status" data-engine-status role="status" aria-live="polite">${autoLoad ? 'La scène 3D se chargera à l’approche de cette section.' : 'L’économie de données est activée. Vous pouvez explorer les couleurs ou charger la vue 3D.'}</p>
        <button class="dc-button dc-retry" type="button" data-action="retry" hidden>Charger la vue 3D</button>
      </div>
      <div class="dc-panel" data-panel>
        <div class="dc-panel-heading"><span class="dc-selected-swatch" data-selected-swatch aria-hidden="true"></span><div><p class="dc-panel-caption">Personne sélectionnée</p><h3 data-selected-label></h3></div></div>
        <div class="dc-selects">
          <label for="${prefix}-person">Choisir une personne</label>
          <select id="${prefix}-person" data-select-person>${composition.map((person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.label)}</option>`).join('')}</select>
          <label for="${prefix}-role">Rôle dans le groupe</label>
          <select id="${prefix}-role" data-select-role>${config.roles.map((role) => `<option value="${escapeHtml(role.id)}">${escapeHtml(role.label)}</option>`).join('')}</select>
          <label for="${prefix}-model">Silhouette et tenue</label>
          <select id="${prefix}-model" data-select-model>${config.models.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.label)}</option>`).join('')}</select>
        </div>
        <fieldset class="dc-palette"><legend>Explorer les couleurs</legend><div class="dc-swatches">${config.colors.map((color) => `<button type="button" class="dc-swatch" data-color-id="${escapeHtml(color.id)}" aria-pressed="false"><span class="dc-swatch-chip" style="--swatch:${escapeHtml(color.hex)}" aria-hidden="true"><span data-swatch-icon></span></span><span class="dc-swatch-name">${escapeHtml(color.label)}</span><span class="dc-swatch-status" data-swatch-status></span></button>`).join('')}</div></fieldset>
        <div class="dc-compliance" data-compliance role="status" aria-live="polite" aria-atomic="true"></div>
        <div class="dc-alternatives" data-alternatives hidden><p>Quelques alternatives à essayer</p><div data-alternative-buttons></div></div>
      </div>
    </div>
    <div class="dc-roster-heading"><h3>Les personnes du groupe</h3><p>Sélectionnez une silhouette pour imaginer sa tenue.</p></div>
    <div class="dc-roster" role="group" aria-label="Personnes du groupe">${composition.map((person) => `<button type="button" class="dc-person" data-person-id="${escapeHtml(person.id)}" aria-pressed="false"><span class="dc-person-color" data-person-chip aria-hidden="true"></span><span class="dc-person-copy"><strong>${escapeHtml(person.label)}</strong><span data-person-role></span><span class="dc-person-description" data-person-description></span></span></button>`).join('')}</div>
    <div class="dc-footnotes">
      <details class="dc-legend"><summary>Comprendre les couleurs</summary><dl>${Object.entries(config.statuses).map(([status, info]) => `<div><dt><span aria-hidden="true">${escapeHtml(info.icon)}</span> ${escapeHtml(info.label)}</dt><dd>${status === 'recommended' && !hasRecommendations ? 'La palette recommandée n’est pas encore définie.' : escapeHtml(info.message)}</dd></div>`).join('')}</dl><p>${escapeHtml(ruleExplanation)}</p><p>La couleur d’un tissu varie avec l’éclairage et l’écran. Cette visualisation vous aide à comparer les teintes.</p></details>
      <p class="dc-asset-note">${isProvisional ? 'Personnages de démonstration — rendu 3D provisoire. Ces silhouettes ne représentent pas vos proches.' : 'Silhouettes illustratives : les matières et les couleurs peuvent varier selon l’écran.'} <a href="${new URL('./models/credits.html', import.meta.url).href}" target="_blank" rel="noopener noreferrer">Crédits des modèles<span class="dc-sr-only"> (nouvel onglet)</span></a></p>
    </div>`;

  /** @template {HTMLElement} T @param {string} selector @returns {T} */
  const find = (selector) => /** @type {T} */ (host.querySelector(selector));
  const stage = find('[data-stage]');
  const canvasHost = find('[data-canvas-host]');
  const flat = find('[data-flat]');
  const status = find('[data-engine-status]');
  const loadingUi = find('[data-loading]');
  const retry = find('[data-action="retry"]');
  const isCompact = () => stage.clientWidth <= 700;

  const colorById = (id) => config.colors.find((color) => color.id === id);
  const roleById = (id) => config.roles.find((role) => role.id === id);

  function setCameraAvailability() {
    host.querySelectorAll('[data-action="left"], [data-action="right"], [data-action="zoom-in"], [data-action="zoom-out"]').forEach((button) => {
      /** @type {HTMLButtonElement} */ (button).disabled = !scene || view !== '3d';
    });
  }

  /** @param {Participant[]} people @param {string} [title] */
  function flatGroup(people, title = '') {
    return `<div class="dc-flat-group">${title ? `<h4>${escapeHtml(title)}</h4>` : '<p class="dc-flat-title">Votre harmonie de couleurs</p>'}<ul>${people.map((person) => {
      const color = colorById(person.colorId);
      const result = evaluateColor(color, person.role, config);
      return `<li><span class="dc-flat-fabric" style="--swatch:${escapeHtml(color.hex)}" aria-hidden="true"></span><strong>${escapeHtml(person.label)}</strong><span>${escapeHtml(roleById(person.role)?.label)}</span><span>${escapeHtml(color.label)}</span><span class="dc-flat-status"><span aria-hidden="true">${escapeHtml(result.icon)}</span> ${escapeHtml(result.label)}</span></li>`;
    }).join('')}</ul></div>`;
  }

  function renderFlat() {
    flat.innerHTML = comparison
      ? isCompact()
        ? flatGroup(comparison[comparisonSide], comparisonSide === 'compliant' ? 'Couleurs conformes' : 'Couleurs à éviter')
        : flatGroup(comparison.compliant, 'Couleurs conformes') + flatGroup(comparison.alternative, 'Couleurs à éviter')
      : flatGroup(composition);
    flat.classList.toggle('dc-flat-comparison', Boolean(comparison) && !isCompact());
  }

  function render() {
    if (disposed) return;
    const person = composition.find((item) => item.id === selectedId) || composition[0];
    const color = colorById(person.colorId);
    const result = evaluateColor(color, person.role, config);
    host.classList.toggle('dc-comparing', Boolean(comparison));
    find('[data-panel]').hidden = Boolean(comparison);
    find('[data-comparison-copy]').hidden = !comparison;
    find('[data-compare-labels]').hidden = !comparison || isCompact() || !scene;
    find('[data-comparison-tabs]').hidden = !comparison || !isCompact();
    find('[data-mode-title]').textContent = comparison ? 'Deux harmonies, un même groupe' : 'Votre groupe, vos couleurs';
    find('[data-compare-label]').textContent = comparison ? 'Revenir à ma composition' : 'Comparer les tenues';
    find('[data-action="compare"]').setAttribute('aria-pressed', String(Boolean(comparison)));
    find('[data-selected-label]').textContent = person.label;
    find('[data-selected-swatch]').style.backgroundColor = color.hex;
    /** @type {HTMLSelectElement} */ (find('[data-select-person]')).value = person.id;
    /** @type {HTMLSelectElement} */ (find('[data-select-role]')).value = person.role;
    /** @type {HTMLSelectElement} */ (find('[data-select-model]')).value = person.modelId;
    for (const button of host.querySelectorAll('[data-color-id]')) {
      const element = /** @type {HTMLButtonElement} */ (button);
      const swatch = colorById(element.dataset.colorId);
      const swatchResult = evaluateColor(swatch, person.role, config);
      element.setAttribute('aria-pressed', String(swatch.id === person.colorId));
      element.setAttribute('aria-label', `${swatch.label} — ${swatchResult.label}${swatch.demonstration ? ' — teinte de démonstration' : ''}`);
      element.dataset.status = swatchResult.status;
      element.querySelector('[data-swatch-icon]').textContent = swatchResult.icon;
      element.querySelector('[data-swatch-status]').textContent = swatchResult.label;
    }
    const compliance = find('[data-compliance]');
    compliance.dataset.status = result.status;
    compliance.innerHTML = `<p class="dc-compliance-title"><span aria-hidden="true">${escapeHtml(result.icon)}</span> ${escapeHtml(color.label)} · ${escapeHtml(result.label)}</p><p>${escapeHtml(result.message)}</p>${color.demonstration ? '<p class="dc-demo-reminder">Teinte de démonstration, sans recommandation officielle.</p>' : ''}`;
    const alternatives = config.colors.filter((item) => isCompliant(evaluateColor(item, person.role, config))).slice(0, 3);
    find('[data-alternatives]').hidden = isCompliant(result) || !alternatives.length;
    find('[data-alternative-buttons]').innerHTML = alternatives.map((item) => `<button type="button" class="dc-alternative" data-alternative-color="${escapeHtml(item.id)}"><span style="background:${escapeHtml(item.hex)}" aria-hidden="true"></span>${escapeHtml(item.label)}</button>`).join('');

    for (const button of host.querySelectorAll('[data-person-id]')) {
      const element = /** @type {HTMLButtonElement} */ (button);
      const item = composition.find((candidate) => candidate.id === element.dataset.personId);
      const shown = comparison ? comparison[comparisonSide].find((candidate) => candidate.id === item.id) : item;
      const itemColor = colorById(shown.colorId);
      const itemResult = evaluateColor(itemColor, item.role, config);
      element.setAttribute('aria-pressed', String(item.id === selectedId));
      /** @type {HTMLElement} */ (element.querySelector('[data-person-chip]')).style.backgroundColor = itemColor.hex;
      element.querySelector('[data-person-role]').textContent = roleById(item.role)?.label || '';
      element.querySelector('[data-person-description]').textContent = `${itemColor.label} · ${itemResult.icon} ${itemResult.label}`;
    }
    if (comparison) {
      find('[data-comparison-detail]').textContent = comparison.changes.map((change) => `${composition.find((item) => item.id === change.id)?.label} : ${colorById(change.from)?.label} à éviter ; ${colorById(change.to)?.label} conforme aux règles.`).join(' ');
    }
    host.querySelectorAll('[data-side]').forEach((button) => button.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (button).dataset.side === comparisonSide)));
    renderFlat();
    scene?.setComposition(composition);
    scene?.setComparison(comparison);
    scene?.setComparisonSide(comparisonSide);
    scene?.setSelection(selectedId);
    setCameraAvailability();
  }

  /** @param {string} message */
  function fallback(message) {
    generation++;
    scene?.dispose();
    scene = null;
    loading = false;
    autoLoad = false;
    view = '2d';
    loadingUi.hidden = true;
    flat.hidden = false;
    canvasHost.hidden = true;
    retry.hidden = false;
    retry.textContent = 'Réessayer la vue 3D';
    find('[data-action="view"]').textContent = 'Vue 3D';
    host.dataset.renderState = 'fallback';
    status.textContent = message;
    render();
  }

  async function start3d() {
    if (disposed || loading || scene) return;
    const request = ++generation;
    view = '3d';
    loading = true;
    loadingUi.hidden = false;
    canvasHost.hidden = false;
    retry.hidden = true;
    host.dataset.renderState = 'loading';
    find('[data-action="view"]').textContent = 'Vue couleurs';
    status.textContent = 'Chargement progressif des personnages. Les couleurs restent disponibles pendant ce temps.';
    try {
      const moduleUrl = new URL('./scene.bundle.js', import.meta.url).href;
      const { createScene } = /** @type {typeof import('./scene.js')} */ (await import(moduleUrl));
      if (disposed || request !== generation) return;
      scene = createScene({
        container: canvasHost, config, composition,
        onSelect: (id) => { selectedId = id; render(); },
        onProgress: (progress) => {
          if (disposed || request !== generation) return;
          find('[data-progress-label]').textContent = progress.message;
          /** @type {HTMLProgressElement} */ (find('progress')).value = progress.loaded;
          if (progress.loaded > 0) flat.hidden = true;
          if (progress.loaded < progress.total) {
            loading = true;
            loadingUi.hidden = false;
            host.dataset.renderState = 'loading';
            status.textContent = 'Chargement de la tenue sélectionnée. Vos couleurs sont conservées.';
          }
          if (progress.loaded === progress.total) {
            loading = false;
            loadingUi.hidden = true;
            host.dataset.renderState = 'ready';
            status.textContent = 'Le groupe est prêt. Vous pouvez sélectionner une silhouette et essayer les couleurs.';
          }
          setCameraAvailability();
        },
        onError: () => {
          if (!disposed && request === generation) fallback('Un personnage n’a pas pu être chargé. Vous pouvez continuer à composer et comparer les couleurs dans la vue ci-dessous.');
        },
        onContextLost: () => {
          if (!disposed && request === generation) fallback('La vue 3D a été interrompue. Vos couleurs sont conservées dans la vue ci-dessous.');
        },
      });
      scene.setVisible(visible);
      render();
    } catch {
      if (!disposed && request === generation) fallback('La vue 3D n’est pas disponible sur ce navigateur. Vous pouvez composer et comparer les couleurs dans la vue ci-dessous.');
    }
  }

  function selectColor(colorId) {
    composition = changeColor(composition, selectedId, colorId, config);
    render();
  }

  host.addEventListener('click', (event) => {
    const button = /** @type {HTMLElement} */ (event.target).closest('button');
    if (!button || !host.contains(button)) return;
    if (button.dataset.colorId) selectColor(button.dataset.colorId);
    if (button.dataset.alternativeColor) {
      selectColor(button.dataset.alternativeColor);
      find(`[data-color-id="${button.dataset.alternativeColor}"]`).focus();
    }
    if (button.dataset.personId) { selectedId = button.dataset.personId; render(); }
    if (button.dataset.side) { comparisonSide = /** @type {'compliant'|'alternative'} */ (button.dataset.side); render(); }
    switch (button.dataset.action) {
      case 'compare': {
        if (comparison) comparison = null;
        else {
          const candidate = createComparison(composition, config);
          if (!candidate.available) { status.textContent = candidate.reason; return; }
          comparison = candidate;
          comparisonSide = 'compliant';
        }
        render();
        break;
      }
      case 'reset':
        composition = resetComposition(config);
        selectedId = composition[0]?.id || null;
        comparison = null;
        scene?.resetView();
        render();
        status.textContent = 'La composition initiale a été rétablie.';
        break;
      case 'group':
        scene?.resetView();
        scene?.setSelection(null);
        status.textContent = 'La vue du groupe a été rétablie. Vos couleurs sont conservées.';
        break;
      case 'left': scene?.rotate(-0.16); break;
      case 'right': scene?.rotate(0.16); break;
      case 'zoom-in': scene?.zoom(1.1); break;
      case 'zoom-out': scene?.zoom(0.9); break;
      case 'view':
        if (view === '3d') fallback('Vue couleurs activée. Vos choix et la comparaison restent disponibles.');
        else start3d();
        break;
      case 'retry': start3d(); break;
    }
  }, { signal: listeners.signal });

  host.addEventListener('change', (event) => {
    const input = /** @type {HTMLSelectElement} */ (event.target);
    if (input.matches('[data-select-person]')) selectedId = input.value;
    if (input.matches('[data-select-role]')) composition = changeRole(composition, selectedId, input.value, config);
    if (input.matches('[data-select-model]')) composition = changeModel(composition, selectedId, input.value, config);
    render();
  }, { signal: listeners.signal });
  let wasCompact = isCompact();
  const resizeObserver = new ResizeObserver(() => {
    if (wasCompact === isCompact()) return;
    wasCompact = isCompact();
    render();
  });
  resizeObserver.observe(stage);

  /** @type {IntersectionObserver|null} */
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    scene?.setVisible(visible);
    if (visible && autoLoad) start3d();
  }, { rootMargin: '150px' }) : null;
  observer?.observe(stage);
  if (!observer) { visible = true; if (autoLoad) start3d(); }
  if (!autoLoad) { retry.hidden = false; view = '2d'; find('[data-action="view"]').textContent = 'Vue 3D'; }
  render();

  return {
    getState: () => ({ composition: composition.map((person) => ({ ...person })), selectedId, comparing: Boolean(comparison), comparisonSide }),
    diagnostics: () => scene?.diagnostics() || { mode: '2d' },
    destroy() {
      disposed = true;
      generation++;
      listeners.abort();
      observer?.disconnect();
      resizeObserver.disconnect();
      scene?.dispose();
      scene = null;
      host.replaceChildren();
    },
  };
}

export class WeddingDressCode extends HTMLElement {
  configuration = dressCodeConfig;
  /** @type {ReturnType<typeof mountDressCode>|null} */
  simulator = null;
  connectedCallback() {
    if (!this.simulator) this.simulator = mountDressCode(this, this.configuration);
  }
  disconnectedCallback() {
    this.simulator?.destroy();
    this.simulator = null;
  }
}

if (!customElements.get('wedding-dress-code')) customElements.define('wedding-dress-code', WeddingDressCode);
