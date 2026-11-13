/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F3EC",
        card: "#FFFDF8",
        ink: "#14213D",
        muted: "#6B7385",
        line: "#E3DCCF",
        accent: "#E4572E",
        moss: "#2F6F5E",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
