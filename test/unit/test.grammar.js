var expect = require('chai').expect;
var mock = require('mock-fs');
var TestNode = require('enb/lib/test/mocks/test-node');
var FileList = require('enb/lib/file-list');
var sep = require('path').sep;

var helpers = require('../../lib/helpers');
var grammar = require('../../lib/grammar');

// DEBUG
var util = require('util');

describe('lib', function () {
    describe('grammar', function () {

        describe('getAntipodeOf', function() {
            it('should return valid antipode tokens', function() {
                var g = new grammar.Grammar();
                expect(g.getAntipodeOf(grammar.TOKENS.T_BLOCK_COMMENT_START)).to.be.equal(
                    grammar.TOKENS.T_BLOCK_COMMENT_END
                );
            });
        });

        describe('AST', function() {

            describe('createNode', function() {

                it('should return predictable structure', function() {
                    var res = grammar.AST.createNode('foo', 'bar');
                    expect(Object.keys(res)).to.deep.equal(['token', 'data', 'content']);
                });

                it('should correctly fill in values', function() {
                    var res = grammar.AST.createNode('foo', 'bar', ['test', 'me']);
                    expect(res).to.deep.equal({
                        token: 'foo',
                        data: 'bar',
                        content: ['test', 'me']
                    });
                });

            });

            describe('createMatch', function() {

                it('should return predictable structure', function() {
                    var res = grammar.AST.createMatch('foo', 0, 100);
                    expect(Object.keys(res)).to.deep.equal(['match', 'length', 'start', 'end']);
                });

                it('should correctly fill in values', function() {
                    var res = grammar.AST.createMatch('foo', 0, 100);
                    expect(res).to.deep.equal({
                        match: 'foo',
                        length: 3,
                        start: 0,
                        end: 100
                    });
                });

            });

            describe('walk', function() {
                var pasthroughWalker = function(node) {return node;};

                it('should carefuly walk ast', function() {
                    var ast = [grammar.AST.createNode(0, {/*match*/})];

                    expect(grammar.AST.walk(ast, pasthroughWalker)).to.deep.equal(ast);
                });
                it('should carefuly walk nested ast', function() {
                    var ast = [
                        grammar.AST.createNode(0, {/*match*/}, [
                            grammar.AST.createNode(1, {/*match*/}),
                            grammar.AST.createNode(1, {/*match*/})
                        ])
                    ];

                    expect(grammar.AST.walk(ast, pasthroughWalker)).to.deep.equal(ast);
                });
            });

            describe('flatten', function() {
                it('should carefuly flatten nested AST', function() {
                    var recursive = [
                            grammar.AST.createNode(1, {match: 'a', length: 1, start: 1, end: 2}, [
                                grammar.AST.createNode(1, {match: 'b', length: 1, start: 2, end: 3}, [
                                    grammar.AST.createNode(0, {match: 'c', length: 1, start: 3, end: 4})
                                ]),
                                grammar.AST.createNode(1, {match: 'd', length: 1, start: 4, end: 5})
                            ])
                    ];
                    var flat = [
                        grammar.AST.createNode(1, {match: 'a', length: 1, start: 1, end: 2}, []),
                        grammar.AST.createNode(1, {match: 'b', length: 1, start: 2, end: 3}, []),
                        grammar.AST.createNode(0, {match: 'c', length: 1, start: 3, end: 4}, []),
                        grammar.AST.createNode(1, {match: 'd', length: 1, start: 4, end: 5}, []),
                    ];
                    expect(grammar.AST.flatten(recursive)).to.deep.equal(flat);
                });
            });

            describe('fold', function() {
                it('should correctly fold ast tokens with sameSibling rule', function() {
                    var ast = [
                        grammar.AST.createNode(0, {match: 'c', length: 1, start: 0, end: 1}, [
                            grammar.AST.createNode(1, {match: 'a', length: 1, start: 1, end: 2}),
                            grammar.AST.createNode(1, {match: 'b', length: 1, start: 2, end: 3})
                        ])
                    ];

                    var foldedAst = [
                        grammar.AST.createNode(0, {match: 'c', length: 1, start: 0, end: 1}, [
                            grammar.AST.createNode(1, {match: 'ab', length: 2, start: 1, end: 3})
                        ])
                    ];

                    expect(
                        grammar.AST.fold(ast, grammar.helpers.fold.sameSiblings)
                    ).to.deep.equal(foldedAst);
                });
            });

        });

        describe('parser', function() {

            it('should pass grammar to AST comparison tests', function() {
                var parser = new grammar.Grammar();

                expect(parser.parse('123')).to.deep.equal(['1', '2', '3'].map(function(x, index) {
                    return {
                        token: grammar.TOKENS.T_RAW,
                        data: {
                            start: index,
                            end: index + 1,
                            length: 1,
                            match: x
                        },
                        content: []
                    };
                }));

            });

            describe('matchers', function() {
                describe('matchStr', function() {
                    it('should return valid boundaries for match', function() {
                        var res = grammar.tokenMatchers.matchStr('foo')('f', 0, [], ['f', 'o', 'o'], 3);
                        expect(res).to.deep.equal({
                            match: 'foo',
                            length: 3,
                            start: 0,
                            end: 3
                        });
                    });
                });

                describe('any', function() {
                    it('should return valid boundaries for match', function() {
                        var res = grammar.tokenMatchers.any('o', 1, ['f', 'o', 'o'], [], 3);
                        expect(res).to.deep.equal({
                            match: 'o',
                            length: 1,
                            start: 1,
                            end: 2
                        });
                    });
                });

                describe('whitespace', function() {
                    it('should return valid boundaries for match', function() {
                        var spaces = helpers.repeat(' ', 4);
                        var res = grammar.tokenMatchers.whitespace(' ', 0, [], spaces.split().concat(['f', 'o', 'o']), 7);
                        expect(res).to.deep.equal({
                            match: spaces,
                            length: spaces.length,
                            start: 0,
                            end: spaces.length
                        });
                    });
                });
            });

            it('parse containers', function() {
                var m = {
                    cStart: grammar.tokenMatchers.matchStr('<xxx>'),
                    cEnd: grammar.tokenMatchers.matchStr('</xxx>')
                };

                var parser = new grammar.Grammar({
                    tokens: [
                        [grammar.TOKENS.T_BLOCK_COMMENT_START, m.cStart],
                        [grammar.TOKENS.T_BLOCK_COMMENT_END, m.cEnd],
                        [grammar.TOKENS.T_RAW,  grammar.tokenMatchers.any]
                    ]
                });
                expect(parser.parse('foo<xxx>inner</xxx>bar')).to.deep.equal(require('../fixtures/grammar.ast.0001.js'));
            });


            it('parse nested containers', function() {
                var m = {
                    cStart: grammar.tokenMatchers.matchStr('<xxx>'),
                    cEnd: grammar.tokenMatchers.matchStr('</xxx>')
                };

                var parser = new grammar.Grammar({
                    tokens: [
                        [grammar.TOKENS.T_BLOCK_COMMENT_START, m.cStart],
                        [grammar.TOKENS.T_BLOCK_COMMENT_END, m.cEnd],
                        [grammar.TOKENS.T_RAW,  grammar.tokenMatchers.any]
                    ]
                });
                expect(parser.parse('foo<xxx>in<xxx>n</xxx>er</xxx>bar')).to.deep.equal(require('../fixtures/grammar.ast.0002.js'));
            });


            it('parse with whitespaces', function() {
                var m = {
                    cStart: grammar.tokenMatchers.matchStr('<!--'),
                    cEnd: grammar.tokenMatchers.matchStr('-->')
                };

                var parser = new grammar.Grammar({
                    tokens: [
                        [grammar.TOKENS.T_BLOCK_COMMENT_START, m.cStart],
                        [grammar.TOKENS.T_BLOCK_COMMENT_END, m.cEnd],
                        [grammar.TOKENS.T_WHITESPACE, grammar.tokenMatchers.whitespace],
                        [grammar.TOKENS.T_RAW,  grammar.tokenMatchers.any]
                    ]
                });
                expect(parser.parse('foo\n<!-- comment -->\nbar baz')).to.deep.equal(require('../fixtures/grammar.ast.0003.js'));
            });

        });
    });
});
