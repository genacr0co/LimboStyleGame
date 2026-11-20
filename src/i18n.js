// Все тексты игры — только здесь (RU/EN).
const dict = {
  ru: {
    title: 'ЗАРУБКИ',
    tap_to_start: 'коснись экрана',
    rotate: 'поверни телефон горизонтально',
    hint_move: 'удерживай край экрана — иди',
    hint_jump: 'свайп вверх — прыжок',
    hint_grab: 'коснись — взять / отпустить',
    hint_lever: 'коснись — потянуть',
    end_prologue: 'конец пролога',
    end_sub: 'коснись, чтобы начать заново',
  },
  en: {
    title: 'TALLY',
    tap_to_start: 'touch the screen',
    rotate: 'rotate your phone to landscape',
    hint_move: 'hold the screen edge — walk',
    hint_jump: 'swipe up — jump',
    hint_grab: 'tap — grab / release',
    hint_lever: 'tap — pull',
    end_prologue: 'end of prologue',
    end_sub: 'touch to start again',
  },
};

let lang = (navigator.language || 'en').toLowerCase().startsWith('ru') ? 'ru' : 'en';
try { const s = localStorage.getItem('lang'); if (s && dict[s]) lang = s; } catch (e) {}

export function t(key) { return dict[lang][key] ?? key; }
export function setLang(l) { if (dict[l]) { lang = l; try { localStorage.setItem('lang', l); } catch (e) {} } }
export function getLang() { return lang; }
