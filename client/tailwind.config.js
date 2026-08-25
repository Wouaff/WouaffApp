/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    screens: {
      mobile: { max: '520px' },
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--brand)',
          dark: 'var(--brand-dark)',
          light: 'var(--brand-light)',
          glow: 'var(--brand-glow)',
        },
        bg: {
          deep: 'var(--bg-deep)',
          base: 'var(--bg-base)',
          card: 'var(--bg-card)',
          input: 'var(--bg-input)',
          hover: 'var(--bg-hover)',
          active: 'var(--bg-active)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        border: {
          DEFAULT: 'var(--border)',
          light: 'var(--border-light)',
        },
        msg: {
          sent: 'var(--msg-sent)',
          'sent-border': 'var(--msg-sent-border)',
          recv: 'var(--msg-recv)',
        },
        online: 'var(--online)',
        offline: 'var(--offline)',
        danger: 'var(--danger)',
        star: 'var(--star)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm: 'var(--radius-sm)',
        msg: 'var(--radius-msg)',
      },
      boxShadow: {
        DEFAULT: 'var(--shadow)',
      },
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
      fontSize: {
        xss: 'var(--text-xs)',
        sms: 'var(--text-sm)',
        bases: 'var(--text-base)',
        md: 'var(--text-md)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        '2xl': 'var(--text-2xl)',
      },
      width: {
        sidebar: 'var(--sidebar-w)',
      },
      height: {
        header: 'var(--header-h)',
        bnav: 'var(--bnav-h)',
      },
      transitionDuration: {
        DEFAULT: '0.2s',
      },
      keyframes: {
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        drawerUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        typingBounce: {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-6px)' },
        },
        skeleton: {
          '0%': { backgroundPosition: '-200px 0' },
          '100%': { backgroundPosition: 'calc(200px + 100%) 0' },
        },
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'slide-up': 'slideUp 0.25s ease',
        'drawer-up': 'drawerUp 0.3s ease',
        'scale-in': 'scaleIn 0.2s ease',
        'fade-in': 'fadeIn 0.2s ease',
        'pulse-slow': 'pulse 2s ease-in-out infinite',
        'typing-bounce': 'typingBounce 1.4s ease-in-out infinite',
        skeleton: 'skeleton 1.4s ease infinite',
        spin: 'spin 0.8s linear infinite',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
