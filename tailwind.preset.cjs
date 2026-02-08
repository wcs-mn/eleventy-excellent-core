/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      screens: {
        // Required by core styles
        navigation: "1024px",

        // Existing core breakpoint
        ltsm: { max: "639px" }
      }
    }
  }
};