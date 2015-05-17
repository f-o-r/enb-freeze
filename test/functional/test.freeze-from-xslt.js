var chai = require('chai');
var mock = require('mock-fs');
var fs = require('fs');
var path = require('path');
var TestNode = require('enb/lib/test/mocks/test-node');
var FileList = require('enb/lib/file-list');
var XslTech = require('../../techs/freeze-from-xslt');
var dummyOptions = require('../fixtures/dummy-tech-options');
var expect = chai.expect;
chai.use(require('chai-spies'));

function fixture(name) {
    return fs.readFileSync(path.normalize(__dirname + '/../fixtures/' + name)).toString('utf-8');
}

function fixtures(names) {
    var res = {};
    names.forEach(function(name) {
        res[name] = fixture(name);
    });
    return res;
}

describe('functional', function() {
    describe('techs', function () {
        describe('freeze-from-xslt', function () {
            var xslTech;
            var node;
            var fileList;

            beforeEach(function() {
                fileList = new FileList();
                xslTech = new XslTech();
                node = new TestNode('build');
                node.provideTechData('?.files', fileList);
                xslTech.node = node;
                xslTech._options = dummyOptions;
                xslTech.configure();
                xslTech._grammar = xslTech.createGrammar();
            });

            afterEach(function() {
                mock.restore();
            });

            describe('buildFile', function() {
                it('build xsl fixtures [0001]', function(done) {
                    var fsMock = {
                        'blocks': fixtures([
                            'freeze-from-xslt.0001.orig.xsl',
                            'freeze-from-xslt.0001.orig.ent',
                            'freeze-from-xslt.0001.orig.dummy.xsl'
                        ]),
                        'freeze-from-xslt.0001.orig.css': fixture('freeze-from-xslt.0001.orig.css')
                    };
                    mock.restore();
                    mock(fsMock);

                    var freezePath = path.resolve('./freeze');
                    xslTech._options = {
                        source: '?.foo',
                        target: '?.bar',
                        freezeDir: function() {return freezePath;},
                        freezePathPostprocess: function(parent, carrier, freezePath) {
                            if(this.getSuffix(freezePath).match(/\.(?:css|js)$/)) {
                                return '//example.org/' + path.basename(freezePath);
                            }
                            return false;
                        }
                    };
                    xslTech.configure();

                    var orig = path.resolve('blocks/freeze-from-xslt.0001.orig.xsl');

                    xslTech
                        .buildFile(orig, orig)
                        .then(function(content) {
                            var dummy = fs.readFileSync('freeze/90a8f159f215d46d61e90276f2c8a25e8b79e1ba.0001.orig.dummy.xsl').toString('utf8');
                            var css = fs.readFileSync('freeze/e387954c16dc69e65105add3f7458c20f677e565.0001.orig.css').toString('utf8');
                            var ent = fs.readFileSync('freeze/9f64841aaccdce22e19f52a9a328817740d547ed.0001.orig.ent').toString('utf8');

                            // Turning off FS MOCK to read fixture for comparison
                            mock.restore();

                            expect(content)
                                .to.be.equal(fixture('freeze-from-xslt.0001.freeze.xsl'));
                            expect(dummy)
                                .to.be.equal(fixture('freeze-from-xslt.0001.freeze.dummy.xsl'));
                            expect(css)
                                .to.be.equal(fixture('freeze-from-xslt.0001.freeze.css'));
                            expect(ent)
                                .to.be.equal(fixture('freeze-from-xslt.0001.freeze.ent'));

                            done();
                        })
                        .fail(done);
                });
            });

        });
    });
});
