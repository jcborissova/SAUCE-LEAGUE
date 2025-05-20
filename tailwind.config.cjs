// tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            animation: {
              fadeIn: "fadeIn 0.2s ease-out",
            },
            keyframes: {
              fadeIn: {
                "0%": { opacity: 0, transform: "scale(0.95)" },
                "100%": { opacity: 1, transform: "scale(1)" },
              },
            },
          },
    },
    plugins: [],
  };
  