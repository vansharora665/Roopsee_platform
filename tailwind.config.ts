import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#1d3f72",
          blue: "#5a79b8",
          coral: "#f06b5f",
          green: "#59c16b",
          sand: "#fbf6ef",
          slate: "#546375"
        }
      },
      boxShadow: {
        panel: "0 20px 45px rgba(29, 63, 114, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
