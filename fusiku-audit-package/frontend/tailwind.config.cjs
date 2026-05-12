/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        'glass-xl': '0 24px 70px rgba(2, 6, 23, 0.14)',
      },
    },
  },
  plugins: [],
}

