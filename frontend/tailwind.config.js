/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0f1729',
        secondary: '#1a2332',
        card: '#1e2d42',
        elevated: '#253a54',
        gold: {
          DEFAULT: '#e0b84a',
          light: '#f0d078',
          dim: '#b89530',
        },
        accent: {
          cyan: '#22d3ee',
          teal: '#14b8a6',
        },
        agent: {
          search: '#60a5fa',
          proposer: '#34d399',
          assessor: '#fbbf24',
          qa: '#a78bfa',
        },
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Source Serif 4', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        ui: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
