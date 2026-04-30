/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--bg))",
        card: "hsl(var(--card))",
        'os-bar': "hsl(var(--os-bar))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          glow: "hsla(var(--primary), 0.4)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          glow: "hsla(var(--secondary), 0.4)",
        },
        accent: {
          purple: "hsl(var(--accent))",
          red: "#ff375f",
          blue: "#0a84ff",
        },
        text: {
          primary: "hsl(var(--text-primary))",
          secondary: "hsl(var(--text-secondary))",
        }
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.8)',
        'neon-green': '0 0 15px rgba(0, 255, 159, 0.3)',
        'neon-cyan': '0 0 15px rgba(0, 234, 255, 0.3)',
        'neon-red': '0 0 15px rgba(255, 55, 95, 0.3)',
        'glow-strong': '0 0 30px rgba(0, 255, 159, 0.5)',
      },
      animation: {
        'shimmer': 'shimmer 2s infinite linear',
        'pulse-glow': 'pulse-glow 2s infinite ease-in-out',
        'scan': 'scan 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: 0.6, transform: 'scale(1)' },
          '50%': { opacity: 1, transform: 'scale(1.01)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
    },
  },
  plugins: [],
}
