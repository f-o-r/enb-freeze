var expect = require('chai').expect;
var mock = require('mock-fs');
var TestNode = require('enb/lib/test/mocks/test-node');
var XslTech = require('../techs/freeze-from-xslt');
var FileList = require('enb/lib/file-list');
var sep = require('path').sep;
var helpers = require('../lib/helpers');

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

        describe('getFreezablePathsBase', function() {
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
                expect('/foo/bar').to.be.equal(
                    tech.getFreezablePathsBase.call(ctx, '/foo/bar/baz.xsl', 'xsl')
                );
            });

            it('others suffix check', function() {
                expect('/').equal(
                    tech.getFreezablePathsBase.call(ctx, '/foo/bar/baz.xsl', 'css')
                );
            });
        });

        describe('matchers', function() {
            describe('matchRecursor', function() {
                it('match xsl relative', function() {
                    expect(tech.matchRecursor({data: {match: '<xsl:import href="path/to/file.xsl"/>'}})[0])
                        .to.be
                        .equal('path/to/file.xsl');
                });
                it('match xsl absolute', function() {
                    expect(tech.matchRecursor({data: {match: '<xsl:import href="/path/to/file.xsl"/>'}})[0])
                        .to.be
                        .equal('path/to/file.xsl');
                });
                it('match ent relative', function() {
                    expect(tech.matchRecursor({data: {match: '<!DOCTYPE xsl:stylesheet SYSTEM "path/to/file.ent">'}})[0])
                        .to.be
                        .equal('path/to/file.ent');
                });
                it('match ent absolute', function() {
                    expect(tech.matchRecursor({data: {match: '<!DOCTYPE xsl:stylesheet SYSTEM "/path/to/file.ent">'}})[0])
                        .to.be
                        .equal('path/to/file.ent');
                });
                it('not match', function() {
                    expect(tech.matchRecursor({data: {match: '<xsl:import href="path/to/file.ololo"/>'}}))
                        .to.be.equal(null);
                });
            });

            describe('matchFreeze', function() {
                it('match static relative', function() {
                    expect(tech.matchFreeze({data: {match: '<script src="path/to/file.js"/>'}})[0])
                        .to.be
                        .equal('path/to/file.js');
                });
                it('match xsl absolute', function() {
                    expect(tech.matchFreeze({data: {match: '<script src="/path/to/file.js"/>'}})[0])
                        .to.be
                        .equal('path/to/file.js');
                });
                it('do not match schema', function() {
                    expect(tech.matchFreeze({data: {match: '<script src="//path/to/file.js"/>'}}))
                        .to.be.equal(null);
                    expect(tech.matchFreeze({data: {match: '<script src="http://path/to/file.js"/>'}}))
                        .to.be.equal(null);
                    expect(tech.matchFreeze({data: {match: '<script src="https://path/to/file.js"/>'}}))
                        .to.be.equal(null);
                });
                it('not match', function() {
                    expect(tech.matchFreeze({data: {match: '<xsl:import href="path/to/file.ololo"/>'}}))
                        .to.be.equal(null);
                });
            });
        });

        describe('postprocessMatchedValue', function() {
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
                var line = tech.postprocessMatchedValue('/', '/foo.xsl', '/foo.xsl', '/boo.xsl', ['/foo.xsl'], 0);
                expect(line).to.be.equal('/boo.xsl');
            });
        });
    });
});
