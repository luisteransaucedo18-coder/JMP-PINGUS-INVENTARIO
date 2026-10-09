import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
// Use Vite's CSS parser rather than introducing another project dependency.
const require = createRequire(import.meta.resolve('vite'));
const postcss = require('postcss');
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]);
const sources = files('src');
const conflictMarkers = [];
for (const file of [...sources, ...files('tests'), ...files('scripts'), ...files('supabase/migrations')]) {
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
    if (/^(?:<{7}|={7}|>{7})(?:\s|$)/.test(line)) conflictMarkers.push({ file, line: index + 1 });
  });
}
const exactRules = new Map(), selectorRules = new Map(), literals = new Map();
const repeatedDeclarations = [], emptyFiles = [];
const definedClasses = new Set(), usedClasses = new Set();
for (const file of sources) {
  const text = readFileSync(file, 'utf8');
  if (!text.trim()) emptyFiles.push(file);
  if (file.endsWith('.css')) {
    postcss.parse(text, { from: file }).walkRules(rule => {
      const context = [];
      for (let parent = rule.parent; parent; parent = parent.parent) if (parent.type === 'atrule') context.unshift(`@${parent.name} ${parent.params}`);
      const selector = rule.selector.replace(/\s+/g, ' ').trim();
      for (const match of selector.matchAll(/\.([A-Za-z_][\w-]*)/g)) definedClasses.add(match[1]);
      const declarations = (rule.nodes || []).filter(node => node.type === 'decl');
      const key = JSON.stringify([file, context, selector]);
      const exact = JSON.stringify([key, declarations.map(d => [d.prop, d.value, d.important])]);
      const location = { file, line: rule.source.start.line, selector, context };
      exactRules.set(exact, [...(exactRules.get(exact) || []), location]);
      selectorRules.set(key, [...(selectorRules.get(key) || []), location]);
      const seen = new Set();
      for (const d of declarations) {
        const identity = JSON.stringify([d.prop, d.value, d.important]);
        if (seen.has(identity)) repeatedDeclarations.push({ ...location, property: d.prop, value: d.value });
        seen.add(identity);
      }
    });
  }
  if (/\.tsx?$/.test(file)) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const visit = node => {
      if (ts.isJsxAttribute(node) && node.name.getText(source) === 'className' && node.initializer) {
        const collect = child => {
          if (ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child) || child.kind === ts.SyntaxKind.TemplateHead || child.kind === ts.SyntaxKind.TemplateMiddle || child.kind === ts.SyntaxKind.TemplateTail) {
            for (const token of child.text.split(/\s+/)) if (/^[A-Za-z_][\w-]*$/.test(token)) usedClasses.add(token);
          }
          ts.forEachChild(child, collect);
        };
        collect(node.initializer);
      }
      if (ts.isVariableDeclaration(node) && node.initializer && (ts.isObjectLiteralExpression(node.initializer) || ts.isArrayLiteralExpression(node.initializer))) {
        const value = node.initializer.getText(source).replace(/\s+/g, ' ').trim();
        if (value.length > 100) literals.set(value, [...(literals.get(value) || []), { file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, name: node.name.getText(source) }]);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}
const duplicates = map => [...map.values()].filter(locations => locations.length > 1);
const report = {
  filesScanned: sources.length,
  conflictMarkers,
  exactDuplicateCssRules: duplicates(exactRules),
  repeatedCssSelectors: duplicates(selectorRules),
  repeatedDeclarations,
  repeatedLiteralCandidates: duplicates(literals),
  emptyFiles,
  unreferencedCssClassCandidates: [...definedClasses].filter(name => !usedClasses.has(name)).sort(),
  note: 'Repeated selectors can be intentional cascade rules. Classes can be constructed dynamically or added outside JSX, so unreferenced classes are candidates, not proven dead code. No automatic deletion or data deduplication is performed.',
};
mkdirSync('test-results/auditoria', { recursive: true });
writeFileSync('test-results/auditoria/consistencia.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, repeatedCssSelectors: report.repeatedCssSelectors.length }, null, 2));
if (conflictMarkers.length) process.exitCode = 1;
