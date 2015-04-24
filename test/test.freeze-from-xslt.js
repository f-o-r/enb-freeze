require('chai').should();

var expect = require('chai').expect;
var mock = require('mock-fs');
var TestNode = require('enb/lib/test/mocks/test-node');
var XslTech = require('../techs/freeze-from-xslt');
var FileList = require('enb/lib/file-list');
var sep = require('path').sep;

function repeat(s, n) {
    var res = '';
    for(var i = 0; i < n; i++) {
        res += s;
    }
    return res;
}

describe('repeat helper', function() {
    it('valid', function() {
        repeat(' ', 5).should.equal('     ');
        repeat('1', 1).should.equal('1');
    });
});

describe('techs', function () {
    describe('freeze-from-xslt', function () {
        var tech;
        var node;
        beforeEach(function() {
            tech = new XslTech();
            node = new TestNode('build');
            node.provideTechData('?.files', []);

            tech.node = node;
            tech._options = {
                source: '?.xsl',
                target: '_?.xsl',
                freezeDir: function(){}
            };

            tech.configure();
        });

        describe('#getFreezablePathsBase', function() {
            var ctx;
            beforeEach(function() {
                ctx = {
                    node: {
                        getRootDir: function() {
                            return '/';
                        }
                    }
                };
            });

            it('xsl suffix check', function() {
                '/foo/bar'.should.equal(
                    tech.getFreezablePathsBase.call(ctx, '/foo/bar/baz.xsl', 'xsl')
                );
            });

            it('others suffix check', function() {
                '/'.should.equal(
                    tech.getFreezablePathsBase.call(ctx, '/foo/bar/baz.xsl', 'css')
                );
            });
        });

        describe('matchers', function() {
            describe('#matchRecursor', function() {
                it('match xsl relative', function() {
                    tech.matchRecursor('<xsl:import href="path/to/file.xsl"/>')[0]
                        .should
                        .equal('path/to/file.xsl');
                });
                it('match xsl absolute', function() {
                    tech.matchRecursor('<xsl:import href="/path/to/file.xsl"/>')[0]
                        .should
                        .equal('path/to/file.xsl');
                });
                it('match ent relative', function() {
                    tech.matchRecursor('<!DOCTYPE xsl:stylesheet SYSTEM "path/to/file.ent">')[0]
                        .should
                        .equal('path/to/file.ent');
                });
                it('match ent absolute', function() {
                    tech.matchRecursor('<!DOCTYPE xsl:stylesheet SYSTEM "/path/to/file.ent">')[0]
                        .should
                        .equal('path/to/file.ent');
                });
                it('not match', function() {
                    expect(tech.matchRecursor('<xsl:import href="path/to/file.ololo"/>'))
                        .to.be.equal(null);
                });
            });

            describe('#matchFreeze', function() {
                it('match static relative', function() {
                    tech.matchFreeze('<script src="path/to/file.js"/>')[0]
                        .should
                        .equal('path/to/file.js');
                });
                it('match xsl absolute', function() {
                    tech.matchFreeze('<script src="/path/to/file.js"/>')[0]
                        .should
                        .equal('path/to/file.js');
                });
                it('do not match schema', function() {
                    expect(tech.matchFreeze('<script src="//path/to/file.js"/>'))
                        .to.be.equal(null);
                    expect(tech.matchFreeze('<script src="http://path/to/file.js"/>'))
                        .to.be.equal(null);
                    expect(tech.matchFreeze('<script src="https://path/to/file.js"/>'))
                        .to.be.equal(null);
                });
                it('not match', function() {
                    expect(tech.matchFreeze('<xsl:import href="path/to/file.ololo"/>'))
                        .to.be.equal(null);
                });
            });
        });

        describe('#postprocessMatchedLine', function() {
            var debug;
            beforeEach(function() {
                debug = tech._debug;
                tech._debug = true;
            });

            afterEach(function() {
                tech._debug = debug;
            });

            it('should not alter line', function() {
                tech._debug = false;
                var line = tech.postprocessMatchedLine('/', '/foo.xsl', '/foo.xsl', '/boo.xsl', ['/foo.xsl'], 0);
                line.should.equal('/boo.xsl');
            });

            it('valid comment indentation', function() {
                tech._debug = true;
                var indent = repeat(' ', 16);
                var twoLines = tech.postprocessMatchedLine('/', '/foo.xsl', '/foo.xsl', indent + '/boo.xsl', ['/foo.xsl'], 0);
                twoLines.split('\n')[1].should.equal(indent + '/boo.xsl');
            });
        });
    });
});
