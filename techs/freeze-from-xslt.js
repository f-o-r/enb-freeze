"use strict";

var path = require('path');

module.exports = require('../lib/base-tech').buildFlow()
    .name('freeze-from-xslt')
    .defineOption('recursorRegex', /["']([^"']+\.(xsl|ent))["']/) // Матчит импорт xsl файлов и обрабатывает их рекурсивно
    .defineOption('freezeRegex',   /["']([^"']+\.(css|js|png|jp?g|gif))["']/) // Матчит штуки, которые можно зафризить
    .defineOption('blockComments', ['<!--', '-->'])
    .methods({
        // Пути к статике в xsl начинаются от корня проекта, поддержим это
        getFreezablePathsBase: function(carrier, suffix) {
            if(suffix.match(/xsl$/) || suffix.match(/ent$/)) {
                // Импорты внутри xsl(смотри recursorRegex) относительные
                return path.dirname(carrier);
            } else {
                // Другие технологии имеют импорты от корня проекта
                return this.node.getRootDir();
            }
        },

        matchRecursor: function(node) {
            var match = this._recursorRegex.exec(node.data.match);
            if(!match) {
                return null;
            }

            return [match[1]];
        },

        matchFreeze: function(node) {
            var match = this._freezeRegex.exec(node.data.match);
            if(!match) {
                return null;
            }

            var exMatch = match[1];
            if(exMatch.indexOf('//') === 0 || exMatch.indexOf('http://') === 0 || exMatch.indexOf('https://') === 0) {
                return null;
            }

            return [exMatch];
        }
    })
    .createTech();
