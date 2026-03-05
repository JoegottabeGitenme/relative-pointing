/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'neon-cyan': '#00f0ff',
        'neon-magenta': '#ff00e5',
        'neon-green': '#39ff14',
        'neon-blue': '#4d8bff',
        'neon-yellow': '#ffe600',
        'neon-red': '#ff3c3c',
        'neon-bg': {
          900: '#0a0e17',
          800: '#0f1623',
          700: '#151d2e',
          600: '#1b2540',
          500: '#223052',
        },
      },
      boxShadow: {
        'glow-cyan-sm': '0 0 8px rgba(0, 240, 255, 0.4)',
        'glow-cyan': '0 0 20px rgba(0, 240, 255, 0.5), 0 0 40px rgba(0, 240, 255, 0.2)',
        'glow-green-sm': '0 0 8px rgba(57, 255, 20, 0.4)',
        'glow-green': '0 0 20px rgba(57, 255, 20, 0.5), 0 0 40px rgba(57, 255, 20, 0.2)',
        'glow-magenta-sm': '0 0 8px rgba(255, 0, 229, 0.4)',
        'glow-magenta': '0 0 20px rgba(255, 0, 229, 0.5), 0 0 40px rgba(255, 0, 229, 0.2)',
        'glow-yellow-sm': '0 0 8px rgba(255, 230, 0, 0.4)',
        'glow-yellow': '0 0 20px rgba(255, 230, 0, 0.5), 0 0 40px rgba(255, 230, 0, 0.2)',
        'glow-red-sm': '0 0 8px rgba(255, 60, 60, 0.4)',
        'glow-red': '0 0 20px rgba(255, 60, 60, 0.5), 0 0 40px rgba(255, 60, 60, 0.2)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.3), 0 0 1px rgba(0, 240, 255, 0.1)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.4), 0 0 8px rgba(0, 240, 255, 0.15)',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'glow-breathe': 'glow-breathe 3s ease-in-out infinite',
        'border-glow': 'border-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'glow-breathe': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0, 240, 255, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 240, 255, 0.6)' },
        },
        'border-glow': {
          '0%, 100%': { borderColor: 'rgba(0, 240, 255, 0.4)' },
          '50%': { borderColor: 'rgba(0, 240, 255, 0.8)' },
        },
      },
    },
  },
  plugins: [],
};
