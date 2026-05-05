/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SF Mono',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        // Studio Mono accent (single highlight)
        accent: '#329AF0',
        'accent-soft': '#e7f4fe',
        'accent-soft-dark': '#0a243d',

        // Light surface tokens
        ink: '#0a0a0a',
        surface: '#fafafa',
        card: '#ffffff',
        'card-alt': '#fafafa',
        hairline: '#f0f0f0',

        // Tag accents (kept for tag stripes)
        'tag-blue': '#3b82f6',
        'tag-blue-dark': '#60a5fa',
        'tag-red': '#ef4444',
        'tag-red-dark': '#f87171',
        'tag-green': '#10b981',
        'tag-green-dark': '#34d399',
        'tag-yellow': '#f59e0b',
        'tag-yellow-dark': '#fbbf24',
        'tag-purple': '#8b5cf6',
        'tag-purple-dark': '#a78bfa',

        // Legacy palette tokens kept so existing classes still resolve
        'accent-cyan': '#329AF0',
        'accent-rose': '#329AF0',
        'accent-green': '#329AF0',
        'accent-blue': '#329AF0',
        'accent-yellow': '#329AF0',
        'accent-red': '#329AF0',
        warm: {
          50: '#ffffff',
          100: '#fafafa',
          200: '#f0f0f0',
          300: '#e5e5e5',
          400: '#d4d4d4',
        },
        'dark-bg': {
          900: '#0a0a0a',
          800: '#171717',
          700: '#1f1f1f',
          600: '#2a2a2a',
          500: '#404040',
        },
      },
      boxShadow: {
        // Studio Mono signature: hard offset shadow
        'hard-sm': '4px 4px 0 #0a0a0a',
        hard: '8px 8px 0 #0a0a0a',
        'hard-accent': '4px 4px 0 #329AF0',
        'hard-dark': '8px 8px 0 #2a2a2a',
        // Legacy keys kept (mapped to flat shadows so existing classes still load)
        'glow-primary-sm': '0 1px 2px rgba(0,0,0,0.04)',
        'glow-primary': '0 1px 3px rgba(0,0,0,0.06)',
        'glow-success-sm': '0 1px 2px rgba(0,0,0,0.04)',
        'glow-success': '0 1px 3px rgba(0,0,0,0.06)',
        'glow-accent-sm': '0 1px 2px rgba(0,0,0,0.04)',
        'glow-accent': '0 1px 3px rgba(0,0,0,0.06)',
        'glow-warning-sm': '0 1px 2px rgba(0,0,0,0.04)',
        'glow-warning': '0 1px 3px rgba(0,0,0,0.06)',
        'glow-danger-sm': '0 1px 2px rgba(0,0,0,0.04)',
        'glow-danger': '0 1px 3px rgba(0,0,0,0.06)',
        card: '0 1px 3px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 2px 8px rgba(0, 0, 0, 0.12)',
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
