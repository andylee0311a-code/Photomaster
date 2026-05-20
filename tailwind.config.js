/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // 👈 這行非常重要，代表掃描 src 內的所有 React 元件
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}