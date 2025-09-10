// Custom PostCSS plugin to convert rem values to px
// This prevents Carrd's html font-size from affecting our widget

export default function remToPx(options = {}) {
  const rootValue = options.rootValue || 16;
  const unitPrecision = options.unitPrecision || 5;
  
  return {
    postcssPlugin: 'postcss-rem-to-px',
    Declaration(decl) {
      // Check if the declaration value contains rem units
      if (decl.value.includes('rem')) {
        decl.value = decl.value.replace(/(\d*\.?\d+)rem/g, (match, value) => {
          const pixels = parseFloat(value) * rootValue;
          return `${pixels.toFixed(unitPrecision).replace(/\.?0+$/, '')}px`;
        });
      }
    }
  };
}

remToPx.postcss = true;