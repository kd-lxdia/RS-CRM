/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Inter"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
        ],
        display: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        apple: {
          blue: '#0071e3',
          darkBlue: '#0077ED',
          gray: '#f5f5f7',
          darkGray: '#1d1d1f',
          black: '#000000',
          cardDark: '#1c1c1e',
          textDark: '#f5f5f7',
          textLight: '#1d1d1f',
          textMuted: '#52525b', /* Darkened from #86868b for accessibility */
          borderLight: '#d2d2d7',
          borderDark: '#424245',
        }
      },
      boxShadow: {
        'apple': '0 4px 24px rgba(0, 0, 0, 0.04)',
        'apple-hover': '0 8px 32px rgba(0, 0, 0, 0.08)',
        'apple-dark': '0 4px 24px rgba(0, 0, 0, 0.2)',
      },
      borderRadius: {
        'apple': '18px',
        'apple-sm': '12px',
      }
    },
  },
  corePlugins: {
    preflight: false, // Prevent tailwind from overriding antd styles
  },
  plugins: [],
}
