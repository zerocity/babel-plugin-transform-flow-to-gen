import transformType from './transformType';
import transformFunction from './transformFunction';

export default function(babel) {
  const {types: t} = babel;

  const allParamsAreTyped = path =>
    !!(path.params && path.params.length > 0 && path.params.every(p => !!p.typeAnnotation));

  const walkToScope = path => {
    while (!t.SCOPABLE_TYPES.includes(path.parentPath.type)) {
      path = path.parentPath;
    }

    return path;
  }

  let nameCount = 0;
  const nextName = () => `__FN_EXPRESSION_NAME_${nameCount++}__`;

  return {
    inherits: require(`babel-plugin-syntax-flow`),

    visitor: {
      ImportDeclaration(path) {
        if (path.node.importKind === `type`) {
          // eslint-disable-next-line no-param-reassign
          path.node.importKind = `value`;
        }
      },

      ExportNamedDeclaration(path) {
        if (path.node.exportKind === `type`) {
          const {declaration, specifiers} = path.node;

          path.node.exportKind = `value`;

          if (declaration) {
            const namedExport = {
              type: `ExportNamedDeclaration`,
              specifiers: [t.exportSpecifier(declaration.id, declaration.id)],
              exportKind: `value`,
            };

            path.replaceWithMultiple([declaration, namedExport]);
          }
        }
      },

      TypeAlias(path) {
        const {node} = path;
        const ast = transformType(node.id.name, node.right, node.typeParameters);
        path.replaceWithMultiple(ast);
      },

      FunctionDeclaration(path) {
        if (allParamsAreTyped(path.node)) {
          const name = path.node.id.name;
          const fn = transformFunction(name, path.node.params, path.node.typeParameters);
          const root = walkToScope(path);
          root.insertAfter(fn);
        }
      },

      FunctionExpression(path) {
        if (!allParamsAreTyped(path.node)) {
          return;
        }

        if (t.isVariableDeclarator(path.parentPath)) {
          const {name} = path.parentPath.node.id;
          const fn = transformFunction(name, path.node.params, path.node.typeParameters);
          const root = walkToScope(path);
          root.insertAfter(fn);
        }

        if (t.isReturnStatement(path.parentPath)) {
          path.node.id = path.node.id || t.identifier(nextName());
          const {name} = path.node.id;
          const fn = transformFunction(name, path.node.params, path.node.typeParameters);
          const root = path.parentPath;
          const nodes = [path.node].concat(fn).concat(t.returnStatement(t.identifier(name)));
          root.replaceWithMultiple(nodes);
        }
      },

      ArrowFunctionExpression(path) {
        if (
          allParamsAreTyped(path.node) &&
          path.parentPath.node.id &&
          !t.isCallExpression(path.parentPath)
        ) {
          const name = path.parentPath.node.id.name;
          const fn = transformFunction(name, path.node.params, path.node.typeParameters);
          const root = walkToScope(path);
          root.insertAfter(fn);
        }
      },
    },
  };
}
