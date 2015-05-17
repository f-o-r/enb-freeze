module.exports = {
    source: '?.foo',
    target: '?.bar',
    freezeDir: function() {return '/';},
    freezePathPostprocess: null
};
