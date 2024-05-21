'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var invariant = _interopDefault(require('invariant'));
var Parser = _interopDefault(require('stylus/lib/parser.js'));

function repeatString(str, num) {
  return num > 0 ? str.repeat(num) : '';
}

function nodesToJSON(nodes) {
  return nodes.map(function (node) {
    return Object.assign({
      // default in case not in node
      nodes: []
    }, node.toJSON());
  });
}

function trimFirst(str) {
  return str.replace(/(^\s*)/g, '');
}

function replaceFirstATSymbol(str) {
  var temp = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '$';

  return str.replace(/^\$|/, temp);
}

function getCharLength(str, char) {
  return str.split(char).length - 1;
}

function _get(obj, pathArray, defaultValue) {
  if (obj == null) return defaultValue;

  var value = obj;

  pathArray = [].concat(pathArray);

  for (var i = 0; i < pathArray.length; i += 1) {
    var key = pathArray[i];
    value = value[key];
    if (value == null) {
      return defaultValue;
    }
  }

  return value;
}

var quote = '\'';
var callName = '';
var oldLineno = 1;
var paramsLength = 0;
var returnSymbol = '';
var indentationLevel = 0;
var OBJECT_KEY_LIST = [];
var FUNCTION_PARAMS = [];
var PROPERTY_LIST = [];
var VARIABLE_NAME_LIST = [];
var GLOBAL_MIXIN_NAME_LIST = [];
var GLOBAL_VARIABLE_NAME_LIST = [];
var CONSTANTS = {};
var MIXINS = {};
var usePaths = {};

var lastPropertyLineno = 0;
var lastPropertyLength = 0;

var isCall = false;
var isCond = false;
var isNegate = false;
var isObject = false;
var isFunction = false;
var isProperty = false;
var isNamespace = false;
var isKeyframes = false;
var isArguments = false;
var isExpression = false;
var isCallParams = false;
var isIfExpression = false;

var isBlock = false;
var ifLength = 0;
var binOpLength = 0;
var identLength = 0;
var selectorLength = 0;
var nodesIndex = 0;
var nodesLength = 0;

var autoprefixer = true;

var OPEARTION_MAP = {
  '&&': 'and',
  '!': 'not',
  '||': 'or'
};

var KEYFRAMES_LIST = ['@-webkit-keyframes ', '@-moz-keyframes ', '@-ms-keyframes ', '@-o-keyframes ', '@keyframes '];

var TYPE_VISITOR_MAP = {
  If: visitIf,
  Null: visitNull,
  Each: visitEach,
  RGBA: visitRGBA,
  Unit: visitUnit,
  Call: visitCall,
  Block: visitBlock,
  BinOp: visitBinOp,
  Ident: visitIdent,
  Group: visitGroup,
  Query: visitQuery,
  Media: visitMedia,
  Import: visitImport,
  Atrule: visitAtrule,
  Extend: visitExtend,
  Member: visitMember,
  Return: visitReturn,
  'Object': visitObject,
  'String': visitString,
  Feature: visitFeature,
  Ternary: visitTernary,
  UnaryOp: visitUnaryOp,
  Literal: visitLiteral,
  Charset: visitCharset,
  Params: visitArguments,
  'Comment': visitComment,
  Property: visitProperty,
  'Boolean': visitBoolean,
  Selector: visitSelector,
  Supports: visitSupports,
  'Function': visitFunction,
  Arguments: visitArguments,
  Keyframes: visitKeyframes,
  QueryList: visitQueryList,
  Namespace: visitNamespace,
  Expression: visitExpression
};

function handleLineno(lineno) {
  return repeatString('\n', lineno - oldLineno);
}

function trimFnSemicolon(res) {
  return res.replace(/\);/g, ')');
}

function trimSemicolon(res) {
  var symbol = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

  return res.replace(/;/g, '') + symbol;
}

function isCallMixin() {
  return !ifLength && !isProperty && !isObject && !isNamespace && !isKeyframes && !isArguments && !identLength && !isCond && !isCallParams && !returnSymbol;
}

function isFunctinCallMixin(node) {
  if (node.__type === 'Call') {
    return node.block.scope || GLOBAL_MIXIN_NAME_LIST.indexOf(node.name) > -1;
  } else {
    return node.__type === 'If' && isFunctionMixin(node.block.nodes);
  }
}

function hasPropertyOrGroup(node) {
  return node.__type === 'Property' || node.__type === 'Group' || node.__type === 'Atrule' || node.__type === 'Media';
}

function isFunctionMixin(nodes) {
  invariant(nodes, 'Missing nodes param');
  var jsonNodes = nodesToJSON(nodes);
  return jsonNodes.some(function (node) {
    return hasPropertyOrGroup(node) || isFunctinCallMixin(node);
  });
}

function getIndentation() {
  return repeatString(' ', indentationLevel * 2);
}

function handleLinenoAndIndentation(_ref) {
  var lineno = _ref.lineno;

  return handleLineno(lineno) + getIndentation();
}

function findNodesType(list, type) {
  var nodes = nodesToJSON(list);
  return nodes.find(function (node) {
    return node.__type === type;
  });
}

function visitNode(node) {
  if (!node) return '';
  if (!node.nodes) {
    // guarantee to be an array
    node.nodes = [];
  }
  var json = node.__type ? node : node.toJSON && node.toJSON();
  var handler = TYPE_VISITOR_MAP[json.__type];
  debugger;
  return handler ? handler(node) : '';
}

function recursiveSearchName(data, property, name) {
  return data[property] ? recursiveSearchName(data[property], property, name) : data[name];
}

// 处理 nodes
function visitNodes() {
  var list = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

  var text = '';
  var nodes = nodesToJSON(list);
  nodesLength = nodes.length;
  nodes.forEach(function (node, i) {
    nodesIndex = i;
    if (node.__type === 'Comment') {
      var isInlineComment = nodes[i - 1] && nodes[i - 1].lineno === node.lineno;
      text += visitComment(node, isInlineComment);
    } else {
      text += visitNode(node);
    }
  });
  nodesIndex = 0;
  nodesLength = 0;
  return text;
}

function visitNull() {
  return null;
}

// 处理 import；handler import
function visitImport(node) {
  invariant(node, 'Missing node param');
  var before = handleLineno(node.lineno) + '@import ';
  oldLineno = node.lineno;
  var quote = '';
  var text = '';
  var nodes = nodesToJSON(node.path.nodes || []);
  nodes.forEach(function (node) {
    text += node.val;
    if (!quote && node.quote) quote = node.quote;
  });
  var result = text.replace(/\.styl$/g, '.scss');
  return '' + before + quote + result + quote + ';';
}

function visitSelector(node) {
  selectorLength++;
  invariant(node, 'Missing node param');
  var nodes = nodesToJSON(node.segments);
  var endNode = nodes[nodes.length - 1];
  var before = '';
  if (endNode.lineno) {
    before = handleLineno(endNode.lineno);
    oldLineno = endNode.lineno;
  }
  before += getIndentation();
  var segmentText = visitNodes(node.segments);
  selectorLength--;
  return before + segmentText;
}

function visitGroup(node) {
  invariant(node, 'Missing node param');
  var before = handleLinenoAndIndentation(node);
  oldLineno = node.lineno;
  var nodes = nodesToJSON(node.nodes);
  var selector = '';
  nodes.forEach(function (node, idx) {
    var temp = visitNode(node);
    var result = /^\n/.test(temp) ? temp : temp.replace(/^\s*/, '');
    selector += idx ? ', ' + result : result;
  });
  var block = visitBlock(node.block);
  if (isKeyframes && /-|\*|\+|\/|\$/.test(selector)) {
    var len = getCharLength(selector, ' ') - 2;
    return '\n' + repeatString(' ', len) + '#{' + trimFirst(selector) + '}' + block;
  }
  return selector + block;
}

function visitBlock(node) {
  isBlock = true;
  invariant(node, 'Missing node param');
  indentationLevel++;
  var before = ' {';
  var after = '\n' + repeatString(' ', (indentationLevel - 1) * 2) + '}';
  var text = visitNodes(node.nodes);
  var result = text;
  if (isFunction && !/@return/.test(text)) {
    result = '';
    var symbol = repeatString(' ', indentationLevel * 2);
    if (!/\n/.test(text)) {
      result += '\n';
      oldLineno++;
    }
    if (!/\s/.test(text)) result += symbol;
    result += returnSymbol + text;
  }
  if (!/^\n\s*/.test(result)) result = '\n' + repeatString(' ', indentationLevel * 2) + result;
  indentationLevel--;
  isBlock = false;
  return '' + before + result + after;
}

function visitLiteral(node) {
  invariant(node, 'Missing node param');
  return node.val || '';
}

function visitProperty(node) {
  var expr = node.expr,
      lineno = node.lineno,
      segments = node.segments;

  var suffix = ';';
  var before = handleLinenoAndIndentation({ lineno: lineno });
  oldLineno = lineno;
  isProperty = true;
  var segmentsText = visitNodes(segments);

  lastPropertyLineno = lineno;
  // segmentsText length plus semicolon and space
  lastPropertyLength = segmentsText.length + 2;
  if (_get(expr, ['nodes', 'length']) === 1) {
    var expNode = expr.nodes[0];
    var ident = expNode.toJSON && expNode.toJSON() || {};
    if (ident.__type === 'Ident') {
      var identVal = _get(ident, ['val', 'toJSON']) && ident.val.toJSON() || {};
      if (identVal.__type === 'Expression') {
        var beforeExpText = before + trimFirst(visitExpression(expr));
        var _expText = '' + before + segmentsText + ': $' + ident.name + ';';
        isProperty = false;
        PROPERTY_LIST.unshift({ prop: segmentsText, value: '$' + ident.name });
        return beforeExpText + _expText;
      }
    }
  }
  var expText = visitExpression(expr);
  PROPERTY_LIST.unshift({ prop: segmentsText, value: expText });
  isProperty = false;

  // This is the "absolute" mixin from nib; replace with appropriate position attributes.
  if (segmentsText === 'absolute') {
    var transformed = before + 'position: absolute;';
    var lastProperty = undefined;
    var handleProperty = function handleProperty(val) {
      if (lastProperty) {
        before = handleLinenoAndIndentation(node);
        oldLineno = node.lineno;
        transformed += '\n' + before + lastProperty + ': ' + val + ';';
        lastProperty = undefined;
      }
    };

    var KNOWN_PROPERTIES = ['top', 'right', 'bottom', 'left'];

    var nodes = nodesToJSON(expr.nodes);
    nodes.forEach(function (node) {
      var nodeText = visitNode(node);
      if (KNOWN_PROPERTIES.includes(nodeText)) {
        handleProperty(0); // Set previous value to 0, if one has been found already
        lastProperty = nodeText;
      } else {
        handleProperty(nodeText);
      }
    });

    handleProperty(0);

    return transformed;
  }

  return (/\/\//.test(expText) ? before + segmentsText.replace(/^$/, '') + ': ' + expText : trimSemicolon(before + segmentsText.replace(/^$/, '') + ': ' + (expText + suffix), ';')
  );
}

function visitIdent(_ref2) {
  var val = _ref2.val,
      name = _ref2.name,
      rest = _ref2.rest,
      mixin = _ref2.mixin,
      property = _ref2.property;

  identLength++;
  var identVal = val && val.toJSON() || '';

  if (CONSTANTS[name]) {
    usePaths[CONSTANTS[name].use] = CONSTANTS[name].alias;
    return CONSTANTS[name].alias + '.' + name;
  }

  if (identVal.__type === 'Null' || !val) {
    if (isExpression) {
      if (property || isCall) {
        var propertyVal = PROPERTY_LIST.find(function (item) {
          return item.prop === name;
        });
        if (propertyVal) {
          identLength--;
          return propertyVal.value;
        }
      }
    }
    if (selectorLength && isExpression && !binOpLength) {
      identLength--;
      return '#{' + name + '}';
    }
    if (mixin) {
      identLength--;
      return name === 'block' ? '@content;' : '#{$' + name + '}';
    }
    var nameText = VARIABLE_NAME_LIST.indexOf(name) > -1 || GLOBAL_VARIABLE_NAME_LIST.indexOf(name) > -1 ? replaceFirstATSymbol(name) : name;
    if (FUNCTION_PARAMS.indexOf(name) > -1) nameText = replaceFirstATSymbol(nameText);
    identLength--;
    return rest ? nameText + '...' : nameText;
  }
  if (identVal.__type === 'Expression') {
    if (findNodesType(identVal.nodes, 'Object')) OBJECT_KEY_LIST.push(name);
    var before = handleLinenoAndIndentation(identVal);
    oldLineno = identVal.lineno;
    var nodes = nodesToJSON(identVal.nodes || []);
    var expText = '';
    nodes.forEach(function (node, idx) {
      expText += idx ? ' ' + visitNode(node) : visitNode(node);
    });
    VARIABLE_NAME_LIST.push(name);
    identLength--;
    return '' + before + replaceFirstATSymbol(name) + ': ' + trimFnSemicolon(expText) + ';';
  }
  if (identVal.__type === 'Function') {
    identLength--;
    return visitFunction(identVal);
  }
  var identText = visitNode(identVal);
  identLength--;
  return replaceFirstATSymbol(name) + ': ' + identText + ';';
}

function visitExpression(node) {
  invariant(node, 'Missing node param');
  isExpression = true;
  var nodes = nodesToJSON(node.nodes);
  var comments = [];
  var subLineno = 0;
  var result = '';
  var before = '';

  if (nodes.every(function (node) {
    return node.__type !== 'Expression';
  })) {
    subLineno = nodes.map(function (node) {
      return node.lineno;
    }).sort(function (curr, next) {
      return next - curr;
    })[0];
  }

  var space = '';
  if (subLineno > node.lineno) {
    before = handleLineno(subLineno);
    oldLineno = subLineno;
    if (subLineno > lastPropertyLineno) space = repeatString(' ', lastPropertyLength);
  } else {
    before = handleLineno(node.lineno);
    var callNode = nodes.find(function (node) {
      return node.__type === 'Call';
    });
    if (callNode && !isObject && !isCallMixin()) space = repeatString(' ', lastPropertyLength);
    oldLineno = node.lineno;
  }

  nodes.forEach(function (node, idx) {
    // handle inline comment
    if (node.__type === 'Comment') {
      comments.push(node);
    } else {
      var nodeText = visitNode(node);
      var _symbol = isProperty && node.nodes.length ? ',' : '';
      result += idx ? _symbol + ' ' + nodeText : nodeText;
    }
  });

  var commentText = comments.map(function (node) {
    return visitNode(node);
  }).join(' ');
  commentText = commentText.replace(/^ +/, ' ');

  isExpression = false;

  if (isProperty && /\);/g.test(result)) result = trimFnSemicolon(result) + ';';
  if (commentText) result = result + ';' + commentText;
  if (isCall || binOpLength) {
    if (callName === 'url') return result.replace(/\s/g, '');
    return result;
  }

  if (!returnSymbol || isIfExpression) {
    return before && space ? trimSemicolon(before + getIndentation() + space + result, ';') : result;
  }
  var symbol = '';
  if (nodesIndex + 1 === nodesLength) symbol = returnSymbol;
  return before + getIndentation() + symbol + result;
}

function visitCall(_ref3) {
  var name = _ref3.name,
      args = _ref3.args,
      lineno = _ref3.lineno,
      block = _ref3.block;

  isCall = true;
  callName = name;
  var blockText = '';
  var before = handleLineno(lineno);
  oldLineno = lineno;
  if (MIXINS[callName]) {
    before = before || '\n';
    before += getIndentation();
    before += '@include ';
    before += MIXINS[callName].alias + '.';

    usePaths[MIXINS[callName].use] = MIXINS[callName].alias;
  } else if (isCallMixin() || block || selectorLength || GLOBAL_MIXIN_NAME_LIST.indexOf(callName) > -1) {
    before = before || '\n';
    before += getIndentation();
    before += '@include ';
  }
  var argsText = visitArguments(args).replace(/;/g, '');
  isCallParams = false;
  if (block) blockText = visitBlock(block);
  callName = '';
  isCall = false;
  return before + name + '(' + argsText + ')' + blockText + ';';
}

function visitArguments(node) {
  invariant(node, 'Missing node param');
  isArguments = true;
  var nodes = nodesToJSON(node.nodes);
  paramsLength += nodes.length;
  var text = '';
  nodes.forEach(function (node, idx) {
    var prefix = idx ? ', ' : '';
    var nodeText = visitNode(node);
    if (node.__type === 'Call') isCallParams = true;
    if (GLOBAL_VARIABLE_NAME_LIST.indexOf(nodeText) > -1) nodeText = replaceFirstATSymbol(nodeText);
    if (isFunction && !/(^'|")|\d/.test(nodeText) && nodeText) nodeText = replaceFirstATSymbol(nodeText);
    text += prefix + nodeText;
    paramsLength--;
  });
  if (paramsLength === 0) isArguments = false;
  return text || '';
}

function visitRGBA(node) {
  return node.raw.replace(/ /g, '');
}

function visitUnit(_ref4) {
  var val = _ref4.val,
      type = _ref4.type;

  return type ? val + type : val;
}

function visitBoolean(node) {
  return node.val;
}

function visitIf(node) {
  var symbol = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '@if ';

  ifLength++;
  invariant(node, 'Missing node param');
  var before = '';
  isIfExpression = true;
  if (symbol === '@if ') {
    before += handleLinenoAndIndentation(node);
    oldLineno = node.lineno;
  }

  var condNode = node.cond && node.cond.toJSON() || {};
  isCond = true;
  isNegate = node.negate;
  var condText = trimSemicolon(visitNode(condNode));
  isCond = false;
  isNegate = false;
  isIfExpression = false;
  var block = visitBlock(node.block);
  var elseText = '';
  if (node.elses && node.elses.length) {
    var elses = nodesToJSON(node.elses);
    elses.forEach(function (node) {
      oldLineno++;
      if (node.__type === 'If') {
        elseText += visitIf(node, ' @else if ');
      } else {
        elseText += ' @else' + visitBlock(node);
      }
    });
  }
  ifLength--;
  return before + symbol + condText + block + elseText;
}

function visitFunction(node) {
  invariant(node, 'Missing node param');
  isFunction = true;
  var notMixin = !isFunctionMixin(node.block.nodes);
  var before = handleLineno(node.lineno);
  oldLineno = node.lineno;
  var symbol = '';
  if (notMixin) {
    returnSymbol = '@return ';
    symbol = '@function';
  } else {
    returnSymbol = '';
    symbol = '@mixin';
  }
  var params = nodesToJSON(node.params.nodes || []);
  FUNCTION_PARAMS = params.map(function (par) {
    return par.name;
  });
  var paramsText = '';
  params.forEach(function (node, idx) {
    var prefix = idx ? ', ' : '';
    var nodeText = visitNode(node);
    VARIABLE_NAME_LIST.push(nodeText);
    paramsText += prefix + replaceFirstATSymbol(nodeText);
  });
  paramsText = paramsText.replace(/\$ +\$/g, '$');
  var fnName = symbol + ' ' + node.name + '(' + trimSemicolon(paramsText) + ')';
  var block = visitBlock(node.block);
  returnSymbol = '';
  isFunction = false;
  FUNCTION_PARAMS = [];
  return before + fnName + block;
}

function visitTernary(_ref5) {
  var cond = _ref5.cond,
      lineno = _ref5.lineno;

  var before = handleLineno(lineno);
  oldLineno = lineno;
  return before + visitBinOp(cond);
}

function findOccurrences(str, subStr) {
  var substrings = [];
  var startIndex = 0;
  var pos = str.indexOf(subStr);

  while (pos !== -1) {
    substrings.push(str.slice(startIndex, pos));
    startIndex = pos + subStr.length;
    pos = str.indexOf(subStr, pos + subStr.length);
  }

  substrings.push(str.slice(startIndex));

  return {
    count: substrings.length - 1,
    substrings: substrings
  };
}
function visitBinOp(_ref6) {
  var op = _ref6.op,
      left = _ref6.left,
      right = _ref6.right;

  binOpLength++;

  // MJ: Convert calc syntax to sass syntax
  if (op === '%' && typeof left.val === 'string' && left.val.startsWith('calc(')) {
    var substitutions = findOccurrences(left.val, '%s');
    var _rightExp = right ? right.toJSON() : {};

    if (substitutions.count === 0) {
      throw new Error('No substitution values found, unsure what to do.');
    } else if (substitutions.count === 1) {
      var value = '(' + visitNode(_rightExp) + ')';
      binOpLength--;
      return substitutions.substrings[0] + value + substitutions.substrings[1];
    } else {
      if (_rightExp.__type !== 'Expression') {
        throw new Error('Expected right to be expression: ' + JSON.stringify({ op: op, left: left, right: right }));
      }
      if (_rightExp.nodes.length !== substitutions.count) {
        throw new Error('Encountered calc with wrong number of arguments: ' + JSON.stringify({ op: op, left: left, right: right }));
      }

      var values = _rightExp.nodes.map(function (node) {
        return '(' + visitNode(node) + ')';
      });

      var ret = substitutions.substrings[0];
      values.forEach(function (value, i) {
        ret += value + substitutions.substrings[i + 1];
      });

      binOpLength--;
      return ret;
    }
  }

  function visitNegate(op) {
    if (!isNegate || op !== '==' && op !== '!=') {
      return op !== 'is defined' ? op : '';
    }
    return op === '==' ? '!=' : '==';
  }

  if (op === '[]') {
    var leftText = visitNode(left);
    var rightText = visitNode(right);
    binOpLength--;
    if (isBlock) return 'map-get(' + leftText + ', ' + rightText + ');';
  }

  var leftExp = left ? left.toJSON() : '';
  var rightExp = right ? right.toJSON() : '';
  var isExp = rightExp.__type === 'Expression';
  var expText = isExp ? '(' + visitNode(rightExp) + ')' : visitNode(rightExp);
  var symbol = OPEARTION_MAP[op] || visitNegate(op);
  var endSymbol = op === 'is defined' ? '!default;' : '';

  binOpLength--;

  return endSymbol ? trimSemicolon(visitNode(leftExp)).trim() + ' ' + endSymbol : visitNode(leftExp) + ' ' + symbol + ' ' + expText;
}

function visitUnaryOp(_ref7) {
  var op = _ref7.op,
      expr = _ref7.expr;

  return (OPEARTION_MAP[op] || op) + '(' + visitExpression(expr) + ')';
}

function visitEach(node) {
  invariant(node, 'Missing node param');
  var before = handleLineno(node.lineno);
  oldLineno = node.lineno;
  var expr = node.expr && node.expr.toJSON();
  var exprNodes = nodesToJSON(expr.nodes);
  var exprText = '@each $' + node.val + ' in ';
  VARIABLE_NAME_LIST.push(node.val);
  exprNodes.forEach(function (node, idx) {
    var prefix = node.__type === 'Ident' ? '$' : '';
    var exp = prefix + visitNode(node);
    exprText += idx ? ', ' + exp : exp;
  });
  if (/\.\./.test(exprText)) {
    exprText = exprText.replace('@each', '@for').replace('..', 'through').replace('in', 'from');
  }
  var blank = getIndentation();
  before += blank;
  var block = visitBlock(node.block, blank).replace('$' + node.key, '');
  return before + exprText + block;
}

function visitKeyframes(node) {
  isKeyframes = true;
  var before = handleLinenoAndIndentation(node);
  oldLineno = node.lineno;
  var resultText = '';
  var name = visitNodes(node.segments);
  var isMixin = !!findNodesType(node.segments, 'Expression');
  var blockJson = node.block.toJSON();
  if (blockJson.nodes.length && blockJson.nodes[0].toJSON().__type === 'Expression') {
    throw new Error('Syntax Error Please check if your @keyframes ' + name + ' are correct.');
  }
  var block = visitBlock(node.block);
  var text = isMixin ? '#{' + name + '}' + block : name + block;
  if (autoprefixer) {
    KEYFRAMES_LIST.forEach(function (name) {
      resultText += before + name + text;
    });
  } else {
    resultText += before + '@keyframes ' + text;
  }
  isKeyframes = false;
  return resultText;
}

function visitExtend(node) {
  var before = handleLinenoAndIndentation(node);
  oldLineno = node.lineno;
  var text = visitNodes(node.selectors);
  return before + '@extend ' + trimFirst(text) + ';';
}

function visitQueryList(node) {
  var text = '';
  var nodes = nodesToJSON(node.nodes);
  nodes.forEach(function (node, idx) {
    var nodeText = visitNode(node);
    text += idx ? ', ' + nodeText : nodeText;
  });
  return text;
}

function visitQuery(node) {
  var type = visitNode(node.type) || '';
  var nodes = nodesToJSON(node.nodes);
  var text = '';
  nodes.forEach(function (node, idx) {
    var nodeText = visitNode(node);
    text += idx ? ' and ' + nodeText : nodeText;
  });
  return type === 'screen' ? type + ' and ' + text : '' + type + text;
}

function visitMedia(node) {
  var before = handleLinenoAndIndentation(node);
  oldLineno = node.lineno;
  var val = _get(node, ['val'], {});
  var nodeVal = val.toJSON && val.toJSON() || {};
  var valText = visitNode(nodeVal);
  var block = visitBlock(node.block);
  return before + '@media ' + (valText + block);
}

function visitFeature(node) {
  var segmentsText = visitNodes(node.segments);
  var expText = visitExpression(node.expr);
  return '(' + segmentsText + ': ' + expText + ')';
}

function visitComment(node, isInlineComment) {
  var before = isInlineComment ? ' ' : handleLinenoAndIndentation(node);
  var matchs = node.str.match(/\n/g);
  oldLineno = node.lineno;
  if (Array.isArray(matchs)) oldLineno += matchs.length;
  var text = node.suppress ? node.str : node.str.replace(/^\/\*/, '/*!');
  return before + text;
}

function visitMember(_ref8) {
  var left = _ref8.left,
      right = _ref8.right;

  var searchName = recursiveSearchName(left, 'left', 'name');
  if (searchName && OBJECT_KEY_LIST.indexOf(searchName) > -1) {
    return 'map-get(' + visitNode(left) + ', ' + (quote + visitNode(right) + quote) + ')';
  }
  return visitNode(left) + '.' + visitNode(right);
}

function visitAtrule(node) {
  var before = handleLinenoAndIndentation(node);
  oldLineno = node.lineno;
  before += '@' + node.type;
  return before + visitBlock(node.block);
}

function visitObject(_ref9) {
  var vals = _ref9.vals,
      lineno = _ref9.lineno;

  isObject = true;
  indentationLevel++;
  var before = repeatString(' ', indentationLevel * 2);
  var result = '';
  var count = 0;
  for (var key in vals) {
    var resultVal = visitNode(vals[key]).replace(/;/, '');
    var symbol = count ? ',' : '';
    result += symbol + '\n' + (before + quote + key + quote) + ': ' + resultVal;
    count++;
  }
  var totalLineno = lineno + count + 2;
  oldLineno = totalLineno > oldLineno ? totalLineno : oldLineno;
  indentationLevel--;
  isObject = false;
  return '(' + result + '\n' + repeatString(' ', indentationLevel * 2) + ')';
}

function visitCharset(_ref10) {
  var _ref10$val = _ref10.val,
      value = _ref10$val.val,
      quote = _ref10$val.quote,
      lineno = _ref10.lineno;

  var before = handleLineno(lineno);
  oldLineno = lineno;
  return before + '@charset ' + (quote + value + quote) + ';';
}

function visitNamespace(_ref11) {
  var val = _ref11.val,
      lineno = _ref11.lineno;

  isNamespace = true;
  var name = '@namespace ';
  var before = handleLineno(lineno);
  oldLineno = lineno;
  if (val.type === 'string') {
    var _val$val = val.val,
        value = _val$val.val,
        valQuote = _val$val.quote;

    isNamespace = false;
    return before + name + valQuote + value + valQuote + ';';
  }
  return before + name + visitNode(val);
}

function visitAtrule(_ref12) {
  var type = _ref12.type,
      block = _ref12.block,
      lineno = _ref12.lineno,
      segments = _ref12.segments;

  var before = handleLineno(lineno);
  oldLineno = lineno;
  var typeText = segments.length ? '@' + type + ' ' : '@' + type;
  return '' + (before + typeText + visitNodes(segments) + visitBlock(block));
}

function visitSupports(_ref13) {
  var block = _ref13.block,
      lineno = _ref13.lineno,
      condition = _ref13.condition;

  var before = handleLineno(lineno);
  oldLineno = lineno;
  before += getIndentation();
  return before + '@Supports ' + (visitNode(condition) + visitBlock(block));
}

function visitString(_ref14) {
  var val = _ref14.val,
      quote = _ref14.quote;

  return quote + val + quote;
}

function visitReturn(node) {
  if (isFunction) return visitExpression(node.expr).replace(/\n\s*/g, '');
  return '@return $' + visitExpression(node.expr).replace(/\$|\n\s*/g, '');
}

// 处理 stylus 语法树；handle stylus Syntax Tree
function visitor(ast, options, globalVariableList, globalMixinList) {
  quote = options.quote;
  autoprefixer = options.autoprefixer;
  GLOBAL_MIXIN_NAME_LIST = globalMixinList;
  GLOBAL_VARIABLE_NAME_LIST = globalVariableList;
  CONSTANTS = options.constants;
  MIXINS = options.mixins;
  var result = visitNodes(ast.nodes) || '';
  var indentation = ' '.repeat(options.indentVueStyleBlock);
  result = result.replace(/(.*\S.*)/g, indentation + '$1');
  result = result.replace(/(.*)>>>(.*)/g, '$1/deep/$2');
  oldLineno = 1;
  FUNCTION_PARAMS = [];
  OBJECT_KEY_LIST = [];
  PROPERTY_LIST = [];
  VARIABLE_NAME_LIST = [];
  GLOBAL_MIXIN_NAME_LIST = [];
  GLOBAL_VARIABLE_NAME_LIST = [];

  var isFirstUse = true;
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = Object.keys(usePaths)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var entry = _step.value;

      var toAdd = '@use \'' + entry + '\' as ' + usePaths[entry] + ';\n';
      if (isFirstUse) {
        toAdd += '\n';
      }
      result = toAdd + result;
      isFirstUse = false;
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  usePaths = {};

  return result + '\n';
}

function parse(result) {
  return new Parser(result).parse();
}

function nodeToJSON(data) {
  return nodesToJSON(data);
}

function _get$1(obj, pathArray, defaultValue) {
  return _get(obj, pathArray, defaultValue);
}

function converter(result) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {
    quote: '\'',
    conver: 'sass',
    autoprefixer: true
  };
  var globalVariableList = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  var globalMixinList = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];

  if (options.isSignComment) result = result.replace(/\/\/\s(.*)/g, '/* !#sign#! $1 */');

  // Add semicolons to properties with inline comments to ensure that they are parsed correctly
  result = result.replace(/^( *)(\S(.+?))( *)(\/\*.*\*\/)$/gm, '$1$2;$4$5');

  if (typeof result !== 'string') return result;
  var ast = new Parser(result).parse();
  // 开发时查看 ast 对象。
  // console.log(JSON.stringify(ast))
  var text = visitor(ast, options, globalVariableList, globalMixinList);
  // Convert special multiline comments to single-line comments
  return text.replace(/\/\*\s!#sign#!\s(.*)\s\*\//g, '// $1');
}

exports.parse = parse;
exports.nodeToJSON = nodeToJSON;
exports._get = _get$1;
exports.converter = converter;
