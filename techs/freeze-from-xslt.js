"use strict";

var path = require('path');

var vow = require('enb/node_modules/vow');
var vowFs = require('enb/node_modules/vow-fs');

var T_NL = '\n';

module.exports = require('../lib/base_tech').buildFlow()
    .name('freeze-from-xslt')
    .defineOption('recursorRegex', /["']([^"']+\.xsl)["']/) // Матчит импорт xsl файлов и обрабатывает их рекурсивно
    .defineOption('freezeRegex',   /["']([^"']+\.(css|js|png|jp?g|gif))["']/) // Матчит штуки, которые можно зафризить
    .methods({
        // Пути к статике в xsl начинаются от корня проекта, поддержим это
        getFreezablePathsBase: function(carrier, suffix) {
            if(suffix === 'xsl') {
                // Импорты внутри xsl(смотри recursorRegex) относительные
                return path.dirname(carrier);
            } else {
                // Другие технологии имеют импорты от корня проекта
                return this.node.getRootDir();
            }
        },

        matchRecursor: function(line) {
            var match = this._recursorRegex.exec(line);
            if(match == null) {
                return null;
            }

            return [match[1].replace(/^\//, '')];
        },

        matchFreeze: function(line) {
            var match = this._freezeRegex.exec(line);
            if(match == null) {
                return null;
            }

            var exMatch = match[1];
            if(exMatch.indexOf('//') === 0 || exMatch.indexOf('http://') === 0 || exMatch.indexOf('https://') === 0) {
                return null;
            }

            return [exMatch.replace(/^\//, '')];
        },

        postprocessMatchedLine: function(parent, carrier, oldLine, newLine, match, index) {
            if(!this._debug) {
                return newLine;
            }

            var indent = newLine.match(/^(\s+)/);
            if(indent) {
                indent = indent[1];
            } else {
                indent = '';
            }
            return [
                indent + '<!-- ' + this.getName() + ' ' + match.join() + ' -->',
                newLine
            ].join(T_NL);
        }
    })
    .createTech();