/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gala: {
          950: '#050403',
          900: '#0b0907',
          850: '#110e0a',
          800: '#18130d',
          700: '#241c12',
        },
        gold: {
          50: '#fdf8e8',
          100: '#f9ecc2',
          200: '#f3dc8f',
          300: '#ecc95a',
          400: '#e3b53a',
          500: '#d4a12a',
          600: '#b07f1f',
          700: '#8a611b',
          800: '#5f4314',
          900: '#3a290d',
        },
        cvp: {
          400: '#ff4b4b',
          500: '#e30613',
          600: '#b8050f',
          700: '#8c040b',
        },
      },
      fontFamily: {
        display: ['"Cinzel"', 'Georgia', 'serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Montserrat"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(227,181,58,.35), 0 10px 40px -10px rgba(227,181,58,.35)',
        'gold-lg': '0 0 0 1px rgba(227,181,58,.55), 0 20px 80px -10px rgba(227,181,58,.55)',
        'red-glow': '0 0 30px -5px rgba(227,6,19,.6)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        sweep: {
          '0%,100%': { transform: 'rotate(-18deg)' },
          '50%': { transform: 'rotate(18deg)' },
        },
        twinkle: {
          '0%,100%': { opacity: '0.15', transform: 'scale(.6)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
        rise: {
          '0%': { transform: 'translateY(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '100%': { transform: 'translateY(-110vh)', opacity: '0' },
        },
        pulseGlow: {
          '0%,100%': { opacity: '.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        shimmer: 'shimmer 6s linear infinite',
        float: 'float 6s ease-in-out infinite',
        sweep: 'sweep 9s ease-in-out infinite',
        'sweep-slow': 'sweep 13s ease-in-out infinite',
        twinkle: 'twinkle 3s ease-in-out infinite',
        rise: 'rise 14s linear infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
