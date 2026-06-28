import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        swiggy: {
          orange: "#FC8019",
          "orange-dark": "#E5720D",
          "orange-light": "#FFF3E6",
          dark: "#1C1C1C",
          gray: "#686B78",
          "light-gray": "#F2F2F2",
          border: "#E8E8E8",
          green: "#0F8A65",
          "green-light": "#E6F3F0",
          yellow: "#F4A700",
          "yellow-light": "#FFF8E6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
