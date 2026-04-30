import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        mist: "#eef3f6",
        panel: "#f8fafb",
        line: "#dbe3e8",
        brand: "#0f766e",
        accent: "#b45309"
      },
      boxShadow: {
        soft: "0 18px 40px rgba(23, 32, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
