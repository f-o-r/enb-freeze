/**
 * Содержит различные функции для digest'а числовых последовательностей
 */

module.exports = {
    /**
     * Обычный hex digest для таблицы чисел
     * @param {Object} hash - Результат `require('crypto').createHash(algo)`
     * @returns {String}
     */
    hex: function(hash) {
        return hash.digest('hex');
    },

    /**
     * Возвращает digest, используя алфавит из 26 латинских букв и 10 цифр
     * Выглядит компактнее чем обычный hex digest
     * @param {Object} hash - Результат `require('crypto').createHash(algo)`
     * @returns {String}
     */
    alphanum: function(hash) {
        var digest = hash.digest();
        var res = [];
        var lower;
        var higher;
        var hex;
        for(var i = 0, len = digest.length; i < len; i++) {
            hex = parseInt(digest[i], 16);
            // см. ASCII таблицу
            lower =  (hex % 36) + 48; // 36 - буквы + цифры, 48 - смещение
            higher = (hex % 26) + 97; // 26 - буквы, 97 - смещение
            if(lower < 58) {
                res.push(String.fromCharCode(lower));
            } else {
                res.push(String.fromCharCode(higher));
            }
        }

        return res.join('');
    }
};
