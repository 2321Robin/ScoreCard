/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0f172a',
        panel: '#111827',
        accent: '#38bdf8',
        danger: '#ef4444',
        muted: '#94a3b8',
      },
      fontFamily: {
        display: ['"Segoe UI"', 'Inter', 'system-ui', 'sans-serif'],
        body: ['"Segoe UI"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

