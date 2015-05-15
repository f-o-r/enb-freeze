module.exports = {
    zip: function (a, b) {
        if(a.length !== b.length) {
            if(a.length > b.length) {
                a = a.slice(0, b.length);
            } else {
                b = b.slice(0, a.length);
            }
        }

        return a
            .map(function(_, i) {
                return [a, b].map(function(arr) {return arr[i];});
            });
    },

    wantImplementationOf: function (nameToImplement) {
        return function() {
            throw new Error('You should implement ' + nameToImplement + ' method');
        };
    },

    justJoin: function (arr) {
        return arr.join('');
    },

    justJoinNL: function (arr) {
        return arr.join('\n');
    },

    isAbsolute: function (p) {
        return p.indexOf('/') === 0;
    },

    repeat: function (s, n) {
        var res = '';
        for(var i = 0; i < n; i++) {
            res += s;
        }

        return res;
    }

};
