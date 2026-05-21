/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#ffffff',
        panel: '#f6f8fb',
        line: '#dbe3ed',
        ink: '#17202a',
        muted: '#657386',
        primary: '#0b7fab',
        success: '#15803d',
        warning: '#b45309',
        danger: '#b91c1c'
      },
      boxShadow: {
        card: 'var(--shadow-card)'
      }
    }
  },
  plugins: []
};
