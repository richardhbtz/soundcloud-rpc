import * as en from '../i18n/en.json';
import * as pt_BR from '../i18n/pt-BR.json';
import * as es from '../i18n/es.json';

type Lang = keyof typeof translations;

const translations = {
    en,
    "pt-BR": pt_BR,
    es
} as const;

export class TranslationService {
    private currentLang: Lang = 'en';

    constructor(initialLang: Lang = 'en') {
        this.currentLang = initialLang;
    }

    setLanguage(lang: Lang) {
        this.currentLang = ["en", "pt-BR", "es"].includes(lang) ? lang : 'en';
    }

    getLanguage(): Lang {
        return this.currentLang;
    }

    translate(key: keyof typeof translations[Lang]): string {
        return translations[this.currentLang][key] || key;
    }
}