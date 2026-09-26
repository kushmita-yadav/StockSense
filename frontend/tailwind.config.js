/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FBF6EC',
          100: '#F7EEDC',
          200: '#F0E0C4',
          300: '#E8B84B',
          400: '#DDA83A',
          500: '#C9972B',
          600: '#B58223',
          700: '#9C6E1C',
          800: '#795318',
          900: '#51390F',
          950: '#34240D',
        },
        sage: { 50: '#F2F5ED', 100: '#E6EDDA', 200: '#CCD9B8', 300: '#AFC493', 400: '#91AE70', 500: '#7A9B5C', 600: '#627D49', 700: '#4D623A' },
        clay: { 50: '#FAF0ED', 100: '#F2DED8', 200: '#E6BFB5', 300: '#D79484', 400: '#C77764', 500: '#B85C4A', 600: '#984737', 700: '#78382C' },
        plum: { 50: '#F5F0F5', 100: '#EAE0EA', 200: '#D4C4D3', 300: '#B9A0B7', 400: '#A1879F', 500: '#8B6F8A', 600: '#735A72', 700: '#5D485C' },
        surface: '#FFFDF8',
        biscuit: '#F0E0C4',
        ink: '#2E2416',
        muted: '#7A6A4F',
        honey: '#DDA83A',
      },
      fontFamily: {
        sans: ['General Sans', 'Inter', 'system-ui', 'sans-serif'],
        heading: ['Fraunces', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
