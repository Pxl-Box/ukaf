import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcdaff',
          300: '#8ec3ff',
          400: '#59a1ff',
          500: '#337dff',
          600: '#1b5cf5',
          700: '#1546e1',
          800: '#183bb6',
          900: '#19368f',
          950: '#142257',
        },
        steel: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5dae3',
          300: '#b0bacb',
          400: '#8494ae',
          500: '#647694',
          600: '#4f5e7a',
          700: '#414d63',
          800: '#384253',
          900: '#323a48',
          950: '#21262f',
        },
        accent: {
          400: '#ffc247',
          500: '#f5a30b',
          600: '#d98104',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)',
        lift: '0 12px 32px -12px rgba(16,24,40,.28)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in .25s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
