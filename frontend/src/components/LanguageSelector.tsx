import React from 'react';
import { Select } from 'antd';
import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const { Option } = Select;

interface Language {
  code: string;
  name: string;
  nativeName: string;
}

const languages: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
];

export const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();

  const handleChange = async (languageCode: string) => {
    await i18n.changeLanguage(languageCode);
    // Save preference to backend if user is logged in
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        await fetch('/api/users/me/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ language: languageCode }),
        });
      }
    } catch (error) {
      console.error('Failed to save language preference:', error);
    }
  };

  return (
    <Select
      value={i18n.language}
      onChange={handleChange}
      style={{ width: 150 }}
      suffixIcon={<Globe size={16} />}
    >
      {languages.map((lang) => (
        <Option key={lang.code} value={lang.code}>
          {lang.nativeName}
        </Option>
      ))}
    </Select>
  );
};

export default LanguageSelector;
