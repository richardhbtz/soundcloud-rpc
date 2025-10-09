import * as en from '../i18n/en.json';
import * as pt_BR from '../i18n/pt-BR.json';
import * as es from '../i18n/es.json';

const translations = {
    en,
    'pt-BR': pt_BR,
    es,
} as const;

type Lang = keyof typeof translations;

type TranslationKeys = keyof typeof en;

export class TranslationService {
    private currentLang: Lang = 'en';

    constructor(initialLang: Lang = 'en') {
        this.currentLang = initialLang;
    }

    setLanguage(lang: Lang) {
        this.currentLang = ['en', 'pt-BR', 'es'].includes(lang) ? lang : 'en';
    }

    getLanguage(): Lang {
        return this.currentLang;
    }

    translate(key: TranslationKeys): string {
        const dict = translations[this.currentLang] as Record<string, string>;
        return dict[key as string] ?? (en as Record<string, string>)[key as string] ?? (key as string);
    }
}
