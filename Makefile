DEFAULT_GOAL = all
NPM_BIN = ./node_modules/.bin


all: npm test
npm:
	npm install
test: npm
	$(NPM_BIN)/mocha --recursive test

.PHONY: all npm test
