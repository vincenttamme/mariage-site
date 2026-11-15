import { dressCodeConfig } from './config.js';

/** @typedef {import('./config.js').DressCodeConfig} DressCodeConfig */
/** @typedef {import('./config.js').DressColor} DressColor */
/** @typedef {import('./config.js').ComplianceStatus} ComplianceStatus */
/** @typedef {import('./config.js').RuleSelector} RuleSelector */
/**
 * @typedef {object} ComplianceResult
 * @property {ComplianceStatus} status
 * @property {string} label
 * @property {string} icon
 * @property {string} message
 * @property {string[]} families
 * @property {string} colorId
 * @property {string} hex
 * @property {string} source
 */

/** @type {Record<ComplianceStatus, number>} */
const priority = { allowed: 0, recommended: 1, reserved: 2, forbidden: 3 };
/** @type {ComplianceStatus[]} */
const statuses = ['allowed', 'recommended', 'reserved', 'forbidden'];

/** @param {string} hex @returns {string} */
export function normalizeHex(hex) {
  if (typeof hex !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex.trim())) {
    throw new TypeError('La couleur doit être un code hexadécimal de trois ou six chiffres.');
  }
  const value = hex.trim().slice(1);
  return `#${(value.length === 3 ? [...value].map((digit) => digit + digit).join('') : value).toUpperCase()}`;
}

/** @param {string} hex @returns {[number, number, number]} */
function rgb(hex) {
  const value = normalizeHex(hex).slice(1);
  return [parseInt(value.slice(0, 2), 16) / 255, parseInt(value.slice(2, 4), 16) / 255, parseInt(value.slice(4, 6), 16) / 255];
}

/** @param {string} hex @returns {{h: number, s: number, l: number}} */
export function hexToHsl(hex) {
  const [red, green, blue] = rgb(hex);
  const high = Math.max(red, green, blue);
  const low = Math.min(red, green, blue);
  const delta = high - low;
  const lightness = (high + low) / 2;
  let hue = 0;
  if (delta > 0) {
    if (high === red) hue = ((green - blue) / delta) % 6;
    else if (high === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return { h: hue, s: delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1)), l: lightness };
}

/**
 * sRGB → OKLCH. Matrices from the OKLab conversion in CSS Color 4:
 * https://www.w3.org/TR/css-color-4/#color-conversion-code
 * The measurement does not decide permission; configured rules below do.
 * @param {string} hex
 * @returns {{l: number, c: number, h: number}}
 */
export function hexToOklch(hex) {
  const [red, green, blue] = rgb(hex).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const lRoot = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const mRoot = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const sRoot = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  const lightness = 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot;
  const a = 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot;
  const b = 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot;
  const chroma = Math.hypot(a, b);
  return {
    l: Math.max(0, Math.min(1, lightness)),
    c: chroma,
    h: chroma < 1e-7 ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360,
  };
}

/** @param {number} value @param {[number, number]} range */
const within = (value, range) => value >= range[0] && value <= range[1];
/** @param {number} hue @param {[number, number]} range */
const withinHue = (hue, range) => range[0] <= range[1] ? within(hue, range) : hue >= range[0] || hue <= range[1];

/**
 * Returns matching family IDs, never a compliance decision.
 * Every bound is inclusive and fully editable in config.families.
 * @param {string} hex
 * @param {DressCodeConfig} [config]
 * @returns {string[]}
 */
export function classifyColorFamilies(hex, config = dressCodeConfig) {
  const color = hexToOklch(hex);
  return config.families.filter((family) => family.ranges.some((range) =>
    within(color.l, range.lightness) && within(color.c, range.chroma)
    && (!range.hue || withinHue(color.h, range.hue)),
  )).map((family) => family.id);
}

/** @param {string|DressColor} value @param {DressCodeConfig} config @returns {DressColor} */
function resolveColor(value, config) {
  if (typeof value === 'object' && value !== null) {
    if (!statuses.includes(value.status)) throw new TypeError('Le statut de cette couleur est inconnu.');
    return { ...value, hex: normalizeHex(value.hex) };
  }
  const color = config.colors.find((entry) => entry.id === value);
  if (color) return { ...color, hex: normalizeHex(color.hex) };
  if (typeof value !== 'string' || !value.trim().startsWith('#')) throw new RangeError('Cette couleur ne figure pas dans la palette.');
  const hex = normalizeHex(value);
  const existing = config.colors.find((entry) => normalizeHex(entry.hex) === hex);
  return existing ? { ...existing, hex } : { id: hex, label: hex, hex, status: 'allowed', demonstration: false };
}

/** @param {RuleSelector} rule @param {DressColor} color @param {string[]} families */
function matchesRule(rule, color, families) {
  const selectors = [rule.colorId, rule.familyId, rule.hex].filter((value) => value !== undefined);
  if (selectors.length !== 1) throw new TypeError('Une règle doit cibler exactement une couleur ou une famille.');
  if (rule.colorId !== undefined) return rule.colorId === color.id;
  if (rule.familyId !== undefined) return families.includes(rule.familyId);
  return normalizeHex(/** @type {string} */ (rule.hex)) === color.hex;
}

/**
 * Restrictive rules win; ordinary "allowed" lists never bypass forbidden ones.
 * Role exceptions are explicit overrides. Exact color/hex exceptions outrank a
 * family exception; equally specific exceptions choose the stricter status.
 * Demonstration colors can never be presented as officially recommended.
 * Unknown roles fail closed by throwing instead of receiving global exemptions.
 * @param {string|DressColor} colorOrId
 * @param {string} roleId
 * @param {DressCodeConfig} [config]
 * @returns {ComplianceResult}
 */
export function evaluateColor(colorOrId, roleId, config = dressCodeConfig) {
  const role = config.roles.find((entry) => entry.id === roleId);
  if (!role) throw new RangeError('Ce rôle ne figure pas dans le cortège.');
  if (!['extend', 'override'].includes(role.rules.mode)) throw new TypeError('Le mode des règles de ce rôle est inconnu.');
  const color = resolveColor(colorOrId, config);
  const families = classifyColorFamilies(color.hex, config);
  let status = color.status === 'allowed' && config.palette.officialRecommended.includes(color.id) ? 'recommended' : color.status;
  let source = 'palette';
  const ruleGroups = role.rules.mode === 'override'
    ? [{ rules: role.rules, source: 'role-rule' }]
    : [{ rules: config.globalRules, source: 'global-rule' }, { rules: role.rules, source: 'role-rule' }];

  for (const group of ruleGroups) {
    for (const candidate of statuses) {
      if (group.rules[candidate].some((rule) => matchesRule(rule, color, families)) && priority[candidate] >= priority[status]) {
        status = candidate;
        source = group.source;
      }
    }
  }

  const exceptions = role.rules.exceptions.filter((exception) => matchesRule(exception, color, families));
  for (const exception of exceptions) {
    if (!statuses.includes(exception.status)) throw new TypeError('Le statut de cette exception est inconnu.');
  }
  const specificity = /** @param {RuleSelector} rule */ (rule) => rule.familyId ? 0 : 1;
  exceptions.sort((a, b) => specificity(b) - specificity(a) || priority[b.status] - priority[a.status]);
  const exception = exceptions[0];
  if (exception) {
    status = exception.status;
    source = 'role-exception';
  }

  if (color.demonstration && status === 'recommended') {
    status = 'allowed';
    source = 'demonstration';
  }
  const display = config.statuses[status];
  return {
    status,
    label: display.label,
    icon: display.icon,
    message: (exception && exception.status === status ? exception.message : undefined) || role.messages[status] || display.message,
    families,
    colorId: color.id,
    hex: color.hex,
    source,
  };
}

/** @param {Pick<ComplianceResult, 'status'>} result @returns {boolean} */
export function isCompliant(result) {
  return result.status === 'allowed' || result.status === 'recommended';
}
