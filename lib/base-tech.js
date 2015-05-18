"use strict";

var crypto = require('crypto');
var path = require('path');
var util = require('util');

var vow = require('enb/node_modules/vow');
var vowFs = require('enb/node_modules/vow-fs');

var helpers = require('./helpers');
var digest = require('./digest');
var grammar = require('./grammar');

/**
 * Ожидает компиляции тарджетов текущей ноды и/или тарджетов других нод, если они указаны
 * Это нужно чтобы не получить ошибки в том случае, если файл, который мы фризим загружает
 * css/js/..., которые тоже генерируются enb и могут быть не готовы к моменту фриза
 * @param {Function} cb - Обработчик, который нужно вызвать после готовности всех тарджетов
 * @returns {Promise}
 */
function waitForSourcesAnd(cb) {
    return function() {
        var _this = this;
        var builderArgs = arguments;

        var requireSources = function() {
            return _this.node.requireSources(_this._waitForTargets).spread(function() {
                return cb.apply(_this, builderArgs);
            });
        };

        if(Object.keys(this._waitForNodeTargets).length > 0) {
            return this.node.requireNodeSources(this._waitForNodeTargets).spread(requireSources);
        } else {
            return requireSources();
        }
    };
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
    .defineOption('blockComments', []) // Пара (start, end)
    .defineOption('debug', true)

    .target('target', '?.target')
    .useSourceFilename('source')

    .builder(
        waitForSourcesAnd(
            function(source) {

                this.validateOptions();
                this._grammar = this.createGrammar();

                return this.buildFile(null, source);
            }
        )
    )
    .methods({

        /**
         * Должна валидировать опции, которым необходима валидация
         * @throws {Error} Если найдены несоответствия
         * @returns {undefined}
         */
        validateOptions: function() {
            if(this._blockComments.length > 0 && this._blockComments.length !== 2) {
                throw new Error('Option blockComments must be a tuple, for example: ["/*", "*/"]');
            }
        },

        /**
         * Создаёт парсер для разбора синтаксиса на составляющие, общие для большинства файлов с исходными кодами
         * @returns {grammar.Grammar} Преднастроенная инстанция парсера
         */
        createGrammar: function() {
            var tokens = [];
            if(this._blockComments.length) {
                tokens.push([grammar.TOKENS.T_BLOCK_COMMENT_START, grammar.tokenMatchers.matchStr(this._blockComments[0])]);
                tokens.push([grammar.TOKENS.T_BLOCK_COMMENT_END, grammar.tokenMatchers.matchStr(this._blockComments[1])]);
            }

            return new grammar.Grammar({
                tokens: tokens.concat([
                    [grammar.TOKENS.T_NL, grammar.tokenMatchers.linebreak],
                    [grammar.TOKENS.T_WHITESPACE, grammar.tokenMatchers.whitespace],
                    [grammar.TOKENS.T_RAW, grammar.tokenMatchers.any]
                ])
            });
        },

        /**
         * Matcher для рекурсивной обработки файлов
         * Имеет приоритет перед `matchFreeze`
         * @param {String} token - Токен из обрабатываемого файла
         * @returns {null|undefined|[String]} - Совпадения в виде массива относительных(по отношению к файлу-носителю) путей
         */
        matchRecursor: helpers.wantImplementationOf('matchRecursor'),

        /**
         * Matcher для обработки include'ов, которые могут быть зафрижены
         * Для этого типа include'ов ожидается, что файл, на который указывает include был уже сбилжен
         * т.е. в случае css, например, мы ожидаем, что вся статика из include'а уже прошла процедуру фриза
         * технологией, которая знает как фризить ресурсы внутри css,
         * и нужно будет зафризить этот файл as is.
         * @param {String} token - Токен из обрабатываемого файла
         * @returns {null|undefined|[String]} - Совпадения в виде массива относительных(по отношению к файлу-носителю) путей
         */
        matchFreeze: helpers.wantImplementationOf('matchFreeze'),

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
         * Считывает контент файла
         * Возвращает ошибку с упоминанием родительского файла чтобы быть более информативной
         * @param {String} parent - Родительский файл
         * @param {String} fullpath - Абсолютный путь к считываемому файлу
         * @returns {Promise -> MaybeString} Промис, который возможно вернёт строку или ошибку в случае неудачи
         */
        readFile: function(parent, fullpath) {
            return vowFs
                .exists(fullpath)
                .then(function(exists) {
                    if(!exists) {
                        var promise = new vow.Promise();
                        promise.reject(
                            util.format(
                                new Error('File %s, required by %s is not exists'),
                                fullpath, parent
                            )
                        );
                    }

                    return vowFs
                        .read(fullpath, this._encoding);
                }, this);
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
            return path.basename(fullname).split(path.sep).pop().split('.').slice(1).join('.');
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
        freezeContent: function(parent, carrier, content) {
            var hash = this.getChecksumOf(content);
            var suffix = this.getSuffix(carrier);
            var freezeDir = this.getFreezeDir(suffix);

            if(!freezeDir) {
                throw new Error('Freeze directory was not specified for ' + suffix);
            }

            if(!helpers.isAbsolute(freezeDir)) {
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
            return this
                .readFile(parent, fullpath)
                .then(function(content) {
                    return this.freezeContent(parent, fullpath, content);
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
            // FIXME: refactor, too complex
            if(this._freezePathPostprocess) {
                var res = this._freezePathPostprocess(parent, carrier, freezePath);
                if(res) {
                    return res;
                }
            }

            var basePath;
            if(parent === carrier) {
                basePath = path.resolve(path.dirname(carrier));
            } else {
                basePath = this.getFreezeDir(this.getSuffix(freezePath));
            }

            return path.relative(basePath, freezePath);
        },

        /**
         * Определяет "отправную точку" для резолюции путей функцией `resolveFreezable`
         * Сделана отдельным методом чтобы можно было удобно переопределять её на уровне конкретных технологий
         * @param {String} carrier - Абсолютный путь к файлу-носителю, которому принадлежит content
         * @param {String} path - Путь к импортируемому/подключаемому внутри технологии файлу
         * @returns {String} Абсолютный путь к базовой директории, относительно которой будут резолвиться
         * пути к исходным файлам для фриза
         */
        getFreezablePathsBase: function(carrier/*, path*/) {
            return path.dirname(carrier);
        },

        /**
         * Определяет абсолютный путь к файлу для последующего фриза
         * @param {String} carrier - Абсолютный путь к файлу-носителю, которому принадлежит content
         * @param {String} tail - Хвост пути, обычно похож на `foo/bar.css`, `/foo/bar.css` или `../../foo/bar.css`
         *                        Лидирующий слеш будет удалён из пути
         * @returns {String} Абсолютный путь к файлу для фриза
         */
        resolveFreezable: function(carrier, tail) {
            // FIXME: Подумать, как лучше избавится от абсолютного пути
            tail = tail.replace(/^\//, '');
            return path.resolve(this.getFreezablePathsBase(carrier, tail), tail);
        },

        /**
         * Заменяет сматчившийся путь на фризовый
         * @param {String} input - Исходная строка
         * @param {String} oldValue - Старый путь
         * @param {String} newValue - Новый,фризовый путь
         * @returns {String} Строка с фризовым путём
         */
        replaceMatch: function(input, oldValue, newValue) {
            return input.replace(oldValue, newValue);
        },

        /**
         * Обрабатывает строку в исходном файле и вызывает постпроцесс на совпадениях
         * @param {String|null} parent - Абсолютный путь к файлу-родителю(он связан с чилдом через инклюд или импорт)
         * @param {String} carrier - Абсолютный путь к файлу, носителю обрабатываемой строки
         * @param {grammar.AST_NODE} node - AST узел, полученный после разбора обрабатываемого файла
         * @returns {Promise -> {node, freezePairsList, match}} Результат выполнения
         * Если для строки нет необходимости в какой-либо обработке, то она возвращается as is.
         * Если для строки нашелся обработчик то можно вернуть промис либо обработанную строку.
         */
        processNode: function(parent, carrier, node/*, index*/) {
            var matchRecursor = this.matchRecursor(node) || [];
            var matchFreeze =  this.matchFreeze(node) || [];

            if(matchRecursor.length > 0) {
                return this.recursor(parent, carrier, node, matchRecursor);
            }

            if(matchFreeze.length > 0) {
                return this.freeze(parent, carrier, node, matchFreeze);
            }

            return this.createFreezeResult(
                node,
                [],
                (matchRecursor || []).concat(matchFreeze || [])
            );
        },

        /**
         * Парсит переданный контент, обрабатывает доступные синтаксические конструкции.
         * Доступными для обработки не являются:
         *   - Блочные комментарии
         *   - Строковые комментарии
         * Данные сущности попадут в результат as is при условии, что наследуемая технология опишет токены,
         * по которым эти сущности можно будет распознать.
         * @param {String|null} parent - Абсолютный путь к файлу-родителю(он связан с чилдом через инклюд или импорт)
         * @param {String} carrier - Абсолютный путь к файлу, носителю обрабатываемой строки
         * @param {String} content - Содержимое файла
         * @returns {Array[Promise | freezeResult]}
         */
        processContent: function(parent, carrier, content) {
            var tree =  grammar.AST.fold(this._grammar.parse(content), grammar.helpers.fold.sameSiblings);
            var node = null;
            var excludes = [
                grammar.TOKENS.T_BLOCK_COMMENT_START
            ];
            var res = [];

            for(var i = 0, len = tree.length; i < len; i++) {
                node = tree[i];
                if(excludes.indexOf(node.token) === -1) {
                    res.push(this.processNode(parent, carrier, node, i));
                } else {
                    res = res.concat(
                        grammar.AST
                            .flatten([node])
                            .map(function(node) {return this.createFreezeResult(node, [], []);}, this)
                    );
                }
            }

            return res;
        },

        /**
         * Выполняет постпроцессинг каждого изменившегося пути
         * @param {String|null} parent - Абсолютный путь к файлу-родителю(он связан с чилдом через инклюд или импорт)
         * @param {String} carrier - Абсолютный путь к файлу-носителю, которому принадлежит content
         * @param {String} oldValue - Старое значение AST узла
         * @param {String} newValue - Новое значение AST узла
         * @param {Array} match - Сматченные пути
         * @param {Number} index - Индекс строки в файле
         * @returns {Promise -> String|String} Изменённая строка для записи в файл
         */
        postprocessMatchedValue: function(parent, carrier, oldValue, newValue/*, match, index*/) {
            return newValue;
        },

        /**
         * Обрабатывает все recursive(инклюды файла в одной технологии) сущности из файла
         * @param {String|null} parent - Абсолютный путь к файлу-родителю(он связан с чилдом через инклюд или импорт)
         * @param {String} carrier - Абсолютный путь к файлу-носителю, которому принадлежит content
         * @param {String} node - Значение сматченной строки
         * @param {Array} match - Сматченные пути
         * @returns {Promise -> {node: grammar.AST_NODE, freezePairsList: Array[[concreteMatch, freezePath],...], match: Array[String]}}
         */
        recursor: function(parent, carrier, node, match) {
            var freezeMatches = match.map(function(concreteMatch) {
                var fullpath = this.resolveFreezable(carrier, concreteMatch);

                return this
                    .buildAndFreeze(parent, carrier, fullpath, node, concreteMatch, match)
                    .then(function(freezeData) {
                        return this.createFreezePair(concreteMatch, freezeData[0]);
                    }, this);
            }, this);

            return this._processFreezeMatches(freezeMatches, node, match);
        },

        /**
         * Обрабатывает все freezable(инклюды файлов не рекурсивных технологий, например xsl->gif) сущности из файла
         * @param {String|null} parent - Абсолютный путь к файлу-родителю(он связан с чилдом через инклюд или импорт)
         * @param {String} carrier - Абсолютный путь к файлу-носителю, которому принадлежит content
         * @param {String} node - Значение сматченной строки
         * @param {Array} match - Сматченные пути
         * @returns {Promise -> {node: grammar.AST_NODE, freezePairsList: Array[[concreteMatch, freezePath],...], match: Array[String]}}
         */
        freeze: function(parent, carrier, node, match) {
            var freezeMatches = match.map(function(concreteMatch) {
                var fullpath = this.resolveFreezable(carrier, concreteMatch);

                return this
                    .freezeFile(carrier, fullpath)
                    .then(function(freezeData) {
                        return this.createFreezePair(concreteMatch, freezeData[0]);
                    }, this);
            }, this);

            return this._processFreezeMatches(freezeMatches, node, match);
        },

        /**
         * Общий код для `recursor` и `freeze`
         * @param {Array[vow.Promise -> freezePair, ...]} freezeMatches - Список промисов, возвращающих freezePair(#createFreezePair)
         *                                                                по достижению успеха
         * @param {grammar.AST_NODE} node - Обрабатываемый AST узел
         * @param {Array} match - Сматченные пути
         * @returns {vow.Promise -> Array[freezeResult, ...]}
         */
        _processFreezeMatches: function(freezeMatches, node, match) {
            return vow
                .all(freezeMatches)
                .then(function(freezePairsList) {
                    return this.createFreezeResult(node, freezePairsList, match);
                }, this);
        },

        /**
         * Создаёт структуру с данными обработанного технологией узла
         * @param {grammar.AST_NODE} node - AST узел
         * @param {Array[[concreteMatch, freezePath],...]} freezePairsList - Массив пар [совпадение, фризовый_путь]
         * @param {Array[String]} match - Массив найденных путей внутри этого узла
         * @returns {Object{...}} Объект, в который упакованы параметры данной функции
         */
        createFreezeResult: function(node, freezePairsList, match) {
            return {
                node: node,
                freezePairsList: freezePairsList,
                match: match
            };
        },

        /**
         * Создаёт пару из оригинального пути и фризового
         * @param {String} original
         * @param {String} freezed
         * @returns {Array[original, freezed]}
         */
        createFreezePair: function(original, freezed) {
            return [original, freezed];
        },

        /**
         * Вызывает build файла, затем фризит его
         * @param {String|null} parent - Абсолютный путь к файлу-родителю(он связан с чилдом через инклюд или импорт)
         * @param {String} carrier - Абсолютный путь к файлу-носителю, которому принадлежит content
         * @param {String} fullpath - Абсолютный путь к считываемому файлу
         * @param {grammar.AST_NODE} node - AST узел
         * @param {String} concreteMatch - Конкретный путь, который был сматчен
         * @param {Array[String]} match - Список всех найденных путей
         * @returns {vow.Promise -> freezeData}
         */
        buildAndFreeze: function(parent, carrier, fullpath/*, node, concreteMatch, match*/) {
            return this
                .buildFile(carrier, fullpath)
                .then(function(content) {
                    // Carrier это parent для этого файла
                    // Fullpath это carrier, поскольку мы фризим уже побилженный файл по пути
                    return this.freezeContent(carrier, fullpath, content);
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
             * Обрабатывает файл с помощью анализа синтаксиса и выявления фризовых сущностей
             * @param {String} content - Содержимое обрабатываемого файла
             * @returns {Promise} "Очередь" обрабатываемых строк
             */
            return function fileProcessor(content) {
                var foldFn = function(acc, freezePair) {
                    var freezePath = this.postprocessFreezePath(parent, carrier, freezePair[1]);
                    return this.replaceMatch(
                        acc,
                        freezePair[0],
                        freezePath
                    );
                }.bind(this);

                var postprocess = function(tokens) {
                    return tokens.map(function(tokenStruct, index) {
                        var freezeProcessedToken = tokenStruct.freezePairsList.reduce(foldFn, tokenStruct.node.data.match);
                        var res = this
                                .postprocessMatchedValue(
                                    parent,
                                    carrier,
                                    tokenStruct.node.data.match,
                                    freezeProcessedToken,
                                    tokenStruct.match,
                                    index
                                );

                        return res;
                    }, this);
                };

                return vow
                    .all(this.processContent(parent, carrier, content))
                    .then(postprocess, this)
                    .then(helpers.justJoin);
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

            return this
                .readFile(parent, file)
                .then(this.getFileProcessor(parent, file), this);
        }
    })
    .createTech();
