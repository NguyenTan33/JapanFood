/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Shu-iro (Vermilion Lacquer Red)
        'shu-iro': {
          DEFAULT: '#8B1E1E',
          deep: '#731717',
          light: '#A62828',
          subtle: 'rgba(139, 30, 30, 0.15)',
        },
        shu: {
          50: '#FDF2F2',
          100: '#FDE2E2',
          200: '#FCC7C7',
          300: '#F89E9E',
          400: '#EF6868',
          500: '#DE3B3B',
          600: '#C52727',
          700: '#A82424',
          800: '#8B1E1E',
          900: '#5F1414',
          950: '#380B0B',
        },
        // Sumi-iro (Japanese Charcoal & Ink Obsidian)
        'sumi-iro': {
          DEFAULT: '#121214',
          surface: '#1A1A1E',
          elevated: '#24242A',
          border: '#33333D',
        },
        sumi: {
          50: '#F6F6F7',
          100: '#EAEAEB',
          200: '#D4D4D7',
          300: '#B2B2B8',
          400: '#888892',
          500: '#666670',
          600: '#4B4B54',
          700: '#2D2D34',
          800: '#222227',
          900: '#1A1A1E',
          950: '#121214',
        },
        // Kincha (Gold Leaf, Amber Sake & Brushed Brass)
        'kincha': {
          DEFAULT: '#D4A359',
          light: '#E5C07B',
          dark: '#B0833E',
          glow: 'rgba(212, 163, 89, 0.2)',
        },
        kin: {
          50: '#FAF7EF',
          100: '#F4EED9',
          200: '#E9DBB1',
          300: '#DEC484',
          400: '#E5B86E',
          500: '#D4A359',
          600: '#B9833F',
          700: '#96632E',
          800: '#774B27',
          900: '#5E3A20',
        },
        // Washi (Warm Japanese Rice Paper & Off-White)
        'washi': {
          DEFAULT: '#FAF7F2',
          muted: '#E6E1D8',
          dark: '#8E877C',
          50: '#FFFFFF',
          100: '#FAF7F2',
          200: '#F3EFE6',
          300: '#E8E2D4',
          400: '#D7CFBE',
          500: '#BFB49E',
        },
      },
      fontFamily: {
        serif: ['"Lora"', '"Plus Jakarta Sans"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        kanji: ['"Noto Serif JP"', '"Shippori Mincho"', 'serif'],
      },
      boxShadow: {
        'gold-glow': '0 0 25px -5px rgba(212, 163, 89, 0.25)',
        'shu-glow': '0 0 25px -5px rgba(139, 30, 30, 0.4)',
        'luxury': '0 10px 30px -10px rgba(0, 0, 0, 0.7)',
        'book': '0 15px 35px rgba(0, 0, 0, 0.4), inset 0 0 15px rgba(0, 0, 0, 0.2)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out forwards',
      },
    },
  },
  plugins: [],
}
