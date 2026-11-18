const lang = (navigator.language || 'en').startsWith('ru') ? 'ru' : 'en';
const dict = {
  ru: { hint: 'Тапни по земле, чтобы идти' },
  en: { hint: 'Tap the ground to walk' },
};
export const t = (k) => dict[lang][k] ?? k;
