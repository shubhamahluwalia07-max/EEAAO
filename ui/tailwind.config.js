/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        origin: {
          alabaster: '#F8FAFC',
          zinc: '#D4D4D8',
          slate: '#0F172A',
          obsidian: '#0F172A',
          blue: '#0284C7',
          blueHover: '#0369A1',
          viewportBg: '#080C14',
          viewportBorder: '#27272A',
          overlayText: '#E2E8F0',
          crosshairAxial: '#38BDF8',
          crosshairCoronal: '#34D399',
          crosshairSagittal: '#F472B6',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'rubber-idle': '2px 3px 6px rgba(15, 23, 42, 0.08), -1px -1px 4px rgba(255, 255, 255, 0.8)',
        'rubber-hover': '4px 6px 12px rgba(15, 23, 42, 0.12), -2px -2px 6px rgba(255, 255, 255, 0.9)',
        'rubber-active': 'inset 2px 3px 6px rgba(15, 23, 42, 0.22), inset -2px -2px 5px rgba(255, 255, 255, 0.85)',
        'rubber-selected': 'inset 1px 2px 4px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(2, 132, 199, 0.25)',
      }
    },
  },
  plugins: [],
}
