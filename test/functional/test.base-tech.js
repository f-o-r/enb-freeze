var chai = require('chai');
var mock = require('mock-fs');
var fs = require('fs');
var TestNode = require('enb/lib/test/mocks/test-node');
var FileList = require('enb/lib/file-list');
var Base = require('../../lib/base-tech');
var dummyOptions = require('../fixtures/dummy-tech-options');
var expect = chai.expect;
chai.use(require('chai-spies'));

describe('functional', function() {
    describe('techs', function () {
        describe('base-tech', function () {
            var base;
            var node;
            var fileList;
            var matchRecursor;
            var matchFreeze;

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
                base = new Base();
                node = new TestNode('build');
                node.provideTechData('?.files', fileList);
                base.node = node;
                base._options = dummyOptions;
                base.configure();
                base._grammar = base.createGrammar();

                matchRecursor = base.matchRecursor;
                matchFreeze = base.matchFreeze;
                // Empty by default for testing
                base.matchRecursor = function(){};
                base.matchFreeze = function(){};
            });

            afterEach(function() {
                mock.restore();
                base.matchRecursor = matchRecursor;
                base.matchFreeze = matchFreeze;
            });

            describe('getFileProcessor', function() {
                it('should return valid result', function(done) {
                    var proc = base.getFileProcessor('foo', 'bar');

                    proc.call(base, 'some content')
                        .then(function(data) {
                            expect(data).to.be.equal('some content');
                            done();
                        })
                        .fail(done);
                });
            });

            describe('freezeContent', function() {
                it('create file system elements', function(done) {
                    base
                        .freezeContent('zzz.some-tech', 'zzz.some-tech', 'i am the value')
                        .then(function(freezePair) {
                            expect(freezePair[0]).equal('/6c63b05bd556fdcf45463f5f3d0c2095255db930.some-tech');
                            expect(fs.existsSync('/6c63b05bd556fdcf45463f5f3d0c2095255db930.some-tech')).equal(true);
                            done();
                        })
                        .fail(done);
                });
            });

            describe('processNode', function() {
                it('Should process files recursively', function(done) {
                    base.matchRecursor = function(node) {
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
                    var res = base
                            .processNode('/some.file', '/some.file', node, 0);

                    res
                        .then(function(/*freezeStruct*/) {
                            [
                                '/4fb0a7ff284c4dcae1418e51fa3120cae868af13.other-tech',
                                '/6c63b05bd556fdcf45463f5f3d0c2095255db930.some-tech',
                                '/b942d2b0b48f123fbe19add1ab8b2e15ead28e8a.some-tech'
                            ].forEach(function(p) {
                                expect(fs.existsSync(p)).equal(true);
                            });
                            done();
                        })
                        .fail(done);
                });

                it('Should process `matchFreeze` entities correctly', function(done) {
                    base.matchFreeze = function(node) {
                        var m = node.data.match.match(/(.+\.some-tech)$/);
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
                    var res = base
                            .processNode('/some.file', '/some.file', node, 0);

                    res
                        .then(function(/*freezeStruct*/) {
                            [
                                '/18575f166ba6ea3156907f31a46f160aa8419d06.some-tech'
                            ].forEach(function(p) {
                                expect(fs.existsSync(p)).equal(true);
                            });
                            done();
                        })
                        .fail(done);
                });
            });

        });
    });
});
