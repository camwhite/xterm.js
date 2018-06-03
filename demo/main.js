import * as Terminal from '../build/xterm';
import * as attach from '../build/addons/attach/attach';
import * as fit from '../build/addons/fit/fit';
import * as fullscreen from '../build/addons/fullscreen/fullscreen';
import * as search from '../build/addons/search/search';
import * as webLinks from '../build/addons/webLinks/webLinks';
import * as winptyCompat from '../build/addons/winptyCompat/winptyCompat';


Terminal.applyAddon(attach);
Terminal.applyAddon(fit);
Terminal.applyAddon(fullscreen);
Terminal.applyAddon(search);
Terminal.applyAddon(webLinks);
Terminal.applyAddon(winptyCompat);


var term,
    protocol,
    socketURL,
    socket,
    pid;

var terminalContainer = document.getElementById('terminal-container'),
    actionElements = {
      findNext: document.querySelector('#find-next'),
      findPrevious: document.querySelector('#find-previous')
    },
    optionElements = {
      cursorBlink: document.querySelector('#option-cursor-blink'),
      cursorStyle: document.querySelector('#option-cursor-style'),
      macOptionIsMeta: document.querySelector('#option-mac-option-is-meta'),
      scrollback: document.querySelector('#option-scrollback'),
      transparency: document.querySelector('#option-transparency'),
      tabstopwidth: document.querySelector('#option-tabstopwidth'),
      experimentalCharAtlas: document.querySelector('#option-experimental-char-atlas'),
      bellStyle: document.querySelector('#option-bell-style'),
      screenReaderMode: document.querySelector('#option-screen-reader-mode')
    },
    colsElement = document.getElementById('cols'),
    rowsElement = document.getElementById('rows'),
    paddingElement = document.getElementById('padding');

function setTerminalSize() {
  var cols = parseInt(colsElement.value, 10);
  var rows = parseInt(rowsElement.value, 10);
  var width = (cols * term.renderer.dimensions.actualCellWidth + term.viewport.scrollBarWidth).toString() + 'px';
  var height = (rows * term.renderer.dimensions.actualCellHeight).toString() + 'px';
  terminalContainer.style.width = width;
  terminalContainer.style.height = height;
  term.fit();
}

function setPadding() {
  term.element.style.padding = parseInt(paddingElement.value, 10).toString() + 'px';
  term.fit();
}

colsElement.addEventListener('change', setTerminalSize);
rowsElement.addEventListener('change', setTerminalSize);
paddingElement.addEventListener('change', setPadding);

actionElements.findNext.addEventListener('keypress', function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    term.findNext(actionElements.findNext.value);
  }
});
actionElements.findPrevious.addEventListener('keypress', function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    term.findPrevious(actionElements.findPrevious.value);
  }
});

optionElements.cursorBlink.addEventListener('change', function () {
  term.setOption('cursorBlink', optionElements.cursorBlink.checked);
});
optionElements.macOptionIsMeta.addEventListener('change', function () {
  term.setOption('macOptionIsMeta', optionElements.macOptionIsMeta.checked);
});
optionElements.transparency.addEventListener('change', function () {
  var checked = optionElements.transparency.checked;
  term.setOption('allowTransparency', checked);
  term.setOption('theme', checked ? {background: 'rgba(0, 0, 0, .5)'} : {});
});
optionElements.cursorStyle.addEventListener('change', function () {
  term.setOption('cursorStyle', optionElements.cursorStyle.value);
});
optionElements.bellStyle.addEventListener('change', function () {
  term.setOption('bellStyle', optionElements.bellStyle.value);
});
optionElements.scrollback.addEventListener('change', function () {
  term.setOption('scrollback', parseInt(optionElements.scrollback.value, 10));
});
optionElements.tabstopwidth.addEventListener('change', function () {
  term.setOption('tabStopWidth', parseInt(optionElements.tabstopwidth.value, 10));
});
optionElements.experimentalCharAtlas.addEventListener('change', function () {
  term.setOption('experimentalCharAtlas', optionElements.experimentalCharAtlas.value);
});
optionElements.screenReaderMode.addEventListener('change', function () {
  term.setOption('screenReaderMode', optionElements.screenReaderMode.checked);
});

createTerminal();

function createTerminal() {
  // Clean terminal
  while (terminalContainer.children.length) {
    terminalContainer.removeChild(terminalContainer.children[0]);
  }
  term = new Terminal({
    macOptionIsMeta: optionElements.macOptionIsMeta.enabled,
    cursorBlink: optionElements.cursorBlink.checked,
    scrollback: parseInt(optionElements.scrollback.value, 10),
    tabStopWidth: parseInt(optionElements.tabstopwidth.value, 10),
    screenReaderMode: optionElements.screenReaderMode.checked
  });
  window.term = term;  // Expose `term` to window for debugging purposes
  term.on('resize', function (size) {
    if (!pid) {
      return;
    }
    var cols = size.cols,
        rows = size.rows,
        url = '/terminals/' + pid + '/size?cols=' + cols + '&rows=' + rows;

    fetch(url, {method: 'POST'});
  });
  protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://';
  socketURL = protocol + location.hostname + ((location.port) ? (':' + location.port) : '') + '/terminals/';

  term.open(terminalContainer);
  term.winptyCompatInit();
  term.webLinksInit();
  term.fit();
  term.focus();

  // fit is called within a setTimeout, cols and rows need this.
  setTimeout(function () {
    console.log(term.cols, term.getOption('cols'));
    initOptions(term);
    // colsElement.value = term.cols;
    // rowsElement.value = term.rows;
    paddingElement.value = 0;

    // Set terminal size again to set the specific dimensions on the demo
    setTerminalSize();

    fetch('/terminals?cols=' + term.cols + '&rows=' + term.rows, {method: 'POST'}).then(function (res) {

      res.text().then(function (processId) {
        pid = processId;
        socketURL += processId;
        socket = new WebSocket(socketURL);
        socket.onopen = runRealTerminal;
        socket.onclose = runFakeTerminal;
        socket.onerror = runFakeTerminal;
      });
    });
  }, 0);
}

function runRealTerminal() {
  term.attach(socket);
  term._initialized = true;
}

function runFakeTerminal() {
  if (term._initialized) {
    return;
  }

  term._initialized = true;

  var shellprompt = '$ ';

  term.prompt = function () {
    term.write('\r\n' + shellprompt);
  };

  term.writeln('Welcome to xterm.js');
  term.writeln('This is a local terminal emulation, without a real terminal in the back-end.');
  term.writeln('Type some keys and commands to play around.');
  term.writeln('');
  term.prompt();

  term.on('key', function (key, ev) {
    var printable = (
      !ev.altKey && !ev.altGraphKey && !ev.ctrlKey && !ev.metaKey
    );

    if (ev.keyCode == 13) {
      term.prompt();
    } else if (ev.keyCode == 8) {
     // Do not delete the prompt
      if (term.x > 2) {
        term.write('\b \b');
      }
    } else if (printable) {
      term.write(key);
    }
  });

  term.on('paste', function (data, ev) {
    term.write(data);
  });
}

function initOptions(term) {
  var blacklistedOptions = [
    // Internal only options
    'cancelEvents',
    'convertEol',
    'debug',
    'handler',
    'screenKeys',
    'termName',
    'useFlowControl',
    // Complex option
    'theme'
  ];
  var stringOptions = {
    bellSound: null,
    bellStyle: ['none', 'sound'],
    cursorStyle: ['block', 'underline', 'bar'],
    experimentalCharAtlas: ['none', 'static', 'dynamic'],
    fontFamily: null,
    fontWeight: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
    fontWeightBold: ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900']
  };
  var options = Object.keys(term.options);
  var booleanOptions = [];
  var numberOptions = [];
  options.filter(o => blacklistedOptions.indexOf(o) === -1).forEach(o => {
    switch (typeof term.getOption(o)) {
      case 'boolean':
        booleanOptions.push(o);
        break;
      case 'number':
        numberOptions.push(o);
        break;
      default:
        if (Object.keys(stringOptions).indexOf(o) === -1) {
          console.warn(`Unrecognized option: "${o}"`);
        }
    }
  });

  var html = '<h1>Options</h1>';
  booleanOptions.forEach(o => {
    html += `<div><label><input id="opt-${o}" type="checkbox" ${term.getOption(o) ? 'checked' : ''}/> ${o}</label></div>`;
  });
  numberOptions.forEach(o => {
    html += `<div><label>${o} <input id="opt-${o}" type="number" value="${term.getOption(o)}"/></label></div>`;
  });
  Object.keys(stringOptions).forEach(o => {
    if (stringOptions[o]) {
      html += `<div><label>${o} <select id="opt-${o}">${stringOptions[o].map(v => `<option ${term.getOption(o) === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label></div>`;
    } else {
      html += `<div><label>${o} <input id="opt-${o}" type="text" value="${term.getOption(o)}"/></label></div>`
    }
  });

  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  // Attach listeners
  // var allOptions = booleanOptions.concat(numberOptions, Object.keys(stringOptions));
  booleanOptions.forEach(o => {
    const input = document.getElementById(`opt-${o}`);
    input.addEventListener('change', () => {
      console.log('change', o, input.checked);
      term.setOption(o, input.checked);
    });
  });
  numberOptions.concat(Object.keys(stringOptions)).forEach(o => {
    const input = document.getElementById(`opt-${o}`);
    input.addEventListener('change', () => {
      console.log('change', o, input.value);
      term.setOption(o, input.value);
    });
  });
}
