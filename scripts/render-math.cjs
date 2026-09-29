'use strict';
/* Build-time TeX → native MathML. No fonts or JS are needed in the published site. */
const fs = require('node:fs');
let mathjax, TeX, SVG, liteAdaptor, RegisterHTMLHandler, AllPackages, SerializedMmlVisitor, STATE;
try {
  ({mathjax} = require('mathjax-full/js/mathjax.js'));
  ({TeX} = require('mathjax-full/js/input/tex.js'));
  ({SVG} = require('mathjax-full/js/output/svg.js'));
  ({liteAdaptor} = require('mathjax-full/js/adaptors/liteAdaptor.js'));
  ({RegisterHTMLHandler} = require('mathjax-full/js/handlers/html.js'));
  ({AllPackages} = require('mathjax-full/js/input/tex/AllPackages.js'));
  ({SerializedMmlVisitor} = require('mathjax-full/js/core/MmlTree/SerializedMmlVisitor.js'));
  ({STATE} = require('mathjax-full/js/core/MathItem.js'));
} catch (error) {
  console.error('缺少构建依赖，请在项目根目录执行 npm install。'); process.exit(1);
}
RegisterHTMLHandler(liteAdaptor());
const tex = new TeX({packages:AllPackages.filter(p => !['autoload','require'].includes(p))});
const doc = mathjax.document('', {InputJax:tex, OutputJax:new SVG({fontCache:'none'})});
const visitor = new SerializedMmlVisitor();
try {
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  const output = input.map(({tex, display}) => {
    const root = doc.convert(tex, {display, end:STATE.COMPILED});
    const mml = visitor.visitTree(root).replace(/\n\s*/g,'');
    if (mml.includes('<merror')) throw new Error(`公式解析失败: ${tex}`);
    return mml;
  });
  process.stdout.write(JSON.stringify(output));
} catch(error) {console.error(error.message); process.exit(1);}
