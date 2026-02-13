/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Couleurs de thème dynamiques (référencent les CSS vars)
        theme: {
          primary: 'var(--color-primary)',
          secondary: 'var(--color-secondary)',
          bg: {
            primary: 'var(--bg-primary)',
            secondary: 'var(--bg-secondary)',
            tertiary: 'var(--bg-tertiary)',
          },
          text: {
            primary: 'var(--text-primary)',
            secondary: 'var(--text-secondary)',
            muted: 'var(--text-muted)',
          },
          border: {
            primary: 'var(--border-primary)',
            accent: 'var(--border-accent)',
          }
        }
      },
      transitionProperty: {
        'theme': 'background-color, color, border-color',
      }
    },
  },
  plugins: [],
}
