/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#f7f6f1',
        panel: '#ffffff',
        accent: '#7fb37a',
        danger: '#e25b5b',
        muted: '#6f7664',
      },
      fontFamily: {
        display: ['"Segoe UI"', 'Inter', 'system-ui', 'sans-serif'],
        body: ['"Segoe UI"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

