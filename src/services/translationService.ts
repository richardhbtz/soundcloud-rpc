import en from '../i18n/en.json';
import pt_BR from '../i18n/pt-BR.json';
import es from '../i18n/es.json';

const translations = {
    en,
    'pt-BR': pt_BR,
    es,
} as const;

type Lang = keyof typeof translations;

export type TranslationKeys = keyof typeof en;

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

    /** Every string in the current language, with English filling any gaps. */
    all(): Record<string, string> {
        return { ...en, ...translations[this.currentLang] };
    }

    translate(key: TranslationKeys): string {
        return (translations[this.currentLang] as Record<string, string>)[key] ?? en[key] ?? key;
    }
}
