/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2563eb', dark: '#1d4ed8', light: '#dbeafe' },
        sidebar: '#1e293b',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
