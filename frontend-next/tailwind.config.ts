import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./context/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#142033",
        sand: "#f3efe5",
        gold: "#b78b33",
        mist: "#e9eef5"
      },
      boxShadow: {
        panel: "0 24px 60px rgba(20, 32, 51, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
