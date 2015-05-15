var chai = require('chai');
var mock = require('mock-fs');
var fs = require('fs');
var path = require('path');
var TestNode = require('enb/lib/test/mocks/test-node');
var Tech = require('../lib/base_tech');
var FileList = require('enb/lib/file-list');
var sep = require('path').sep;

chai.use(require('chai-spies'));
var expect = chai.expect;

function isolate(fn) {
    return function() {
        return fn();
    };
}

describe('techs', function () {
    describe('base_tech', function () {
        var tech;
        var node;
        var fileList;
        var match = [];
        var origTPostprocessor;
        var origFPPostprocessor;

        beforeEach(function() {
            mock({
                '/blocks': {
                    'xxx.some-tech':  'include yyy.other-tech',
                    'yyy.other-tech': 'include zzz.some-tech',
                    'zzz.some-tech':  'i am the value' // 6c63b05bd556fdcf45463f5f3d0c2095255db930
                },
                '/build': {}
            });

            fileList = new FileList();
            fileList.loadFromDirSync('/blocks');

            tech = new Tech();
            node = new TestNode('build');

            node.provideTechData('?.files', fileList);

            tech.node = node;
            tech._options = {
                source: '?.foo',
                target: '?.bar',
                freezeDir: function(){return '/';},
                freezePathPostprocess: null
            };

            tech.configure();
            tech._grammar = tech.createGrammar();

            match[0] = tech.matchRecursor;
            match[1] = tech.matchFreeze;
            tech.matchRecursor = function(){};
            tech.matchFreeze = function(){};
            origTPostprocessor = tech.postprocessMatchedToken;
            origFPPostprocessor = tech.postprocessFreezePath;
        });

        afterEach(function() {
            mock.restore();

            tech.matchRecursor = match[0];
            tech.matchFreeze = match[1];
            tech.postprocessMatchedToken = origTPostprocessor;
            tech.postprocessFreezePath = origFPPostprocessor;
        });

        describe('#getChecksumOf', function() {
            var digest;
            beforeEach(function() {
                digest = tech._digest;
            });

            afterEach(function() {
                tech._digest = digest;
            });

            it('validate', function() {
                // sha1 hex digest
                expect(tech.getChecksumOf('foo')).equal('0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33');
            });

            it('alphanum digest option', function() {
                tech._digest = 'alphanum';
                expect(tech.getChecksumOf('foo')).equal('rwtvsvvr93tk7s18tqa9');
            });
        });

        describe('#digest', function() {
            it('check sha1 digest', function() {
                var crypto = require('crypto');
                var h = crypto.createHash('sha1');
                h.update('foo');

                expect(tech.digest(h)).equal('0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33');
            });
        });

        describe('#getSuffix', function() {
            it('validate', function() {
                expect(tech.getSuffix('/foo/bar.baz')).equal('baz');
                expect(tech.getSuffix('/foo/bar.das.baz')).equal('das.baz');
            });

            it('no dot, no suffix', function() {
                expect(tech.getSuffix('/foo/bar')).equal('');
            });
        });

        describe('#getFreezeDir', function() {
            it('should call function from options', function() {
                tech._freezeDir = function() { return 'foo'; };

                expect(tech.getFreezeDir()).equal('foo');
            });

            it('should call function from options', function() {
                var spy = chai.spy(function() {return 'foo';});
                tech._freezeDir = spy;

                var res = tech.getFreezeDir();

                expect(res).equal('foo');
                expect(spy).to.have.been.called.exactly(1);
            });

            it('should call function from options', function() {
                tech._freezeDir = function(suffix) {
                    expect(suffix).equal('suffix');
                    return 'foo';
                };

                tech.getFreezeDir('suffix');
            });
        });

        describe('#freeze', function() {
            it('create file system elements', function(done) {
                var resolve = isolate(done);

                tech
                    .freezeContent('zzz.some-tech', 'zzz.some-tech', 'i am the value')
                    .then(function(freezePair) {
                        expect(freezePair[0]).equal('/6c63b05bd556fdcf45463f5f3d0c2095255db930.some-tech');
                        expect(fs.existsSync('/6c63b05bd556fdcf45463f5f3d0c2095255db930.some-tech')).equal(true);
                        resolve();
                    })
                    .fail(done);

            });
        });

        describe('#postprocessMatchedToken', function() {
            it('should return value as is', function() {
                expect(
                    tech.postprocessMatchedValue('', '', '', 'foo', null, 0)
                ).to.be.equal('foo');
            });
        });

        describe('#getFileProcessor', function() {
            it('should return function', function() {
                expect(typeof tech.getFileProcessor()).to.be.equal('function');
            });

            it('should return valid result', function(done) {
                var proc = tech.getFileProcessor('foo', 'bar');

                proc.call(tech, 'some content')
                    .then(function(data) {
                        expect(data).to.be.equal('some content');
                        done();
                    })
                    .fail(done);
            });
        });

        describe('#postprocessFreezePath', function() {
            it('should call fn from options', function() {
                var spy = function() {return 'foo';};
                tech._freezePathPostprocess = spy;
                expect(tech.postprocessFreezePath()).equal('foo');
            });

            it('should skip fn from options if result is nothing', function() {
                var spy = function() {};
                tech._freezePathPostprocess = spy;
                expect(
                    tech.postprocessFreezePath(
                        '/foo/bar/baz.tech', '/foo/jaz/das.tech', '/0x0000.tech'
                    )
                ).equal('0x0000.tech');
            });

            it('should resolve paths from root file correctly', function() {
                tech._freezeDir = function() {return '/freeze';};
                expect(
                    tech.postprocessFreezePath(
                        '/foo/baz.tech', '/foo/baz.tech', '/freeze/0x0000.tech'
                    )
                ).equal('../freeze/0x0000.tech');
            });
        });

        describe('#getFreezablePathsBase', function() {
            it('validate', function() {
                expect(tech.getFreezablePathsBase('/foo/bar')).equal('/foo');
            });
        });

        describe('#replaceMatch', function() {
            it('validate', function() {
                expect(tech.replaceMatch('123 foo', 'foo', 'bar')).equal('123 bar');
            });
        });

        describe('#processToken', function() {
            it('Should process files recursively', function(done) {
                var resolve = isolate(done);

                tech.matchRecursor = function(node) {
                    var m = node.data.match.match(/([a-z-\/\.]+\.[a-z-\.]+)/);
                    if(!m) {
                        return [];
                    } else {
                        return [m[1]];
                    }
                };

                var node = {
                    token: 1,
                    data: {match: 'blocks/xxx.some-tech', length: 20, start: 8, end: 28},
                    content: []
                };
                var res = tech
                    .processToken('/some.file', '/some.file', node, 0);

                res
                    .then(function(freezeStruct) {
                        [
                            '/4fb0a7ff284c4dcae1418e51fa3120cae868af13.other-tech',
                            '/6c63b05bd556fdcf45463f5f3d0c2095255db930.some-tech',
                            '/b942d2b0b48f123fbe19add1ab8b2e15ead28e8a.some-tech'
                        ].forEach(function(p) {
                            expect(fs.existsSync(p)).equal(true);
                        });
                        resolve();
                    })
                    .fail(done);
            });
        });
    });
});
