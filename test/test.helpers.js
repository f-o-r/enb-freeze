var expect = require('chai').expect;
var mock = require('mock-fs');
var TestNode = require('enb/lib/test/mocks/test-node');
var FileList = require('enb/lib/file-list');
var sep = require('path').sep;

var helpers = require('../lib/helpers');

describe('lib', function () {
    describe('helpers', function () {

        describe('zip', function() {
            it('should just zip arrays', function() {
                expect(helpers.zip([1, 2], ['a', 'b'])).to.deep.equal([[1, 'a'], [2, 'b']]);
                expect(helpers.zip([1, 2], ['a', 'b', 'c'])).to.deep.equal([[1, 'a'], [2, 'b']]);
                expect(helpers.zip([1, 2, 3, 4], ['a'])).to.deep.equal([[1, 'a']]);
                expect(helpers.zip([], [])).to.deep.equal([]);
            });
        });

        describe('wantImplementationOf', function() {
            it('throws an error', function() {
                var thrower = helpers.wantImplementationOf('test');
                expect(thrower).to.throw('You should implement test method');
            });
        });

        describe('justJoin', function() {
            it('should just join array of strings', function() {
                expect('ab').equal(helpers.justJoin(['a', 'b']));
                expect('abc').equal(helpers.justJoin(['a', 'b', 'c']));
            });
        });

        describe('justJoinNL', function() {
            it('should just delimit array of strings', function() {
                expect('a\nb').equal(helpers.justJoinNL(['a', 'b']));
                expect('a\nb\nc').equal(helpers.justJoinNL(['a', 'b', 'c']));
            });
        });

        describe('isAbsolute', function() {
            it('valid', function() {
                expect(helpers.isAbsolute('/')).to.be.equal(true);
                expect(helpers.isAbsolute('/foo')).to.be.equal(true);
                expect(helpers.isAbsolute('foo')).to.be.equal(false);
            });
        });


        describe('repeat', function() {
            it('valid', function() {
                expect(helpers.repeat(' ', 5)).to.be.equal('     ');
                expect(helpers.repeat('1', 1)).to.be.equal('1');
            });
        });

    });
});
