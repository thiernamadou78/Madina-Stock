/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#E1F5EE',
          100: '#9FE1CB',
          200: '#5DCAA5',
          400: '#1D9E75',
          600: '#0F6E56',
          800: '#085041',
          900: '#04342C',
        },
        blue: {
          50: '#E6F1FB',
          100: '#B5D4F4',
          400: '#378ADD',
          600: '#185FA5',
          800: '#0C447C',
        },
        amber: {
          50: '#FAEEDA',
          100: '#FAC775',
          400: '#BA7517',
          600: '#854F0B',
        },
        danger: {
          50: '#FCEBEB',
          100: '#F09595',
          400: '#E24B4A',
          600: '#A32D2D',
        },
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.pb-safe': {
          paddingBottom: 'env(safe-area-inset-bottom)',
        },
        '.pt-safe': {
          paddingTop: 'env(safe-area-inset-top)',
        },
      })
    },
  ],
}

