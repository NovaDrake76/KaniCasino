// tailwind.config.js
module.exports = {
  mode: 'jit',

  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],

  theme: {
    extend: {
      // one ordering for everything that can cover something else. the site has had three
      // separate incidents from picking a number inline: the category bar over the login
      // form, the leaderboard over the category bar, each fix breaking the next thing.
      // put a layer here and use its name; never write a bare z-40 into a component.
      zIndex: {
        raised: '10',   // page content that lifts: a podium, a hovered card, a marker
        sticky: '20',   // pinned to the viewport while the page scrolls under it
        overlay: '40',  // header panels, menus, the login flow
        modal: '60',
        tooltip: '70',  // follows the cursor, so it clears everything
      },

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

        // semantic palette. the raw [#hex] classes already in the codebase
        // still work; prefer these names in new code.
        surface: {
          page: '#141225',      // page / section background
          deep: '#151225',      // deepest surface
          nav: '#19172D',       // navbar, inputs, modal body
          DEFAULT: '#212031',   // cards, panels, list rows
          raised: '#281D3F',    // secondary buttons, chips
          hover: '#3A2C5C',     // raised hover
        },
        line: {
          DEFAULT: '#2A2840',   // hairline borders and dividers
          strong: '#3A365A',
        },
        ink: {
          DEFAULT: '#FFFFFF',   // primary text
          soft: '#C9C6DE',      // secondary text
          muted: '#84819A',     // muted labels, timestamps
          faint: '#625F7E',     // muted icons
        },
        accent: {
          DEFAULT: '#4F46E5',   // indigo, primary action
          light: '#606BC7',
          gold: '#FFCC00',      // winnings, rare highlights
          amber: '#ECA823',
        },
        skeleton: {
          base: '#1C1A31',      // react-loading-skeleton baseColor
          highlight: '#161427', // react-loading-skeleton highlightColor
        },
      },
    },

  },
  variants: {},
  plugins: [],
}
