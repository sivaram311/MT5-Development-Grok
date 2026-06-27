/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      screens: {
        mobile: '360px',
        tablet: '800px',
      },
    },
  },
  plugins: [],
};
