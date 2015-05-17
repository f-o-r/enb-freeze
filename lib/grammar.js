/**
 * Набор хелперов для парсинга общих для разных грамматик сущностей, например
 * комментариев
 */

var inherit = require('inherit');

var iota = 0;
var TOKENS = {
    T_RAW: ++iota,
    T_BLOCK_COMMENT_START: ++iota,
    T_BLOCK_COMMENT_END: ++iota,
    T_LINE_COMMENT: ++iota,
    T_WHITESPACE: ++iota,
    T_NL: ++iota
};

var CONTAINER_TOKENS = [
    TOKENS.T_BLOCK_COMMENT_START
];

var RECURSIVE_TOKENS = CONTAINER_TOKENS.concat([
    TOKENS.T_BLOCK_COMMENT_END
]);

var ANTIPODE_TOKENS = [
    [TOKENS.T_BLOCK_COMMENT_START, TOKENS.T_BLOCK_COMMENT_END]
];


/**
 * Формат AST:
 AST :: Array[ AST_NODE  :: Object{
     token: AST_NODE_TOKEN :: Number,
     data: AST_DATA      :: MaybeArray[AST, ...] | MaybeString }]
 */

var AST = {
    /**
     * Создаёт узел AST
     * @param {Number} token - Тип узла, как указано в TOKENS
     * @param {Object} data - Match объект, содержащий информацию о найденном совпадении
     * @param {Array} [content] - Содержимое внутри узла
     */
    createNode: function(token, data, content) {
        return {token: token, data: data, content: content || []};
    },

    createMatch: function(str, start, end) {
        var res = {};

        res.match = str;
        res.length = str ? str.length : 0;
        res.start = start;
        res.end = end;
        return res;
    },

    walk: function(ast, fn) {
        return ast.map(function(node) {
            if(node.content.length > 0) {
                return AST.createNode(
                    node.token,
                    node.data,
                    AST.walk(node.content, fn)
                );
            } else {
                return fn(node);
            }
        }, []);
    },

    flatten: function(nestedArr) {
        return nestedArr.reduce(function(acc, node) {
            acc.push(AST.createNode(node.token, node.data, []));
            return acc.concat(node.content.length > 0 ? AST.flatten(node.content) : []);
        }, []);
    },

    fold: function(ast, fn) {
        return ast.reduce(function(acc, node) {
            var _acc = fn(acc, node);
            var _node = _acc[_acc.length - 1];

            if(_node && _node.content.length > 0) {
                return _acc.slice(0, -1).concat([
                    AST.createNode(
                        _node.token,
                        _node.data,
                        AST.fold(_node.content, fn)
                    )
                ]);
            } else {
                return _acc;
            }
        }, []);
    }
};

var helpers = {
    fold: {
        sameSiblings: function(acc, node) {
            var prevNode = acc[acc.length - 1];
            if(prevNode && prevNode.token === node.token) {
                var mergedMatch = prevNode.data.match + node.data.match;
                var mergedNodeData = AST.createMatch(
                    mergedMatch,
                    prevNode.data.start,
                    prevNode.data.start + mergedMatch.length
                );
                return acc.slice(0, -1).concat([
                    AST.createNode(
                        node.token,
                        mergedNodeData,
                        prevNode.content.concat(node.content)
                    )
                ]);
            } else {
                return acc.concat([node]);
            }
        }
    }
};

var tokenMatchers = {
    any: function(symbol, position/*, behind, ahead, end*/) {
        return AST.createMatch(
            symbol,
            position,
            position + symbol.length
        );
    },

    matchStr: function(str) {
        var len = str.length;
        return function(symbol, position, behind, ahead/*, end*/) {
            if(symbol === str[0]) {
                if(len > 1) {
                    if(ahead.slice(0, len).join('') !== str) {
                        return AST.createMatch(false);
                    }
                }

                return AST.createMatch(str, position, position + len);
            }

            return AST.createMatch(false);
        };
    },

    whitespace: function(symbol, position, behind, ahead/*, end*/) {
        var match = ahead.join('').match(/^([\s\t]+)/);
        if(match !== null) {
            return AST.createMatch(
                match[1],
                position,
                position + match[1].length
            );
        } else {
            return AST.createMatch(false);
        }
    },

    linebreak: function(symbol, position/*, behind, ahead, end*/) {
        if(symbol === '\n') {
            return AST.createMatch(
                symbol,
                position,
                position + symbol.length
            );
        } else {
            return AST.createMatch(false);
        }
    }
};

module.exports = {
    Grammar: inherit({
        __constructor: function(params) {
            this._params = params || {
                tokens: [
                    /**
                     * Токены, поддерживаемые парсером
                     * Здесь должен быть как минимум один токен, матчащийся на весь текст
                     * Иначе парсер вернёт пустое AST
                     * Токены проверяются в порядке следования
                     * [Number, 𝑓(symbol :: Char, buf :: Array[String], position :: Number, end :: Number) | Char]
                     */
                    [
                        TOKENS.T_RAW,
                        tokenMatchers.any
                    ]
                ]
            };
        },

        match: function(symbol, position, behind, ahead, end) {
            var t;
            var res;
            for(var i = 0, len = this._params.tokens.length; i < len; i++) {
                t = this._params.tokens[i];
                if(typeof t[1] === 'function') {
                    res = t[1](symbol, position, behind, ahead, end);
                } else {
                    if(t[1].length <= 1) {
                        if(t[1] === symbol) {
                            res = AST.creatematch(symbol, position, position + symbol.length);
                        }
                    } else {
                        var joined = behind.slice(-t[1].length).join('');
                        if(t[1] === joined) {
                            res = AST.createMatch(joined, position, position + joined.length);
                        }
                    }
                }

                if(res.match && res.length) {
                    return {
                        token: t[0],
                        data: res
                    };
                }
            }

            return AST.createMatch(false);
        },

        isRecursive: function(t) {
            return RECURSIVE_TOKENS.indexOf(t) > -1;
        },

        isContainer: function(t) {
            return CONTAINER_TOKENS.indexOf(t) > -1;
        },

        getAntipodeOf: function(t) {
            for(var i = 0, len = ANTIPODE_TOKENS.length; i < len; i++) {
                if(t === ANTIPODE_TOKENS[i][0]) {
                    return ANTIPODE_TOKENS[i][1];
                }

                if(t === ANTIPODE_TOKENS[i][1]) {
                    return ANTIPODE_TOKENS[i][0];
                }
            }

            throw new Error('No known antipode for token ' + String(t));
        },

        isAntipodeOf: function(t, t1) {
            return t === this.getAntipodeOf(t1);
        },

        recursor: function(symbols, parentToken) {
            var symbol;
            var match;
            var res = [];
            var behind;
            var ahead;
            var position = 0;
            var len = symbols.length;
            while(position < len) {
                symbol = symbols[position];

                behind = symbols.slice(0, position);
                ahead = symbols.slice(position);
                match = this.match(symbol, position, behind, ahead, len);
                if(match.match !== false) {
                    position = match.data.end;
                    var node = AST.createNode(match.token, match.data, []);
                    var antipode = typeof parentToken !== 'undefined' && this.isAntipodeOf(match.token, parentToken);
                    if(this.isRecursive(match.token) && this.isContainer(match.token) && !antipode) {
                        var recursiveRes = this.recursor(symbols.slice(position), match.token);
                        position += recursiveRes.position;
                        node.content = recursiveRes.ast;
                    }

                    res.push(node);

                    if(antipode) {
                        break;
                    }
                } else {
                    position++;
                }
            }

            return {ast: res, position: position};
        },

        parse: function(content) {
            return this.recursor(content.split('')).ast;
        }
    }),

    /**
     * Типы токенов в грамматике
     * @type {Object}
     */
    TOKENS: TOKENS,

    /**
     * Хелперы для AST
     * @type {Object}
     */
    AST: AST,

    helpers: helpers,

    tokenMatchers: tokenMatchers
};
