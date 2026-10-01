import type { Config } from "tailwindcss";

export default {
  darkMode: "class", // ← importante
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}", // por si usas /app fuera de /src
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.25rem", lg: "2rem", xl: "3rem" },
      screens: { "2xl": "1200px" },
    },
    extend: {
      colors: { cosaif: { gray:"#4B4D4B", green:"#B3D334", blue:"#39A0E0" } },
      boxShadow: { glow: "0 0 40px rgba(57,160,224,.25)" },
      borderRadius: { xl: ".5rem", "2xl": ".5rem", "3xl": ".5rem" },
    },
  },
  plugins: [],
} satisfies Config;
