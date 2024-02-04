// tailwind.config.js
module.exports = {
  mode: 'jit',

  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],

  theme: {
    extend: {
      animation: {
        'spin-fast': 'spin-fast 5s linear infinite',
        'spin-slow': 'spin-slow 2s linear infinite',
      },
      keyframes: {
        'spin-fast': {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(60deg)' },
        },
      },
      colors: {
        'primary': '#151225',
        'primary-light': '#19172D',
        'secondary': '#4f46e5',
        'secondary-light': '#606bc7',
        'unique': '#FFCC00',
      },
    },

  },
  variants: {},
  plugins: [],
}
