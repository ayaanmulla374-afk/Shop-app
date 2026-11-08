module.exports = {
  important: '#invoice',
  corePlugins: { preflight: false },
  content: ['./dist/index.html'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(51 58% 95%)',
        foreground: 'hsl(221 47% 12%)',
        primary: 'hsl(216 85% 20%)',
        accent: 'hsl(51 100% 59%)',
        'invoice-paper': 'hsl(51 58% 95%)',
        'header-yellow': 'hsl(51 100% 59%)',
        'table-header': 'hsl(51 100% 62%)',
        'charges-strip': 'hsl(50 100% 75%)',
        'navy-banner': 'hsl(216 85% 20%)',
        'navy-banner-foreground': 'hsl(51 58% 95%)',
        'table-body': 'hsl(49 52% 96%)',
        border: 'hsl(221 47% 12%)'
      },
      fontFamily: {
        body: ['Roboto Condensed', 'Arial', 'sans-serif'],
        display: ['Roboto Condensed', 'Arial', 'sans-serif'],
        accent: ['Courgette', 'cursive'],
        script: ['Dancing Script', 'cursive']
      }
    }
  }
};
