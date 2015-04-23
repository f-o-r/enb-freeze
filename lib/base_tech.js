"use strict";

var crypto = require('crypto');
var path = require('path');

var vow = require('enb/node_modules/vow');
var vowFs = require('enb/node_modules/vow-fs');

var digest = require('./digest');

var T_NL = '\n';
var T_QUOTE = '"';

function waitForSourcesAnd(cb) {
    return function() {
        var _this = this;
        var builderArgs = arguments;

        var requireSources = function() {
            return _this.node.requireSources(_this._waitForTargets).then(function() {
                return cb.apply(_this, builderArgs);
            });
        };

        if(Object.keys(this._waitForNodeTargets).length > 0) {
            return this.node.requireNodeSources(this._waitForNodeTargets).then(requireSources);
        } else {
            return requireSources();
        }
    };
}

function wantImplementationOf(nameToImplement) {
    return function() {
        throw new Error('You should implement ' + nameToImplement + ' method');
    };
}

function justJoin(arr) {
    return arr.join('');
}

function justJoinNL(arr) {
    return arr.join(T_NL);
}

function isAbsolute(p) {
    return p.indexOf('/') === 0;
}

module.exports = require('enb/lib/build-flow').create()
    .name('freeze-base')

    .defineRequiredOption('target')
    .defineRequiredOption('source')
    .defineRequiredOption('freezeDir')
    .defineOption('freezePathPostprocess', null)

    .defineOption('hash', 'sha1')
    .defineOption('digest', 'hex')
    .defineOption('encoding', 'utf-8')
    .defineOption('waitForTargets', [])
    .defineOption('waitForNodeTargets', {})
    .defineOption('debug', true)

    .target('target', '?.target')
    .useSourceFilename('source')

    .builder(
        waitForSourcesAnd(
            function(source) {
                return this.buildFile(null, source);
            }
        )
    )
    .methods({
        /**
         * Matcher для рекурсивной обработки файлов
         * Имеет приоритет перед `matchFreeze`
         * @param {String} line - Строка из обрабатываемого файла
         * @returns {null|undefined|[String]} - Совпадения в виде массива относительных(по отношению к файлу-носителю) путей
         */
        matchRecursor: wantImplementationOf('matchRecursor'),

        /**
         * Matcher для обработки include'ов, которые могут быть зафрижены
         * Для этого типа include'ов ожидается, что файл, на который указывает include был уже сбилжен
         * т.е. в случае css, например, мы ожидаем, что вся статика из include'а уже прошла процедуру фриза
         * технологией, которая знает как фризить ресурсы внутри css,
         * и нужно будет зафризить этот файл as is.
         * @param {String} line - Строка из обрабатываемого файла
         * @returns {null|undefined|[String]} - Совпадения в виде массива относительных(по отношению к файлу-носителю) путей
         */
        matchFreeze: wantImplementationOf('matchFreeze'),

        /**
         * Считает контрольную сумму содержимого файла
         * @param {String} content - Содержимое файла
         * @returns {String} Контрольная сумма от содержимого файла
         */
        getChecksumOf: function(content) {
            var hash = crypto.createHash(this._hash);
            hash.update(content);
            return this.digest(hash);
        },

        /**
         * Вызывает функцию цифровой подписи на основе опции `digest`
         * @param {Object} hash - Объект hash, полученный с помощью `require('crypto').createHash(algo)`
         * @returns {String} Цифровая подпись числовой последовательности
         */
        digest: function(hash) {
            return digest[this._digest](hash);
        },

        /**
         * берёт суффикс от указанного пути
         * @returns {String} /foo/bar/bz.xx.cc.vv -> xx.cc.vv
         */
        getSuffix: function(fullname) {
            return fullname.split(path.sep).pop().split('.').slice(1).join('.');
        },

        /**
         * Получает фризовую папку для указаного суффикса
         * @param {String} suffix - Суффикс замораживаемого файла
         * @returns {String} Абсолютный путь к фризовой папке
         */
        getFreezeDir: function(suffix) {
            return this._freezeDir(suffix);
        },

        /**
         * Фризит контент файла внутрь фризовой папки(указывается в параметрах технологии)
         * @param {String} parent - Родитель фризового файла
         * @param {String} carrier - Абсолютный путь к файлу-носителю, которому принадлежит content
         * @param {String} content - Содержимое файла
         * @returns {Promise -> [String, String]} [Путь к фризовому файлу, Контент фризового файла]
         */
        freeze: function(parent, carrier, content) {
            var hash = this.getChecksumOf(content);
            var suffix = this.getSuffix(carrier);
            var freezeDir = this.getFreezeDir(suffix);

            if(!freezeDir) {
                throw new Error('Freeze directory was not specified for ' + suffix);
            }

            if(!isAbsolute(freezeDir)) {
                throw new Error('Freeze directory should be absolute path, got ' + freezeDir);
            }

            return vowFs.makeDir(freezeDir).then(function() {
                var fullpath = path.join(freezeDir, hash + '.' + suffix);
                return vowFs.write(
                    fullpath,
                    content,
                    this._encoding
                ).then(function() {
                    return [fullpath, content];
                });
            }, this);
        },

        /**
         * Фризит контент файла внутрь фризовой папки(указывается в параметрах технологии)
         * @param {String} parent - Родитель фризового файла
         * @param {String} fullpath - Путь к файлу, который следует зафризить
         * @returns {Promise -> [String, String]} [Путь к фризовому файлу, Контент фризового файла]
         */
        freezeFile: function(parent, fullpath) {
            return vowFs
                .read(fullpath, this._encoding)
                .then(function(content) {
                    return this.freeze(parent, fullpath, content);
                }, this);
        },

        /**
         * Вызывается после фриза
         * Сперва ищет пользовательскую функцию `freezePathPostprocess` из параметров, если её нет, то
         * вернёт путь к фризовому файлу относительно файла-носителя
         * @param {String} parent - Абсолютный путь к файлу-родителю, которому принадлежит content
         * @param {String} carrier - Абсолютный путь к файлу-носителю, которому принадлежит content
         * @param {String} freezePath - Абсолютный фризовый путь к файлу
         * @returns {String} Путь, который будет записан в инклюд/импорт ...
         */
        postprocessFreezePath: function(parent, carrier, freezePath) {
            if(this._freezePathPostprocess) {
                var res = this._freezePathPostprocess(parent, carrier, freezePath);
                if(res) {
                    return res;
                }
            }

            return path.relative(
                (
                    parent === carrier
                    // support keeping first file in place
                        ? path.resolve(path.dirname(carrier))
                        : this.getFreezeDir(this.getSuffix(freezePath))
                ),
                freezePath
            );
        },

        /**
         * Определяет "отправную точку" для резолюции путей функцией `resolveFreezable`
         * Сделана отдельным методом чтобы можно было удобно переопределять её на уровне конкретных технологий
         * @param {String} carrier - Абсолютный путь к файлу-носителю, которому принадлежит content
         * @param {String} suffix - Суффикс замораживаемого файла
         * @returns {String} Абсолютный путь к базовой директории, относительно которой будут резолвиться
         * пути к исходным файлам для фриза
         */
        getFreezablePathsBase: function(carrier, suffix) {
            return path.dirname(carrier);
        },

        /**
         * Определяет абсолютный путь к файлу для последующего фриза
         * @param {String} carrier - Абсолютный путь к файлу-носителю, которому принадлежит content
         * @param {String} tail - Хвост пути, обычно похож на `foo/bar.css`, `/foo/bar.css` или `../../foo/bar.css`
         * Лидирующий слеш будет удалён из пути
         * @returns {String} Абсолютный путь к файлу для фриза
         */
        resolveFreezable: function(carrier, tail) {
            return path.resolve(this.getFreezablePathsBase(carrier, this.getSuffix(tail)), tail);
        },

        /**
         * Заменяет сматчившийся путь на фризовый
         * @param {String} input - Исходная строка
         * @param {String} oldValue - Старый путь
         * @param {String} newValue - Новый,фризовый путь
         * @returns {String} Строка с фризовым путём
         */
        replaceMatch: function(input, oldValue, newValue) {
            // var original = match.input.split('');
            // var left = original.slice(0, match.index);
            // var right = original.slice(match.index + match[0].length);

            // var quote = this.getQuoteSymbol();
            // var res = left.join('') + quote + newValue + quote + right.join('');

            return input.replace(oldValue, newValue);
        },

        /**
         * Обрабатывает строку в исходном файле и вызывает постпроцесс на совпадениях
         * @param {String|null} parent - Абсолютный путь к файлу-родителю(он связан с чилдом через инклюд или импорт)
         * @param {String} carrier - Абсолютный путь к файлу, носителю обрабатываемой строки
         * @param {String} line - Строка из обрабатываемого файла
         * @returns {Promise -> {line, freezePairsList}} Результат выполнения
         * Если для строки нет необходимости в какой-либо обработке, то она возвращается as is.
         * Если для строки нашелся обработчик то можно вернуть промис либо обработанную строку.
         */
        processLine: function(parent, carrier, line, index) {
            var matchRecursor = this.matchRecursor(line);
            var matchFreeze =  this.matchFreeze(line);
            var match = (matchRecursor || []).concat(matchFreeze || []);

            if(match.length > 0) {
                return this.recursor(parent, carrier, line, match);
            } else {
                return {line: line, freezePairsList: [], match: match};
            }
        },

        /**
         * Выполняет постпроцессинг каждой изменённой строки
         * Удобно применять для разметки коммментариями и т.д.
         * @param {String|null} parent - Абсолютный путь к файлу-родителю(он связан с чилдом через инклюд или импорт)
         * @param {String} carrier - Абсолютный путь к файлу-носителю, которому принадлежит content
         * @param {String} oldLine - Старое значение строки
         * @param {String} newLine - Текущее, новое значение с фризовым путём
         * @param {Array} match - Сматченные пути
         * @param {Number} index - Индекс строки в файле
         * @returns {Promise -> String|String} Изменённая строка для записи в файл
         */
        postprocessMatchedLine: function(parent, carrier, oldLine, newLine, match, index) {
            return newLine;
        },

        /**
         * Обрабатывает все recursive(инклюды файла в одной технологии) сущности из файла
         * @param {String|null} parent - Абсолютный путь к файлу-родителю(он связан с чилдом через инклюд или импорт)
         * @param {String} carrier - Абсолютный путь к файлу-носителю, которому принадлежит content
         * @param {String} line - Значение сматченной строки
         * @param {Array} match - Сматченные пути
         * @returns {Promise -> {line: String, freezePairsList: Array[[concreteMatch, freezePath],...]}}
         */
        recursor: function(parent, carrier, line, match) {
            var freezeMatches = match.map(function(concreteMatch) {
                var fullpath = this.resolveFreezable(carrier, concreteMatch);

                return this
                    .buildAndFreeze(parent, carrier, fullpath, line, concreteMatch, match)
                    .then(function(freezeData) {
                        return [concreteMatch, freezeData[0]]; // -> freezePair
                    });
            }, this);

            return vow
                .all(freezeMatches)
                .then(function(freezePairsList) {
                    return {
                        line: line,
                        freezePairsList: freezePairsList,
                        match: match
                    };
                });
        },

        buildAndFreeze: function(parent, carrier, fullpath, line, concreteMatch, match) {
            return this
                .buildFile(carrier, fullpath)
                .then(function(content) {
                    // Carrier это parent для этого файла
                    // Fullpath это carrier, поскольку мы фризим уже побилженный файл по пути
                    // buildFile a, b -> b_content => freeze b_content with fullpath of b and ancestor of b as parent
                    return this.freeze(carrier, fullpath, content);
                }, this);
        },

        /**
         * Получить обработчик для контента файла
         * @param {String|null} parent - Абсолютный путь к файлу-родителю(он связан с чилдом через инклюд или импорт)
         * @param {String} carrier - Абсолютный путь к файлу-носителю, которому принадлежит content
         * @returns {Function}
         */
        getFileProcessor: function(parent, carrier) {
            /**
             * Обрабатывает файл построчно
             * @param {String} content - Содержимое обрабатываемого файла
             * @returns {Promise} "Очередь" обрабатываемых строк
             */
            return function fileProcessor(content) {
                var lines = content.split(T_NL).map(function(line, index) {
                    // Построчная обработка для возможности узнать номер строки
                    // Удобно в наследуемых технологиях для обработки ошибок и sourcemaps
                    // FIXME: Нужно переписать резолв путей на относиетльный от тарджета
                    // Сейчас технологией нельзя создать файл за пределами или глубже папки исходника
                    return this.processLine(parent, carrier, line, index);
                }, this);

                var foldFn = function(acc, freezePair) {
                    var freezePath = this.postprocessFreezePath(parent, carrier, freezePair[1]);
                    return this.replaceMatch(
                        acc,
                        freezePair[0],
                        freezePath
                    );
                }.bind(this);

                var postprocess = function(lines) {
                    return lines.map(function(lineStruct, index) {
                        if(lineStruct.match.length === 0) {
                            return lineStruct.line;
                        }

                        var freezeProcessedLine = lineStruct.freezePairsList.reduce(foldFn, lineStruct.line);

                        var res = this
                            .postprocessMatchedLine(
                                parent,
                                carrier,
                                lineStruct.line,
                                freezeProcessedLine,
                                lineStruct.match,
                                index
                            );

                        return res;
                    }, this);
                };

                return vow
                    .all(lines)
                    .then(postprocess, this)
                    .then(justJoinNL);
            };
        },

        /**
         * Обрабатывает указанный файл
         * @param {String|null} parent - Абсолютный путь к файлу-родителю(он связан с чилдом через инклюд или импорт)
         * @param {String} file - Абсолютный путь к обрабатываемому файлу
         * @returns {Promise} Промис, который должен перейти в конечное успешное состояние со строковым результатом
         */
        buildFile: function(parent, file) {
            if(parent === null) {
                parent = file;
            }

            return vowFs
                .read(file, this._encoding)
                .then(this.getFileProcessor(parent, file), this);
        }
    })
    .createTech();
