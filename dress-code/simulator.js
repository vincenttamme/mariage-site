import { dressCodeConfig } from './config.js';
import { defaultAllowedColor, evaluateColor, selectAllowedColor } from './colors.js';

/** @typedef {import('./config.js').DressCodeConfig} DressCodeConfig */
/** @typedef {import('./config.js').DressCharacter} DressCharacter */
/** @typedef {ReturnType<import('./scene.js').createScene>} SceneAdapter */

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let instanceCount = 0;

/**
 * Mount the existing WebGL engine with one fixed outfit per presentation.
 * Both the palette and character selection remain usable without WebGL.
 * @param {HTMLElement} host
 * @param {DressCodeConfig} [config]
 */
export function mountDressCode(host, config = dressCodeConfig) {
  const prefix = 'dress-code-' + ++instanceCount;
  const listeners = new AbortController();
  if (config.characters.length !== 2) throw new RangeError('Deux présentations sont nécessaires.');
  let characterId = config.characters[0].id;
  let colorId = defaultAllowedColor(config);
  /** @type {SceneAdapter|null} */
  let scene = null;
  let visible = false;
  let disposed = false;
  let loading = false;
  let generation = 0;
  let view = '3d';
  const connection = /** @type {Navigator & {connection?:{saveData?:boolean}}} */ (navigator).connection;
  let autoLoad = !connection?.saveData;
  const isProvisional = config.models.some((model) => model.provisional);

  host.classList.add('dc-simulator');
  host.dataset.renderState = 'waiting';
  host.innerHTML = `
    <div class="dc-heading">
      <h2 id="${prefix}-title">${escapeHtml(config.title)}</h2>
      <p class="dc-intro">${escapeHtml(config.subtitle)}</p>
    </div>
    <p class="dc-palette-note"><strong>${escapeHtml(config.palette.label)}.</strong> ${escapeHtml(config.palette.description)}</p>
    <div class="dc-stage" data-stage aria-labelledby="${prefix}-title">
      <div class="dc-character-switch" role="group" aria-label="Choisissez un personnage">
        ${config.characters.map((character) => `<button type="button" data-character-id="${escapeHtml(character.id)}" aria-pressed="false">${escapeHtml(character.label)}</button>`).join('')}
      </div>
      <div class="dc-canvas-host" data-canvas-host aria-describedby="${prefix}-help"></div>
      <div class="dc-flat" data-flat hidden>
        <span class="dc-flat-fabric" data-flat-fabric aria-hidden="true"></span>
        <p data-flat-label></p>
        <p class="dc-flat-detail">La vue 3D n’est pas disponible. Vous pouvez toujours choisir votre couleur.</p>
      </div>
      <div class="dc-loading" data-loading hidden>
        <span data-progress-label>Préparation du personnage…</span>
        <progress max="1" value="0" aria-label="Chargement du personnage 3D"></progress>
      </div>
      <div class="dc-rotation" role="group" aria-label="Rotation du personnage">
        <button type="button" data-action="left" aria-label="Tourner le personnage vers la gauche" title="Tourner à gauche" disabled>↶</button>
        <button type="button" data-action="right" aria-label="Tourner le personnage vers la droite" title="Tourner à droite" disabled>↷</button>
      </div>
      <fieldset class="dc-palette">
        <legend>Choisissez votre couleur</legend>
        <div class="dc-swatches">
          ${config.colors.map((color) => {
            const result = evaluateColor(color.id, config);
            const forbidden = result.status === 'forbidden';
            return `<button type="button" class="dc-swatch" data-color-id="${escapeHtml(color.id)}" aria-label="${escapeHtml(color.label)} — ${forbidden ? 'couleur interdite' : 'couleur autorisée, teinte de démonstration'}" aria-pressed="false" aria-disabled="${forbidden}" ${forbidden ? 'disabled' : ''}>
              <span class="dc-swatch-chip" style="--swatch:${result.hex}" aria-hidden="true">${forbidden ? '<span class="dc-forbidden-icon">×</span>' : ''}</span>
              <span class="dc-swatch-name">${escapeHtml(color.label)}</span>
            </button>`;
          }).join('')}
        </div>
        <p class="dc-restriction" id="${prefix}-restriction">${escapeHtml(config.forbiddenMessage)}</p>
      </fieldset>
    </div>
    <p class="dc-help" id="${prefix}-help">Faites glisser pour tourner le personnage. Vous pouvez aussi utiliser les flèches.</p>
    <p class="dc-engine-status" data-engine-status role="status" aria-live="polite">${autoLoad ? 'La vue 3D se chargera à l’approche de cette section.' : 'L’économie de données est activée. Vous pouvez charger la vue 3D.'}</p>
    <button class="dc-retry" type="button" data-action="retry" hidden>Charger la vue 3D</button>
    <p class="dc-asset-note">${isProvisional ? 'Personnages de démonstration — rendu 3D provisoire.' : 'Les matières et les couleurs peuvent varier selon l’écran.'} <a href="${new URL('./models/credits.html', import.meta.url).href}" target="_blank" rel="noopener noreferrer">Crédits des modèles <span class="dc-sr-only">(nouvel onglet)</span></a></p>`;

  /** @template {HTMLElement} T @param {string} selector @returns {T} */
  const find = (selector) => /** @type {T} */ (host.querySelector(selector));
  const stage = find('[data-stage]');
  const canvasHost = find('[data-canvas-host]');
  const flat = find('[data-flat]');
  const loadingUi = find('[data-loading]');
  const status = find('[data-engine-status]');
  const retry = /** @type {HTMLButtonElement} */ (find('[data-action="retry"]'));
  /** @returns {DressCharacter} */
  const currentCharacter = () => config.characters.find((item) => item.id === characterId);

  function updateControls() {
    const color = evaluateColor(colorId, config);
    for (const button of host.querySelectorAll('[data-character-id]')) {
      const item = /** @type {HTMLButtonElement} */ (button);
      item.setAttribute('aria-pressed', String(item.dataset.characterId === characterId));
    }
    for (const button of host.querySelectorAll('[data-color-id]')) {
      const item = /** @type {HTMLButtonElement} */ (button);
      item.setAttribute('aria-pressed', String(item.dataset.colorId === colorId));
    }
    /** @type {HTMLElement} */ (find('[data-flat-fabric]')).style.background = color.hex;
    find('[data-flat-label]').textContent = color.label;
    host.querySelectorAll('[data-action="left"],[data-action="right"]').forEach((button) => {
      /** @type {HTMLButtonElement} */ (button).disabled = !scene || view !== '3d';
    });
  }

  /** @param {string} message */
  function fallback(message) {
    ++generation;
    scene?.dispose();
    scene = null;
    loading = false;
    autoLoad = false;
    view = '2d';
    loadingUi.hidden = true;
    canvasHost.hidden = true;
    flat.hidden = false;
    retry.hidden = false;
    retry.textContent = 'Réessayer la vue 3D';
    host.dataset.renderState = 'fallback';
    status.textContent = message;
    updateControls();
  }

  async function start3d() {
    if (disposed || loading || scene) return;
    const request = ++generation;
    view = '3d';
    loading = true;
    loadingUi.hidden = false;
    canvasHost.hidden = false;
    flat.hidden = true;
    retry.hidden = true;
    host.dataset.renderState = 'loading';
    status.textContent = 'Préparation de la tenue…';
    try {
      const moduleUrl = new URL('./scene.bundle.js', import.meta.url).href;
      const { createScene } = /** @type {typeof import('./scene.js')} */ (await import(moduleUrl));
      if (disposed || request !== generation) return;
      scene = createScene({
        container: canvasHost,
        config,
        character: { ...currentCharacter(), colorId },
        onProgress: (progress) => {
          if (disposed || request !== generation) return;
          find('[data-progress-label]').textContent = progress.message;
          /** @type {HTMLProgressElement} */ (find('progress')).value = progress.loaded;
          loading = progress.loaded !== progress.total;
          loadingUi.hidden = !loading;
          host.dataset.renderState = loading ? 'loading' : 'ready';
          status.textContent = loading ? 'Chargement du personnage…' : 'Votre tenue est prête : choisissez une couleur.';
          updateControls();
        },
        onError: () => {
          if (!disposed && request === generation) fallback('Le personnage n’a pas pu être chargé. Vous pouvez toujours choisir une couleur.');
        },
        onContextLost: () => {
          if (!disposed && request === generation) fallback('La vue 3D a été interrompue. Votre couleur reste sélectionnée.');
        },
      });
      scene.setVisible(visible);
      updateControls();
    } catch {
      if (!disposed && request === generation) fallback('La vue 3D n’est pas disponible sur ce navigateur. Le nuancier reste utilisable.');
    }
  }

  /** @param {string} nextId */
  function changeCharacter(nextId) {
    const next = config.characters.find((entry) => entry.id === nextId);
    if (!next) throw new RangeError('Personnage inconnu.');
    if (next.id === characterId) return;
    characterId = next.id;
    scene?.setCharacter({ ...next, colorId });
    updateControls();
  }

  /** @param {string} nextId */
  function changeColor(nextId) {
    colorId = selectAllowedColor(nextId, config);
    scene?.setColor(colorId);
    updateControls();
  }

  host.addEventListener('click', (event) => {
    const button = /** @type {HTMLElement} */ (event.target).closest('button');
    if (!button || !host.contains(button) || /** @type {HTMLButtonElement} */ (button).disabled) return;
    if (button.dataset.characterId) changeCharacter(button.dataset.characterId);
    if (button.dataset.colorId) changeColor(button.dataset.colorId);
    switch (button.dataset.action) {
      case 'left': scene?.rotate(-0.18); break;
      case 'right': scene?.rotate(0.18); break;
      case 'retry': void start3d(); break;
    }
  }, { signal: listeners.signal });

  /** @type {IntersectionObserver|null} */
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    scene?.setVisible(visible);
    if (visible && autoLoad) void start3d();
  }, { rootMargin: '150px' }) : null;
  observer?.observe(stage);
  if (!observer) {
    visible = true;
    if (autoLoad) void start3d();
  }
  if (!autoLoad) {
    retry.hidden = false;
    view = '2d';
    flat.hidden = false;
    canvasHost.hidden = true;
    host.dataset.renderState = 'fallback';
  }
  updateControls();

  return {
    getState: () => ({ characterId, colorId, modelId: currentCharacter().modelId, view }),
    diagnostics: () => scene?.diagnostics() || { mode: '2d' },
    destroy() {
      disposed = true;
      ++generation;
      listeners.abort();
      observer?.disconnect();
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
