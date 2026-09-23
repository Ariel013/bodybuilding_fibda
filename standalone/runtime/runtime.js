/* Adapter for the pinned offline Python runtime; the sports modules are unchanged. */
window.FIBDAPythonRuntime = (() => {
  let instance;
  const decode = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

  function boot({ onProgress = () => {}, files = {} } = {}) {
    if (instance) return instance;
    instance = (async () => {
      if (!globalThis.WebAssembly) throw new Error('Ce navigateur ne prend pas en charge WebAssembly.');
      onProgress('Initialisation du moteur sportif Python…');
      const element = document.getElementById('fibda-python-assets');
      const assets = JSON.parse(element.textContent);
      const stdlibURL = URL.createObjectURL(new Blob([decode(assets.stdlib)], {type:'application/zip'}));
      let py;
      try {
        py = await loadPyodide({
          indexURL: 'https://fibda-runtime.invalid/',
          _wasmBinary: decode(assets.wasm),
          stdLibURL: stdlibURL,
          lockFileContents: assets.lock,
          packages: [],
          stdout: text => console.info('[FIBDA Python]', text),
          stderr: text => console.error('[FIBDA Python]', text),
        });
      } finally {
        URL.revokeObjectURL(stdlibURL);
      }
      for (const [path, content] of Object.entries({...assets.files, ...files})) {
        if (!path.startsWith('/home/pyodide/')) throw new Error('Chemin de module autonome invalide.');
        py.FS.mkdirTree(path.slice(0, path.lastIndexOf('/')));
        py.FS.writeFile(path, content, {encoding:'utf8'});
      }
      for (const [name, content] of Object.entries(assets.wheels || {})) {
        py.unpackArchive(decode(content), 'zip', {extractDir:'/home/pyodide'});
      }
      py.runPython('import sys\nsys.path.insert(0, "/home/pyodide")\nimport json as _fibda_json\nimport importlib as _fibda_importlib');
      element.remove();
      let queue = Promise.resolve();
      function serial(task) {
        const result = queue.then(task);
        queue = result.catch(() => {});
        return result;
      }
      function evaluateJson(expression) {
        return serial(() => {
          py.globals.set('_fibda_expression', expression);
          return JSON.parse(py.runPython('_fibda_json.dumps(eval(_fibda_expression), ensure_ascii=False)'));
        });
      }
      function call(module, method, payload) {
        return serial(() => {
          py.globals.set('_fibda_invocation', JSON.stringify({module, method, payload}));
          return JSON.parse(py.runPython([
            '_fibda_args = _fibda_json.loads(_fibda_invocation)',
            '_fibda_fn = getattr(_fibda_importlib.import_module(_fibda_args["module"]), _fibda_args["method"])',
            '_fibda_json.dumps(_fibda_fn(_fibda_args["payload"]), ensure_ascii=False)',
          ].join('\n')));
        });
      }
      onProgress('Moteur sportif prêt');
      window.fibdaPython = py;
      return {version:py.version, python:py, evaluateJson, call};
    })();
    return instance;
  }
  return {version:'0.28.3', boot};
})();
