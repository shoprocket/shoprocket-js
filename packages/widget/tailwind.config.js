/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,html}",
    "./public/**/*.html"
  ],
  // No prefix needed - Shadow DOM provides isolation and we use CSS variables
  theme: {
    extend: {}
  },
  plugins: []
}
