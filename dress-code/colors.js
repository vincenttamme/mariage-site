import { dressCodeConfig } from './config.js';

/** @typedef {import('./config.js').DressCodeConfig} DressCodeConfig */
/** @typedef {import('./config.js').DressColor} DressColor */

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


/**
 * The palette is closed: free-form colors and role exceptions are not supported.
 * Family restrictions override a mistaken "allowed" catalog entry.
 * @param {string} colorId
 * @param {DressCodeConfig} [config]
 */
export function evaluateColor(colorId, config = dressCodeConfig) {
  const color = config.colors.find((entry) => entry.id === colorId);
  if (!color) throw new RangeError('Cette couleur ne figure pas dans la palette.');
  if (color.status !== 'allowed' && color.status !== 'forbidden') throw new TypeError('Statut de couleur inconnu.');
  const families = classifyColorFamilies(color.hex, config);
  const forbidden = color.status === 'forbidden' || families.includes('white') || families.includes('burgundy');
  return {
    id: color.id,
    label: color.label,
    hex: normalizeHex(color.hex),
    demonstration: color.demonstration,
    status: forbidden ? 'forbidden' : 'allowed',
    families,
  };
}

/** @param {string} colorId @param {DressCodeConfig} [config] */
export function isAllowedColor(colorId, config = dressCodeConfig) {
  return evaluateColor(colorId, config).status === 'allowed';
}

/** @param {DressCodeConfig} [config] */
export function defaultAllowedColor(config = dressCodeConfig) {
  const fallback = config.colors.find((color) => isAllowedColor(color.id, config));
  if (!fallback) throw new RangeError('La palette doit comporter au moins une couleur autorisée.');
  return config.defaultColorId && isAllowedColor(config.defaultColorId, config) ? config.defaultColorId : fallback.id;
}

/** @param {string} colorId @param {DressCodeConfig} [config] */
export function selectAllowedColor(colorId, config = dressCodeConfig) {
  if (!isAllowedColor(colorId, config)) throw new RangeError('Cette couleur n’est pas autorisée.');
  return colorId;
}
