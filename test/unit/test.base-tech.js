var chai = require('chai');
var TestNode = require('enb/lib/test/mocks/test-node');
var FileList = require('enb/lib/file-list');
var Base = require('../../lib/base-tech');
var mock = require('mock-fs');
var dummyOptions = require('../fixtures/dummy-tech-options');
var expect = chai.expect;
chai.use(require('chai-spies'));

describe('unit', function() {
    describe('techs', function () {
        describe('base-tech', function () {
            var base;
            var node;
            var fileList;
            var matchPostprocessFn;
            var freezePostprocessFn;

            beforeEach(function() {
                base = new Base();
                node = new TestNode('build');
                fileList = new FileList();
                node.provideTechData('?.files', fileList);
                base.node = node;
                base._options = dummyOptions;
                base.configure();
                base._grammar = base.createGrammar();

                matchPostprocessFn = base.postprocessMatchedValue;
                freezePostprocessFn = base.postprocessFreezePath;
            });

            afterEach(function() {
                base.postprocessMatchedValue = matchPostprocessFn;
                base.postprocessFreezePath = freezePostprocessFn;
            });

            describe('getChecksumOf', function() {
                var digest;
                beforeEach(function() {
                    digest = base._digest;
                });

                afterEach(function() {
                    base._digest = digest;
                });

                it('validate', function() {
                    // sha1 hex digest
                    expect(base.getChecksumOf('foo')).equal('0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33');
                });

                it('alphanum digest option', function() {
                    base._digest = 'alphanum';
                    expect(base.getChecksumOf('foo')).equal('rwtvsvvr93tk7s18tqa9');
                });
            });

            describe('readFile', function() {
                beforeEach(function() {
                    mock({'/file': 'dummy content'});
                });
                afterEach(function() {
                    mock.restore();
                });

                it('should successfuly read file content', function(done) {
                    base.readFile('/file', '/file')
                        .then(function(content) {
                            expect(content).to.be.equal('dummy content');
                            done();
                        })
                        .fail(done);
                });

                it('should reject with error if file does not exists', function(done) {
                    base.readFile('parent path', 'non existent path')
                        .then(function() {
                            done(new Error('Waiting for error, got success instead'));
                        })
                        .fail(function(err) {
                            expect(err instanceof Error).to.be.equal(true);
                            done();
                        });
                });
            });

            describe('digest', function() {
                it('check sha1 digest', function() {
                    var crypto = require('crypto');
                    var h = crypto.createHash('sha1');
                    h.update('foo');

                    expect(base.digest(h)).equal('0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33');
                });
            });

            describe('getSuffix', function() {
                it('validate', function() {
                    expect(base.getSuffix('/foo/bar.baz')).equal('baz');
                    expect(base.getSuffix('/foo/bar.das.baz')).equal('das.baz');
                });

                it('no dot, no suffix', function() {
                    expect(base.getSuffix('/foo/bar')).equal('');
                });
            });

            describe('getFreezeDir', function() {
                it('should call function from options', function() {
                    base._freezeDir = function() { return 'foo'; };

                    expect(base.getFreezeDir()).equal('foo');
                });

                it('should call function from options', function() {
                    var spy = chai.spy(function() {return 'foo';});
                    base._freezeDir = spy;

                    var res = base.getFreezeDir();

                    expect(res).equal('foo');
                    expect(spy).to.have.been.called.exactly(1);
                });

                it('should call function from options', function() {
                    base._freezeDir = function(suffix) {
                        expect(suffix).equal('suffix');
                        return 'foo';
                    };

                    base.getFreezeDir('suffix');
                });
            });

            describe('postprocessMatchedValue', function() {
                it('should return value as is', function() {
                    expect(
                        base.postprocessMatchedValue('', '', '', 'foo', null, 0)
                    ).to.be.equal('foo');
                });
            });

            describe('getFileProcessor', function() {
                it('should return function', function() {
                    expect(typeof base.getFileProcessor()).to.be.equal('function');
                });
            });

            describe('postprocessFreezePath', function() {
                it('should call fn from options', function() {
                    var spy = function() {return 'foo';};
                    base._freezePathPostprocess = spy;
                    expect(base.postprocessFreezePath()).equal('foo');
                });

                it('should skip fn from options if result is nothing', function() {
                    var spy = function() {};
                    base._freezePathPostprocess = spy;
                    expect(
                        base.postprocessFreezePath(
                            '/foo/bar/baz.tech', '/foo/jaz/das.tech', '/0x0000.tech'
                        )
                    ).equal('0x0000.tech');
                });

                it('should resolve paths from root file correctly', function() {
                    base._freezeDir = function() {return '/freeze';};
                    expect(
                        base.postprocessFreezePath(
                            '/foo/baz.tech', '/foo/baz.tech', '/freeze/0x0000.tech'
                        )
                    ).equal('../freeze/0x0000.tech');
                });
            });

            describe('getFreezablePathsBase', function() {
                it('validate', function() {
                    expect(base.getFreezablePathsBase('/foo/bar')).equal('/foo');
                });
            });

            describe('replaceMatch', function() {
                it('validate', function() {
                    expect(base.replaceMatch('123 foo', 'foo', 'bar')).equal('123 bar');
                });
            });
        });
    });
});
