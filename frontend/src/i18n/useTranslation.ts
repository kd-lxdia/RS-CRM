import { useTranslation as useI18nTranslation } from 'react-i18next';
import {
  formatIndianCurrency,
  formatIndianCurrencyShort,
  formatIndianNumber,
  formatIndianNumberShort,
  formatIndianDate,
  formatIndianDateTime,
} from './formatters';

/**
 * Custom hook that extends react-i18next's useTranslation with Indian formatting utilities
 */
export function useTranslation() {
  const { t, i18n } = useI18nTranslation();

  return {
    t,
    i18n,
    // Formatting utilities
    formatCurrency: formatIndianCurrency,
    formatCurrencyShort: formatIndianCurrencyShort,
    formatNumber: formatIndianNumber,
    formatNumberShort: formatIndianNumberShort,
    formatDate: formatIndianDate,
    formatDateTime: formatIndianDateTime,
    // Language helpers
    isHindi: i18n.language === 'hi',
    isEnglish: i18n.language === 'en',
    currentLanguage: i18n.language,
  };
}

export default useTranslation;
