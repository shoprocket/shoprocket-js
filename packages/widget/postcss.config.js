import autoprefixer from 'autoprefixer';
import remToPx from './postcss-rem-to-px.js';

export default {
  plugins: [
    autoprefixer(),
    // Convert all rem values to px to prevent scaling issues
    // when host page changes html font-size (like Carrd does)
    remToPx({
      rootValue: 16, // 1rem = 16px
      unitPrecision: 5
    })
  ]
}
