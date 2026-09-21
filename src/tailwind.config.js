/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Tajawal", "sans-serif"],
      },
      // الكلاسات دي موجودة في Tailwind v4 بس، والمشروع شغال على v3.
      // مستخدمة 91 مرة في الكود وكانت بتتجاهل تماماً (مفيش ظل ولا blur).
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "2xs": "0 1px 1px 0 rgb(0 0 0 / 0.04)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};