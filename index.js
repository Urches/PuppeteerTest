const puppeteer = require('puppeteer');
const path = require('path');
const rimraf = require("rimraf");
const fs = require("fs");

const ITERATION_COUNT = 10000;
const PAGES_COUNT = 8;
const SRC_FILE = `${path.join(__dirname, './test-src/test.html')}`;
const DIST_FOLDER = "./test-dist";

function clearDist() {
  rimraf.sync(DIST_FOLDER);
  fs.mkdirSync(DIST_FOLDER);
}

function remove(array, item) {
  let index = array.indexOf(item);
  if (index !== -1) array.splice(index, 1);
  return array;
}

function createPages(browser) {
  const promises = [];
  for (let i = 0; i < PAGES_COUNT; i++) {
    promises.push(browser.newPage());
  }
  return Promise.all(promises);
}

function getInfinityIterator(items) {
  let index = 0;
  return {
    next(){
      const item = items[index] ?
        {next: items[index], index: index + 1} :
        {next :items[0], index: 0};

      index = item.index;
      return item.next;
    },
    map(func) {
      return items.map(func)
    }
  }
}

function getPageHandlersQueue(page) {
  const handlers = [];
  let globalResolve = null;
  return {
    putHandler(newHandler){
      handlers.push(newHandler);
    },

    start() {
      return new Promise(resolve => {
        globalResolve = resolve;
        this.run();
      });
    },

    run() {
      // console.log('handlers', handlers.length);
      let handler = handlers.shift();
      if (handler) {
        handler(page)
          .then(() => this.run());
      } else {
        // console.log('in resolve!');
        globalResolve();
      }
    },

    getHandlers() {
      return handlers;
    }
  }
}

(async () => {
  clearDist();
  console.log("start...");
  const browser = await puppeteer.launch();
  const start =  Date.now();
  try {
    const pages = await createPages(browser);
    const pageQueue = pages
      .map(page => getPageHandlersQueue(page));

    const iterator = getInfinityIterator(pageQueue);
    for (let i = 0; i < ITERATION_COUNT; i++) {
      let pageQueue = iterator.next();
      pageQueue.putHandler(async page => {
          await page.goto(SRC_FILE);
          await page.pdf({path: `${DIST_FOLDER}/test${i}.pdf`, format: 'A4'});
        })
    }
    const promises = iterator.map(handlerQueue => handlerQueue.start());
    console.log(promises);
    await Promise.all(promises);
  } catch (e) {
    console.log("Error thrown", e);
  } finally {
    await browser.close();
    const finsish =  Date.now();
    console.log("finish");
    console.log(
      "Time wasted(seconds):",
      Math.abs((finsish - start) / 1000),
      `Copies created: ${ITERATION_COUNT}`
    );
  }
})();