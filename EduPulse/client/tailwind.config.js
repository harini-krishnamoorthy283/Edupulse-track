/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'] },
      colors: {
        navy: { 50: '#f3f6fc', 100: '#e3eaf7', 200: '#c3d1ee', 300: '#94acdf', 400: '#5f82cb', 500: '#3a5fb3', 600: '#274a96', 700: '#1d3a78', 800: '#152c5c', 900: '#0e2148', 950: '#081431' },
        iris: { 50: '#f6f4ff', 100: '#ece8ff', 200: '#dad2ff', 300: '#bfb1fb', 400: '#a28ff5', 500: '#8870ec', 600: '#7554dc', 700: '#6140bf' },
      },
      keyframes: {
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-14px)' } },
        blob: { '0%,100%': { transform: 'translate(0,0) scale(1)' }, '33%': { transform: 'translate(30px,-40px) scale(1.1)' }, '66%': { transform: 'translate(-24px,24px) scale(.95)' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-6px)' }, '40%,80%': { transform: 'translateX(6px)' } },
        fadeUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        ring: { '0%': { transform: 'scale(.9)', opacity: 0.6 }, '100%': { transform: 'scale(1.6)', opacity: 0 } },
      },
      animation: { float: 'float 6s ease-in-out infinite', 'float-slow': 'float 9s ease-in-out infinite', blob: 'blob 14s ease-in-out infinite', shake: 'shake .4s', 'fade-up': 'fadeUp .6s ease both', ring: 'ring 2s ease-out infinite' },
      boxShadow: { card: '0 1px 2px rgba(14,33,72,.04), 0 4px 16px -6px rgba(14,33,72,.08)', pop: '0 12px 40px -8px rgba(14,33,72,.25)' },
    },
  },
  plugins: [],
};
